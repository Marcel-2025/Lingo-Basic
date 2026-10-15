import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DEFAULT_INSIGHTS, DEFAULT_STATS, getDefaultSettings, PROGRESS_SCHEMA_VERSION } from "@/app/lib/defaults";
import { mergeProgressSnapshots, normalizeInsights, normalizeSettings, normalizeStats } from "@/app/lib/progress";
import { getDateKey, getLevelFromXp, reconcileStreak, recordActivity } from "@/app/lib/utils";
import type { AppSettings, CloudProgressSnapshot, LearningInsights, UserStats } from "@/app/lib/types";
import { readJson, STORAGE_KEYS, writeJson } from "~/lib/storage";
import { loadCloudProgress, saveCloudProgress, subscribeToAuth, type FirebaseUser } from "~/lib/firebase";

/**
 * App-wide state for the native app: local progress (AsyncStorage, offline-first), the Firebase user and the
 * optional cloud sync. Merge/normalization logic is shared with the web app (app/lib), so both behave identically.
 */

export type SyncStatus = "offline" | "loading" | "ready" | "syncing" | "pending" | "error";

interface AppState {
  isLoaded: boolean;
  stats: UserStats;
  settings: AppSettings;
  insights: LearningInsights;
  user: FirebaseUser | null;
  syncStatus: SyncStatus;
  syncMessage: string;
  updateStats: (updater: (previous: UserStats) => UserStats) => void;
  updateSettings: (updater: (previous: AppSettings) => AppSettings) => void;
  updateInsights: (updater: (previous: LearningInsights) => LearningInsights) => void;
  /** XP, streak and answer counters for one answered card/question. */
  awardAnswer: (xp: number, correct: boolean, learnedDelta: number, masteredDelta: number) => void;
  todayKey: () => string;
  retrySync: () => void;
}

const AppStateContext = createContext<AppState | null>(null);

const SAVE_DEBOUNCE_MS = 1200;
const WRITE_TIMEOUT_MS = 15_000;
const RETRY_DELAYS_MS = [5_000, 15_000, 60_000, 180_000];

const withTimeout = <T,>(promise: Promise<T>, ms: number) =>
  new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error("Offline – Änderungen werden übertragen, sobald du online bist.")), ms);
    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [stats, setStats] = useState<UserStats>(DEFAULT_STATS);
  const [settings, setSettings] = useState<AppSettings>(getDefaultSettings);
  const [insights, setInsights] = useState<LearningInsights>(DEFAULT_INSIGHTS);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("offline");
  const [syncMessage, setSyncMessage] = useState("");
  const [retryToken, setRetryToken] = useState(0);
  const syncedAtRef = useRef(0);
  const hydratedUidRef = useRef<string | null>(null);
  const isSyncingRef = useRef(false);
  const retryCountRef = useRef(0);

  // Load local progress. Every value is normalized, so corrupt storage falls back to defaults.
  useEffect(() => {
    let isMounted = true;
    void (async () => {
      const storedSettings = normalizeSettings(await readJson<unknown>(STORAGE_KEYS.settings, null));
      const storedStats = reconcileStreak(normalizeStats(await readJson<unknown>(STORAGE_KEYS.stats, null)), storedSettings.timeZone);
      const storedInsights = normalizeInsights(await readJson<unknown>(STORAGE_KEYS.insights, null));
      const storedUpdatedAt = Number(await readJson<unknown>(STORAGE_KEYS.updatedAt, 0)) || 0;
      const marker = await readJson<{ uid?: string; syncedAt?: number } | null>(STORAGE_KEYS.syncMarker, null);
      if (!isMounted) return;
      setSettings(storedSettings);
      setStats(storedStats);
      setInsights(storedInsights);
      setUpdatedAt(storedUpdatedAt);
      syncedAtRef.current = typeof marker?.syncedAt === "number" ? marker.syncedAt : 0;
      setIsLoaded(true);
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    void writeJson(STORAGE_KEYS.stats, stats);
    void writeJson(STORAGE_KEYS.settings, settings);
    void writeJson(STORAGE_KEYS.insights, insights);
    void writeJson(STORAGE_KEYS.updatedAt, updatedAt);
  }, [insights, isLoaded, settings, stats, updatedAt]);

  useEffect(() => subscribeToAuth((nextUser) => {
    setUser(nextUser);
    if (!nextUser) {
      hydratedUidRef.current = null;
      setSyncStatus("offline");
      setSyncMessage("");
    }
  }), []);

  const markChanged = useCallback(() => setUpdatedAt(Date.now()), []);
  const updateStats = useCallback((updater: (previous: UserStats) => UserStats) => {
    setStats(updater);
    markChanged();
  }, [markChanged]);
  const updateSettings = useCallback((updater: (previous: AppSettings) => AppSettings) => {
    setSettings(updater);
    markChanged();
  }, [markChanged]);
  const updateInsights = useCallback((updater: (previous: LearningInsights) => LearningInsights) => {
    setInsights(updater);
    markChanged();
  }, [markChanged]);

  const timeZone = settings.timeZone;
  const awardAnswer = useCallback((xp: number, correct: boolean, learnedDelta: number, masteredDelta: number) => {
    updateStats((previous) => {
      const active = recordActivity(previous, timeZone);
      const nextXp = active.xp + xp;
      return {
        ...active,
        xp: nextXp,
        level: getLevelFromXp(nextXp),
        learnedWords: active.learnedWords + learnedDelta,
        masteredWords: active.masteredWords + masteredDelta,
        correctAnswers: active.correctAnswers + (correct ? 1 : 0),
        totalAnswers: active.totalAnswers + 1,
      };
    });
  }, [timeZone, updateStats]);

  const todayKey = useCallback(() => getDateKey(new Date(), timeZone), [timeZone]);

  const snapshot = useMemo<CloudProgressSnapshot>(
    () => ({ schemaVersion: PROGRESS_SCHEMA_VERSION, stats, settings, learningInsights: insights, updatedAt }),
    [insights, settings, stats, updatedAt],
  );
  const snapshotRef = useRef(snapshot);
  useEffect(() => {
    snapshotRef.current = snapshot;
  });

  const markSynced = (uid: string, syncedAt: number) => {
    syncedAtRef.current = syncedAt;
    void writeJson(STORAGE_KEYS.syncMarker, { uid, syncedAt });
  };

  const applySnapshot = useCallback((next: CloudProgressSnapshot) => {
    const nextSettings = normalizeSettings(next.settings);
    setSettings(nextSettings);
    setStats(reconcileStreak(normalizeStats(next.stats), nextSettings.timeZone));
    setInsights(normalizeInsights(next.learningInsights));
    setUpdatedAt(next.updatedAt);
  }, []);

  /** Merge on login (never drops history), then debounced uploads with retry/backoff. */
  const runSync = useCallback(async () => {
    const uid = user?.uid;
    if (!uid || isSyncingRef.current) return;
    isSyncingRef.current = true;
    try {
      if (hydratedUidRef.current !== uid) {
        setSyncStatus("loading");
        const cloud = await withTimeout(loadCloudProgress(uid), WRITE_TIMEOUT_MS);
        const local = snapshotRef.current;
        if (!cloud) {
          const first = { ...local, updatedAt: local.updatedAt || Date.now() };
          await withTimeout(saveCloudProgress(uid, first), WRITE_TIMEOUT_MS);
          markSynced(uid, first.updatedAt);
        } else {
          const merged = mergeProgressSnapshots(local, { ...cloud, schemaVersion: cloud.storedSchemaVersion });
          if (merged.localChanged) applySnapshot(merged.snapshot);
          if (merged.cloudChanged) await withTimeout(saveCloudProgress(uid, merged.snapshot), WRITE_TIMEOUT_MS);
          markSynced(uid, merged.snapshot.updatedAt);
        }
        hydratedUidRef.current = uid;
      } else if (snapshotRef.current.updatedAt > syncedAtRef.current) {
        setSyncStatus("syncing");
        const current = snapshotRef.current;
        await withTimeout(saveCloudProgress(uid, current), WRITE_TIMEOUT_MS);
        markSynced(uid, current.updatedAt);
      }
      retryCountRef.current = 0;
      setSyncMessage("");
      setSyncStatus(snapshotRef.current.updatedAt > syncedAtRef.current ? "pending" : "ready");
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : "";
      if (code.includes("permission-denied")) {
        setSyncStatus("error");
        setSyncMessage("Keine Berechtigung für den Cloud-Speicher.");
      } else {
        setSyncStatus("pending");
        setSyncMessage(error instanceof Error ? error.message : "Cloud-Sync ist gerade nicht erreichbar.");
        const delay = RETRY_DELAYS_MS[Math.min(retryCountRef.current, RETRY_DELAYS_MS.length - 1)];
        retryCountRef.current += 1;
        setTimeout(() => setRetryToken((value) => value + 1), delay);
      }
    } finally {
      isSyncingRef.current = false;
    }
  }, [applySnapshot, user]);

  useEffect(() => {
    if (!isLoaded || !user) return;
    const timeoutId = setTimeout(() => void runSync(), hydratedUidRef.current === user.uid ? SAVE_DEBOUNCE_MS : 0);
    return () => clearTimeout(timeoutId);
  }, [isLoaded, retryToken, runSync, snapshot.updatedAt, user]);

  const retrySync = useCallback(() => {
    retryCountRef.current = 0;
    setRetryToken((value) => value + 1);
  }, []);

  const value = useMemo<AppState>(() => ({
    isLoaded, stats, settings, insights, user, syncStatus, syncMessage,
    updateStats, updateSettings, updateInsights, awardAnswer, todayKey, retrySync,
  }), [awardAnswer, insights, isLoaded, retrySync, settings, stats, syncMessage, syncStatus, todayKey, updateInsights, updateSettings, updateStats, user]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) throw new Error("useAppState must be used inside AppStateProvider");
  return context;
};

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_INSIGHTS, DEFAULT_STATS, getDefaultSettings, PROGRESS_SCHEMA_VERSION } from "@/app/lib/defaults";
import { mergeProgressSnapshots, normalizeInsights, normalizeProgressSnapshot, normalizeSettings, normalizeStats } from "@/app/lib/progress";
import { getDateKey, getLevelFromXp, reconcileStreak, recordActivity } from "@/app/lib/utils";
import type { AppSettings, CloudProgressSnapshot, LearningInsights, UserStats } from "@/app/lib/types";
import { readJson, STORAGE_KEYS, writeJson } from "~/lib/storage";

/**
 * App-wide state for the native app. Progress lives only on the device (AsyncStorage, offline-first);
 * there is no account. A backup file (Settings → Sicherung) carries progress to another device, and importing
 * one merges it with the shared merge logic from app/lib, so nothing is lost either way.
 */

interface AppState {
  isLoaded: boolean;
  stats: UserStats;
  settings: AppSettings;
  insights: LearningInsights;
  updateStats: (updater: (previous: UserStats) => UserStats) => void;
  updateSettings: (updater: (previous: AppSettings) => AppSettings) => void;
  updateInsights: (updater: (previous: LearningInsights) => LearningInsights) => void;
  /** XP, streak and answer counters for one answered card/question. */
  awardAnswer: (xp: number, correct: boolean, learnedDelta: number, masteredDelta: number) => void;
  todayKey: () => string;
  /** Everything worth backing up, as one JSON-serialisable object. */
  exportSnapshot: () => CloudProgressSnapshot;
  /** Merges a backup into the local progress (union of history, higher counters win). Returns what changed. */
  importSnapshot: (input: unknown) => { ok: boolean; message: string };
  /** Deletes all local progress and settings (the in-app "Daten löschen"). */
  resetAll: () => void;
}

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [stats, setStats] = useState<UserStats>(DEFAULT_STATS);
  const [settings, setSettings] = useState<AppSettings>(getDefaultSettings);
  const [insights, setInsights] = useState<LearningInsights>(DEFAULT_INSIGHTS);
  const [updatedAt, setUpdatedAt] = useState(0);

  // Load local progress. Every value is normalized, so corrupt storage falls back to defaults.
  useEffect(() => {
    let isMounted = true;
    void (async () => {
      const storedSettings = normalizeSettings(await readJson<unknown>(STORAGE_KEYS.settings, null));
      const storedStats = reconcileStreak(normalizeStats(await readJson<unknown>(STORAGE_KEYS.stats, null)), storedSettings.timeZone);
      const storedInsights = normalizeInsights(await readJson<unknown>(STORAGE_KEYS.insights, null));
      const storedUpdatedAt = Number(await readJson<unknown>(STORAGE_KEYS.updatedAt, 0)) || 0;
      if (!isMounted) return;
      setSettings(storedSettings);
      setStats(storedStats);
      setInsights(storedInsights);
      setUpdatedAt(storedUpdatedAt);
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

  const exportSnapshot = useCallback(
    (): CloudProgressSnapshot => ({ schemaVersion: PROGRESS_SCHEMA_VERSION, stats, settings, learningInsights: insights, updatedAt: updatedAt || Date.now() }),
    [insights, settings, stats, updatedAt],
  );

  const importSnapshot = useCallback((input: unknown) => {
    const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : null;
    if (!raw || !raw.stats || !raw.learningInsights) return { ok: false, message: "Das ist keine Lingo-Pro-Sicherung." };
    const incoming = normalizeProgressSnapshot(raw);
    const local: CloudProgressSnapshot = { schemaVersion: PROGRESS_SCHEMA_VERSION, stats, settings, learningInsights: insights, updatedAt };
    const merged = mergeProgressSnapshots(local, incoming);
    const nextSettings = normalizeSettings(merged.snapshot.settings);
    setSettings(nextSettings);
    setStats(reconcileStreak(normalizeStats(merged.snapshot.stats), nextSettings.timeZone));
    setInsights(normalizeInsights(merged.snapshot.learningInsights));
    setUpdatedAt(Date.now());
    const words = merged.snapshot.stats.learnedWords;
    return { ok: true, message: merged.localChanged ? `Sicherung übernommen: ${merged.snapshot.stats.xp} XP, ${words} gelernte Wörter.` : "Die Sicherung enthielt nichts Neues." };
  }, [insights, settings, stats, updatedAt]);

  const resetAll = useCallback(() => {
    setStats(DEFAULT_STATS);
    setSettings(getDefaultSettings());
    setInsights(DEFAULT_INSIGHTS);
    setUpdatedAt(Date.now());
  }, []);

  const value = useMemo<AppState>(() => ({
    isLoaded, stats, settings, insights,
    updateStats, updateSettings, updateInsights, awardAnswer, todayKey, exportSnapshot, importSnapshot, resetAll,
  }), [awardAnswer, exportSnapshot, importSnapshot, insights, isLoaded, resetAll, settings, stats, todayKey, updateInsights, updateSettings, updateStats]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) throw new Error("useAppState must be used inside AppStateProvider");
  return context;
};

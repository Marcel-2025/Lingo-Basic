"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CloudSyncError, loadCloudProgress, saveCloudProgress } from "@/app/lib/cloud-sync";
import { mergeProgressSnapshots } from "@/app/lib/progress";
import { readStoredJson, STORAGE_KEYS, writeStoredJson } from "@/app/lib/storage";
import type { AuthUser, CloudProgressSnapshot } from "@/app/lib/types";

export type CloudSyncStatus = "offline" | "loading" | "ready" | "syncing" | "pending" | "error";

interface UseCloudSyncOptions {
  user: AuthUser | null;
  isReady: boolean;
  snapshot: CloudProgressSnapshot;
  applyCloudSnapshot: (snapshot: CloudProgressSnapshot) => void;
  updateUser: (user: AuthUser) => void;
  onSessionExpired: (message: string) => void;
}

interface SyncMarker {
  uid: string;
  /** `updatedAt` of the last snapshot that is known to be stored in Firestore. */
  syncedAt: number;
}

const SAVE_DEBOUNCE_MS = 1200;
const RETRY_DELAYS_MS = [5_000, 15_000, 60_000, 180_000];

const readSyncedAt = (uid: string) => {
  const marker = readStoredJson<Partial<SyncMarker> | null>(STORAGE_KEYS.syncMarker, null);
  return marker?.uid === uid && typeof marker.syncedAt === "number" ? marker.syncedAt : 0;
};

/**
 * Optional Firestore sync for logged-in users.
 * - Local state is always written first (useProgress); the cloud is a debounced mirror.
 * - On login, local and cloud are merged without dropping history (see mergeProgressSnapshots).
 * - Failed uploads stay "pending": the marker in LocalStorage survives reloads and retries run with backoff
 *   and whenever the browser comes back online.
 */
export const useCloudSync = ({ user, isReady, snapshot, applyCloudSnapshot, updateUser, onSessionExpired }: UseCloudSyncOptions) => {
  const [status, setStatus] = useState<CloudSyncStatus>("offline");
  const [message, setMessage] = useState("");
  const [retryToken, setRetryToken] = useState(0);
  const snapshotRef = useRef(snapshot);
  const userRef = useRef(user);
  const hydratedUidRef = useRef<string | null>(null);
  const isRunningRef = useRef(false);
  const retryCountRef = useRef(0);
  const callbacksRef = useRef({ applyCloudSnapshot, updateUser, onSessionExpired });
  const userId = user?.localId ?? null;

  useEffect(() => {
    snapshotRef.current = snapshot;
    userRef.current = user;
    callbacksRef.current = { applyCloudSnapshot, updateUser, onSessionExpired };
  });

  const markSynced = (uid: string, syncedAt: number) => writeStoredJson<SyncMarker>(STORAGE_KEYS.syncMarker, { uid, syncedAt });

  const handleError = useCallback((error: unknown) => {
    const syncError = error instanceof CloudSyncError ? error : new CloudSyncError("Cloud-Sync ist nicht verfügbar.", true);
    if (syncError.sessionExpired) {
      setStatus("error");
      setMessage(syncError.message);
      callbacksRef.current.onSessionExpired(syncError.message);
      return;
    }
    if (syncError.retryable) {
      setStatus("pending");
      setMessage(syncError.message);
      const delay = RETRY_DELAYS_MS[Math.min(retryCountRef.current, RETRY_DELAYS_MS.length - 1)];
      retryCountRef.current += 1;
      window.setTimeout(() => setRetryToken((value) => value + 1), delay);
      return;
    }
    setStatus("error");
    setMessage(syncError.message);
  }, []);

  const runSync = useCallback(async () => {
    const sessionUser = userRef.current;
    if (!sessionUser || isRunningRef.current) return;
    isRunningRef.current = true;
    const onUserRefreshed = (nextUser: AuthUser) => {
      userRef.current = nextUser;
      callbacksRef.current.updateUser(nextUser);
    };
    try {
      if (hydratedUidRef.current !== sessionUser.localId) {
        setStatus("loading");
        const cloud = await loadCloudProgress(sessionUser, onUserRefreshed);
        const local = snapshotRef.current;
        if (!cloud) {
          const firstSnapshot = { ...local, updatedAt: local.updatedAt || Date.now() };
          await saveCloudProgress(userRef.current ?? sessionUser, firstSnapshot, onUserRefreshed);
          markSynced(sessionUser.localId, firstSnapshot.updatedAt);
        } else {
          const merged = mergeProgressSnapshots(local, { ...cloud, schemaVersion: cloud.storedSchemaVersion });
          if (merged.localChanged) callbacksRef.current.applyCloudSnapshot(merged.snapshot);
          if (merged.cloudChanged) await saveCloudProgress(userRef.current ?? sessionUser, merged.snapshot, onUserRefreshed);
          markSynced(sessionUser.localId, merged.snapshot.updatedAt);
        }
        hydratedUidRef.current = sessionUser.localId;
      } else {
        const current = snapshotRef.current;
        if (current.updatedAt > readSyncedAt(sessionUser.localId)) {
          setStatus("syncing");
          await saveCloudProgress(userRef.current ?? sessionUser, current, onUserRefreshed);
          markSynced(sessionUser.localId, current.updatedAt);
        }
      }
      retryCountRef.current = 0;
      setMessage("");
      // Another change may have arrived while the request was running.
      setStatus(snapshotRef.current.updatedAt > readSyncedAt(sessionUser.localId) ? "pending" : "ready");
    } catch (error) {
      handleError(error);
    } finally {
      isRunningRef.current = false;
    }
  }, [handleError]);

  // Hydrate after login / session restore, and on manual or scheduled retries.
  useEffect(() => {
    if (!isReady || !userId) {
      hydratedUidRef.current = null;
      return;
    }
    const timeoutId = window.setTimeout(() => void runSync(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [isReady, retryToken, runSync, userId]);

  // Debounced upload of local changes.
  useEffect(() => {
    if (!isReady || !userId || hydratedUidRef.current !== userId) return;
    if (snapshot.updatedAt === 0 || snapshot.updatedAt <= readSyncedAt(userId)) return;
    const timeoutId = window.setTimeout(() => void runSync(), SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [isReady, runSync, snapshot.updatedAt, userId]);

  // Retry immediately when the connection returns.
  useEffect(() => {
    if (!userId) return;
    const handleOnline = () => {
      retryCountRef.current = 0;
      setRetryToken((value) => value + 1);
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [userId]);

  const retry = useCallback(() => {
    retryCountRef.current = 0;
    setRetryToken((value) => value + 1);
  }, []);

  return { status: user ? status : ("offline" as const), message: user ? message : "", retry };
};

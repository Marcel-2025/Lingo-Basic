"use client";

import { useEffect, useRef, useState } from "react";
import { loadCloudProgress, saveCloudProgress, selectNewerProgress } from "@/app/lib/cloud-sync";
import { ensureFreshAuthToken } from "@/app/lib/firebase-auth";
import type { AuthUser, CloudProgressSnapshot } from "@/app/lib/types";

export type CloudSyncStatus = "offline" | "loading" | "ready" | "syncing" | "error";

interface UseCloudSyncOptions {
  user: AuthUser | null;
  isReady: boolean;
  snapshot: CloudProgressSnapshot;
  applyCloudSnapshot: (snapshot: CloudProgressSnapshot) => void;
  updateUser: (user: AuthUser) => void;
}

export const useCloudSync = ({ user, isReady, snapshot, applyCloudSnapshot, updateUser }: UseCloudSyncOptions) => {
  const [status, setStatus] = useState<CloudSyncStatus>("offline");
  const [message, setMessage] = useState("");
  const snapshotRef = useRef(snapshot);
  const savedAtRef = useRef(0);
  const userRef = useRef(user);
  const userId = user?.localId;

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    if (!isReady || !userId) return;
    let isMounted = true;
    const hydrate = async () => {
      setStatus("loading");
      setMessage("");
      try {
        const sessionUser = userRef.current;
        if (!sessionUser) return;
        const freshUser = await ensureFreshAuthToken(sessionUser);
        if (!isMounted) return;
        if (freshUser.idToken !== sessionUser.idToken) updateUser(freshUser);
        const cloud = await loadCloudProgress(freshUser);
        if (!isMounted) return;
        const local = snapshotRef.current;
        if (!cloud) {
          const firstSnapshot = { ...local, updatedAt: local.updatedAt || Date.now() };
          await saveCloudProgress(freshUser, firstSnapshot);
          savedAtRef.current = firstSnapshot.updatedAt;
        } else {
          const selected = selectNewerProgress(local, cloud);
          if (selected.source === "cloud") applyCloudSnapshot(selected.snapshot);
          else await saveCloudProgress(freshUser, selected.snapshot);
          savedAtRef.current = selected.snapshot.updatedAt;
        }
        if (isMounted) setStatus("ready");
      } catch (error) {
        if (isMounted) {
          setStatus("error");
          setMessage(error instanceof Error ? error.message : "Cloud-Sync ist nicht verfügbar.");
        }
      }
    };
    void hydrate();
    return () => {
      isMounted = false;
    };
  }, [applyCloudSnapshot, isReady, updateUser, userId]);

  useEffect(() => {
    if (!user || !isReady || status !== "ready" || snapshot.updatedAt === 0 || snapshot.updatedAt === savedAtRef.current) return;
    const timeoutId = window.setTimeout(async () => {
      setStatus("syncing");
      try {
        const freshUser = await ensureFreshAuthToken(user);
        if (freshUser.idToken !== user.idToken) updateUser(freshUser);
        await saveCloudProgress(freshUser, snapshotRef.current);
        savedAtRef.current = snapshotRef.current.updatedAt;
        setStatus("ready");
      } catch (error) {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Cloud-Sync ist nicht verfügbar.");
      }
    }, 600);
    return () => window.clearTimeout(timeoutId);
  }, [isReady, snapshot.updatedAt, status, updateUser, user]);

  return { status: user ? status : "offline", message };
};

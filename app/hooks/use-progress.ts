"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { normalizeInsights, normalizeSettings, normalizeStats } from "@/app/lib/progress";
import { DEFAULT_INSIGHTS, DEFAULT_STATS, getDefaultSettings, PROGRESS_SCHEMA_VERSION } from "@/app/lib/defaults";
import { getDateKey, reconcileStreak } from "@/app/lib/utils";
import { readStoredJson, readStoredNumber, STORAGE_KEYS, writeStoredJson, writeStoredNumber } from "@/app/lib/storage";
import type { AppSettings, CloudProgressSnapshot, LearningInsights, UserStats } from "@/app/lib/types";

export const useProgress = () => {
  const [stats, setStats] = useState<UserStats>(DEFAULT_STATS);
  const [settings, setSettings] = useState<AppSettings>(getDefaultSettings);
  const [learningInsights, setLearningInsights] = useState<LearningInsights>(DEFAULT_INSIGHTS);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const hydrate = async () => {
      await Promise.resolve();
      if (!isMounted) return;
      // Every stored value is normalized: corrupt or outdated LocalStorage data falls back to defaults instead of crashing.
      const storedSettings = normalizeSettings(readStoredJson<unknown>(STORAGE_KEYS.settings, null));
      const storedStats = reconcileStreak(normalizeStats(readStoredJson<unknown>(STORAGE_KEYS.stats, null)), storedSettings.timeZone);
      setSettings(storedSettings);
      setStats(storedStats);
      setLearningInsights(normalizeInsights(readStoredJson<unknown>(STORAGE_KEYS.insights, null)));
      setUpdatedAt(readStoredNumber(STORAGE_KEYS.updatedAt));
      setIsLoaded(true);
    };
    void hydrate();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    writeStoredJson(STORAGE_KEYS.stats, stats);
    writeStoredJson(STORAGE_KEYS.settings, settings);
    writeStoredJson(STORAGE_KEYS.insights, learningInsights);
    writeStoredNumber(STORAGE_KEYS.updatedAt, updatedAt);
  }, [isLoaded, learningInsights, settings, stats, updatedAt]);

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
    setLearningInsights(updater);
    markChanged();
  }, [markChanged]);

  const applyCloudSnapshot = useCallback((snapshot: CloudProgressSnapshot) => {
    const nextSettings = normalizeSettings(snapshot.settings);
    setStats(reconcileStreak(normalizeStats(snapshot.stats), nextSettings.timeZone));
    setSettings(nextSettings);
    setLearningInsights(normalizeInsights(snapshot.learningInsights));
    setUpdatedAt(snapshot.updatedAt);
  }, []);

  const snapshot = useMemo<CloudProgressSnapshot>(() => ({
    schemaVersion: PROGRESS_SCHEMA_VERSION,
    stats,
    settings,
    learningInsights,
    updatedAt,
  }), [learningInsights, settings, stats, updatedAt]);

  const getTodayKey = useCallback(() => getDateKey(new Date(), settings.timeZone), [settings.timeZone]);

  return {
    stats,
    settings,
    learningInsights,
    updatedAt,
    isLoaded,
    snapshot,
    updateStats,
    updateSettings,
    updateInsights,
    applyCloudSnapshot,
    getTodayKey,
  };
};

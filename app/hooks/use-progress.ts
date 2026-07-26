"use client";

import { useCallback, useEffect, useState } from "react";
import { normalizeInsights, normalizeSettings, normalizeStats } from "@/app/lib/cloud-sync";
import { DEFAULT_INSIGHTS, DEFAULT_STATS, getDefaultSettings, PROGRESS_SCHEMA_VERSION } from "@/app/lib/defaults";
import { getDateKey, reconcileStreak } from "@/app/lib/utils";
import { readStoredJson, readStoredNumber, STORAGE_KEYS, writeStoredJson, writeStoredNumber } from "@/app/lib/storage";
import type { AppSettings, CloudProgressSnapshot, LearningInsights, UserStats } from "@/app/lib/types";

const migrateInsights = (value: unknown): LearningInsights => {
  const normalized = normalizeInsights(value as Partial<LearningInsights> | undefined);
  const learnedWordsByTopic = Object.fromEntries(
    Object.entries(normalized.learnedWordsByTopic).map(([topicId, entries]) => [
      topicId,
      Array.isArray(entries)
        ? entries.map((entry, index) => {
            if (typeof entry === "string") {
              return { id: `legacy_${topicId}_${index + 1}`, de: entry, x: "" };
            }
            return entry;
          })
        : [],
    ]),
  );
  return { ...normalized, learnedWordsByTopic };
};

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
      const storedSettings = normalizeSettings(readStoredJson(STORAGE_KEYS.settings, getDefaultSettings()));
      const storedStats = reconcileStreak(
        normalizeStats(readStoredJson(STORAGE_KEYS.stats, DEFAULT_STATS)),
        storedSettings.timeZone,
      );
      setSettings(storedSettings);
      setStats(storedStats);
      setLearningInsights(migrateInsights(readStoredJson(STORAGE_KEYS.insights, DEFAULT_INSIGHTS)));
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
    setStats(normalizeStats(snapshot.stats));
    setSettings(normalizeSettings(snapshot.settings));
    setLearningInsights(migrateInsights(snapshot.learningInsights));
    setUpdatedAt(snapshot.updatedAt);
  }, []);

  const snapshot: CloudProgressSnapshot = {
    schemaVersion: PROGRESS_SCHEMA_VERSION,
    stats,
    settings,
    learningInsights,
    updatedAt,
  };

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
    getTodayKey: () => getDateKey(new Date(), settings.timeZone),
  };
};

import { PROGRESS_SCHEMA_VERSION } from "@/app/lib/defaults";
import { normalizeProgressSnapshot } from "@/app/lib/progress";
import type { CloudProgressSnapshot } from "@/app/lib/types";

/**
 * Firestore layout of `userProgress/{uid}`, shared by the web app (Firebase JS SDK) and the native app
 * (React Native Firebase). Stats, settings and insights are JSON strings so the schema can evolve without migrations.
 */
export const USER_PROGRESS_COLLECTION = "userProgress";

/** Exact document layout; must match `firestore.rules`. */
export interface UserProgressDocument {
  schemaVersion: number;
  statsJson: string;
  settingsJson: string;
  learningInsightsJson: string;
  updatedAt: number;
}

const parseJson = (value: unknown): unknown => {
  if (typeof value !== "string" || !value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

export const parseProgressDocument = (data: Partial<Record<keyof UserProgressDocument, unknown>>): CloudProgressSnapshot & { storedSchemaVersion: number } => {
  const snapshot = normalizeProgressSnapshot({
    stats: parseJson(data.statsJson),
    settings: parseJson(data.settingsJson),
    learningInsights: parseJson(data.learningInsightsJson),
    updatedAt: Number(data.updatedAt ?? 0),
  });
  return { ...snapshot, storedSchemaVersion: Number(data.schemaVersion ?? 1) || 1 };
};

export const toProgressDocument = (snapshot: CloudProgressSnapshot): UserProgressDocument => ({
  schemaVersion: PROGRESS_SCHEMA_VERSION,
  statsJson: JSON.stringify(snapshot.stats),
  settingsJson: JSON.stringify(snapshot.settings),
  learningInsightsJson: JSON.stringify(snapshot.learningInsights),
  updatedAt: Math.round(snapshot.updatedAt),
});

import { DEFAULT_INSIGHTS, DEFAULT_STATS, getDefaultSettings, PROGRESS_SCHEMA_VERSION } from "@/app/lib/defaults";
import { getFirebaseProjectId } from "@/app/lib/firebase-auth";
import type { AuthUser, CloudProgressSnapshot, LearningInsights, UserStats, AppSettings } from "@/app/lib/types";

type FirestoreFields = Record<string, { stringValue?: string; integerValue?: string }>;

const getProgressDocUrl = (uid: string) => {
  const projectId = getFirebaseProjectId();
  if (!projectId) throw new Error("Firebase ist nicht konfiguriert. NEXT_PUBLIC_FIREBASE_PROJECT_ID fehlt.");
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/userProgress/${uid}`;
};

const parseJson = <T,>(value: string | undefined, fallback: T) => {
  try {
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const normalizeStats = (input: Partial<UserStats> | undefined): UserStats => ({
  ...DEFAULT_STATS,
  ...input,
  xp: Number.isFinite(input?.xp) ? Math.max(0, Number(input?.xp)) : DEFAULT_STATS.xp,
  level: Number.isFinite(input?.level) ? Math.max(1, Number(input?.level)) : DEFAULT_STATS.level,
});

export const normalizeSettings = (input: Partial<AppSettings> | undefined): AppSettings => ({
  ...getDefaultSettings(),
  ...input,
});

export const normalizeInsights = (input: Partial<LearningInsights> | undefined): LearningInsights => ({
  ...DEFAULT_INSIGHTS,
  ...input,
  learnedDays: input?.learnedDays && typeof input.learnedDays === "object" ? input.learnedDays : {},
  learnedWordsByTopic: input?.learnedWordsByTopic && typeof input.learnedWordsByTopic === "object" ? input.learnedWordsByTopic : {},
  masteredWordIds: Array.isArray(input?.masteredWordIds) ? input.masteredWordIds : [],
});

export const normalizeCloudSnapshot = (input: Partial<CloudProgressSnapshot>): CloudProgressSnapshot => ({
  schemaVersion: Number(input.schemaVersion) || PROGRESS_SCHEMA_VERSION,
  stats: normalizeStats(input.stats),
  settings: normalizeSettings(input.settings),
  learningInsights: normalizeInsights(input.learningInsights),
  updatedAt: Number.isFinite(input.updatedAt) ? Number(input.updatedAt) : 0,
});

export const loadCloudProgress = async (user: AuthUser): Promise<CloudProgressSnapshot | null> => {
  const response = await fetch(getProgressDocUrl(user.localId), {
    headers: { Authorization: `Bearer ${user.idToken}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Cloud-Fortschritt konnte nicht geladen werden.");

  const data = (await response.json()) as { fields?: FirestoreFields };
  const fields = data.fields ?? {};
  return normalizeCloudSnapshot({
    schemaVersion: Number(fields.schemaVersion?.integerValue ?? 1),
    stats: parseJson<UserStats>(fields.statsJson?.stringValue, DEFAULT_STATS),
    settings: parseJson<AppSettings>(fields.settingsJson?.stringValue, getDefaultSettings()),
    learningInsights: parseJson<LearningInsights>(fields.learningInsightsJson?.stringValue, DEFAULT_INSIGHTS),
    updatedAt: Number(fields.updatedAt?.integerValue ?? 0),
  });
};

export const saveCloudProgress = async (user: AuthUser, snapshot: CloudProgressSnapshot) => {
  const fieldPaths = ["schemaVersion", "statsJson", "settingsJson", "learningInsightsJson", "updatedAt"];
  const query = fieldPaths.map((field) => `updateMask.fieldPaths=${field}`).join("&");
  const response = await fetch(`${getProgressDocUrl(user.localId)}?${query}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.idToken}` },
    body: JSON.stringify({
      fields: {
        schemaVersion: { integerValue: String(snapshot.schemaVersion) },
        statsJson: { stringValue: JSON.stringify(snapshot.stats) },
        settingsJson: { stringValue: JSON.stringify(snapshot.settings) },
        learningInsightsJson: { stringValue: JSON.stringify(snapshot.learningInsights) },
        updatedAt: { integerValue: String(snapshot.updatedAt) },
      },
    }),
  });
  if (!response.ok) throw new Error("Cloud-Fortschritt konnte nicht gespeichert werden.");
};

export const selectNewerProgress = (local: CloudProgressSnapshot, cloud: CloudProgressSnapshot) =>
  local.updatedAt > cloud.updatedAt ? { source: "local" as const, snapshot: local } : { source: "cloud" as const, snapshot: cloud };

import { PROGRESS_SCHEMA_VERSION } from "@/app/lib/defaults";
import { AuthRequestError, ensureFreshAuthToken, getFirebaseProjectId, isNetworkAuthError } from "@/app/lib/firebase-auth";
import { normalizeProgressSnapshot } from "@/app/lib/progress";
import type { AuthUser, CloudProgressSnapshot } from "@/app/lib/types";

/**
 * Firestore REST access for `userProgress/{uid}`.
 * Stats, settings and insights are stored as JSON strings so the schema can evolve without Firestore field mapping.
 * Every read is normalized, so missing or corrupt fields fall back to defaults.
 */

type FirestoreFields = Record<string, { stringValue?: string; integerValue?: string }>;

export class CloudSyncError extends Error {
  constructor(message: string, readonly retryable: boolean, readonly sessionExpired = false) {
    super(message);
    this.name = "CloudSyncError";
  }
}

const getProgressDocUrl = (uid: string) => {
  const projectId = getFirebaseProjectId();
  if (!projectId) throw new CloudSyncError("Firebase ist nicht konfiguriert. NEXT_PUBLIC_FIREBASE_PROJECT_ID fehlt.", false);
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/userProgress/${encodeURIComponent(uid)}`;
};

const parseJson = (value: string | undefined): unknown => {
  try {
    return value ? JSON.parse(value) : undefined;
  } catch {
    return undefined;
  }
};

export const parseFirestoreProgress = (fields: FirestoreFields): CloudProgressSnapshot & { storedSchemaVersion: number } => {
  const snapshot = normalizeProgressSnapshot({
    stats: parseJson(fields.statsJson?.stringValue),
    settings: parseJson(fields.settingsJson?.stringValue),
    learningInsights: parseJson(fields.learningInsightsJson?.stringValue),
    updatedAt: Number(fields.updatedAt?.integerValue ?? 0),
  });
  return { ...snapshot, storedSchemaVersion: Number(fields.schemaVersion?.integerValue ?? 1) || 1 };
};

export const toFirestoreFields = (snapshot: CloudProgressSnapshot) => ({
  schemaVersion: { integerValue: String(PROGRESS_SCHEMA_VERSION) },
  statsJson: { stringValue: JSON.stringify(snapshot.stats) },
  settingsJson: { stringValue: JSON.stringify(snapshot.settings) },
  learningInsightsJson: { stringValue: JSON.stringify(snapshot.learningInsights) },
  updatedAt: { integerValue: String(Math.round(snapshot.updatedAt)) },
});

/**
 * Performs a Firestore request with a fresh ID token. On 401/403 the token is force-refreshed once,
 * because a token can be revoked or expire between the expiry check and the request.
 */
const authorizedRequest = async (
  user: AuthUser,
  onUserRefreshed: (user: AuthUser) => void,
  buildRequest: (idToken: string) => [string, RequestInit],
) => {
  let sessionUser = await ensureFreshAuthToken(user);
  if (sessionUser !== user) onUserRefreshed(sessionUser);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const [url, init] = buildRequest(sessionUser.idToken);
    let response: Response;
    try {
      response = await fetch(url, init);
    } catch {
      throw new CloudSyncError("Offline – Änderungen werden lokal gepuffert.", true);
    }
    if ((response.status === 401 || response.status === 403) && attempt === 0) {
      sessionUser = await ensureFreshAuthToken(sessionUser, true);
      onUserRefreshed(sessionUser);
      continue;
    }
    return response;
  }
  throw new CloudSyncError("Keine Berechtigung für den Cloud-Speicher. Prüfe die Firestore-Regeln.", false);
};

const toSyncError = (error: unknown) => {
  if (error instanceof CloudSyncError) return error;
  if (isNetworkAuthError(error)) return new CloudSyncError("Offline – Änderungen werden lokal gepuffert.", true);
  if (error instanceof AuthRequestError && error.kind === "auth") return new CloudSyncError(error.message, false, true);
  return new CloudSyncError(error instanceof Error ? error.message : "Cloud-Sync ist nicht verfügbar.", false);
};

export const loadCloudProgress = async (user: AuthUser, onUserRefreshed: (user: AuthUser) => void) => {
  try {
    const response = await authorizedRequest(user, onUserRefreshed, (idToken) => [
      getProgressDocUrl(user.localId),
      { headers: { Authorization: `Bearer ${idToken}` } },
    ]);
    if (response.status === 404) return null;
    if (!response.ok) throw new CloudSyncError("Cloud-Fortschritt konnte nicht geladen werden.", response.status >= 500 || response.status === 429);
    const data = (await response.json()) as { fields?: FirestoreFields };
    return parseFirestoreProgress(data.fields ?? {});
  } catch (error) {
    throw toSyncError(error);
  }
};

export const saveCloudProgress = async (user: AuthUser, snapshot: CloudProgressSnapshot, onUserRefreshed: (user: AuthUser) => void) => {
  try {
    const fieldPaths = ["schemaVersion", "statsJson", "settingsJson", "learningInsightsJson", "updatedAt"];
    const query = fieldPaths.map((field) => `updateMask.fieldPaths=${field}`).join("&");
    const response = await authorizedRequest(user, onUserRefreshed, (idToken) => [
      `${getProgressDocUrl(user.localId)}?${query}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ fields: toFirestoreFields(snapshot) }),
      },
    ]);
    if (!response.ok) throw new CloudSyncError("Cloud-Fortschritt konnte nicht gespeichert werden.", response.status >= 500 || response.status === 429);
  } catch (error) {
    throw toSyncError(error);
  }
};

import { FirebaseError } from "firebase/app";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getDb } from "@/app/lib/firebase";
import { parseProgressDocument, toProgressDocument, USER_PROGRESS_COLLECTION } from "@/app/lib/progress-document";
import type { AuthUser, CloudProgressSnapshot } from "@/app/lib/types";

export { parseProgressDocument, toProgressDocument, USER_PROGRESS_COLLECTION, type UserProgressDocument } from "@/app/lib/progress-document";

/**
 * Cloud Firestore (modular SDK) access for `userProgress/{uid}`.
 * Stats, settings and insights are stored as JSON strings so the schema can evolve without migrations;
 * every read is normalized, so missing or corrupt fields fall back to defaults.
 * Authentication and token refresh are handled by the Firebase SDK; writes made offline are queued by the SDK.
 */

const WRITE_ACK_TIMEOUT_MS = 15_000;

export class CloudSyncError extends Error {
  constructor(message: string, readonly retryable: boolean, readonly sessionExpired = false) {
    super(message);
    this.name = "CloudSyncError";
  }
}

const toSyncError = (error: unknown) => {
  if (error instanceof CloudSyncError) return error;
  if (error instanceof FirebaseError) {
    if (error.code === "unauthenticated") return new CloudSyncError("Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.", false, true);
    if (error.code === "permission-denied") return new CloudSyncError("Keine Berechtigung für den Cloud-Speicher. Prüfe die Firestore-Regeln.", false);
    if (["unavailable", "deadline-exceeded", "resource-exhausted", "aborted", "internal"].includes(error.code)) {
      return new CloudSyncError("Offline – Änderungen werden lokal gepuffert.", true);
    }
    if (error.code === "failed-precondition" && /offline/i.test(error.message)) {
      return new CloudSyncError("Offline – Änderungen werden lokal gepuffert.", true);
    }
  }
  return new CloudSyncError(error instanceof Error ? error.message : "Cloud-Sync ist nicht verfügbar.", true);
};

const progressRef = (uid: string) => doc(getDb(), USER_PROGRESS_COLLECTION, uid);

export const loadCloudProgress = async (user: AuthUser) => {
  try {
    const snapshot = await getDoc(progressRef(user.localId));
    return snapshot.exists() ? parseProgressDocument(snapshot.data()) : null;
  } catch (error) {
    throw toSyncError(error);
  }
};

export const saveCloudProgress = async (user: AuthUser, snapshot: CloudProgressSnapshot) => {
  const write = setDoc(progressRef(user.localId), toProgressDocument(snapshot));
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      // The SDK keeps the write queued and sends it once online; the hook only reports it as pending.
      () => reject(new CloudSyncError("Offline – Änderungen werden übertragen, sobald du online bist.", true)),
      WRITE_ACK_TIMEOUT_MS,
    );
  });
  try {
    await Promise.race([write, timeout]);
  } catch (error) {
    throw toSyncError(error);
  } finally {
    clearTimeout(timeoutId);
  }
};

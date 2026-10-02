import { createSign } from "node:crypto";

type FirebaseAccountLookupResponse = { users?: Array<{ localId?: string }> };

type FirestoreValue =
  | { integerValue: string }
  | { nullValue: null }
  | { stringValue: string };

type FirestoreDocument = { fields?: Record<string, FirestoreValue> };

interface FirebaseServiceAccount {
  clientEmail: string;
  privateKey: string;
  projectId: string;
}

let cachedAccessToken: { expiresAt: number; value: string } | null = null;

const getServiceAccount = (): FirebaseServiceAccount => {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const missingVariables = [
    !projectId && "FIREBASE_ADMIN_PROJECT_ID",
    !clientEmail && "FIREBASE_ADMIN_CLIENT_EMAIL",
    !privateKey && "FIREBASE_ADMIN_PRIVATE_KEY",
  ].filter(Boolean);
  if (missingVariables.length) throw new Error(`FIREBASE_ADMIN_CONFIGURATION_MISSING: ${missingVariables.join(", ")}`);
  if (!projectId || !clientEmail || !privateKey) throw new Error("FIREBASE_ADMIN_CONFIGURATION_MISSING");
  return { projectId, clientEmail, privateKey };
};

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

const getFirestoreAccessToken = async () => {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) return cachedAccessToken.value;
  const serviceAccount = getServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const signingInput = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: serviceAccount.clientEmail,
    sub: serviceAccount.clientEmail,
    aud: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/datastore",
    iat: now,
    exp: now + 3600,
  })}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const assertion = `${signingInput}.${signer.sign(serviceAccount.privateKey).toString("base64url")}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`FIREBASE_OAUTH_TOKEN_FAILED: ${response.status}`);

  const result = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!result.access_token) throw new Error("FIREBASE_OAUTH_TOKEN_MISSING");
  cachedAccessToken = { value: result.access_token, expiresAt: Date.now() + (result.expires_in ?? 3600) * 1000 };
  return cachedAccessToken.value;
};

const getFirestoreDocumentUrl = (projectId: string, documentPath: string) =>
  `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${documentPath}`;

const toInteger = (field: FirestoreValue | undefined) => {
  if (!field || !("integerValue" in field)) return 0;
  const value = Number(field.integerValue);
  return Number.isFinite(value) ? value : 0;
};

export const getFirestoreUpdatedAt = async (documentPath: string) => {
  const serviceAccount = getServiceAccount();
  const accessToken = await getFirestoreAccessToken();
  const response = await fetch(getFirestoreDocumentUrl(serviceAccount.projectId, documentPath), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (response.status === 404) return 0;
  if (!response.ok) throw new Error(`FIREBASE_FIRESTORE_READ_FAILED: ${response.status}`);
  return toInteger(((await response.json()) as FirestoreDocument).fields?.updatedAt);
};

export const writeFirestoreDocument = async (documentPath: string, fields: Record<string, FirestoreValue>) => {
  const serviceAccount = getServiceAccount();
  const accessToken = await getFirestoreAccessToken();
  const response = await fetch(getFirestoreDocumentUrl(serviceAccount.projectId, documentPath), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`FIREBASE_FIRESTORE_WRITE_FAILED: ${response.status}`);
};

export const firestoreInteger = (value: number): FirestoreValue => ({ integerValue: String(Math.trunc(value)) });
export const firestoreNull = (): FirestoreValue => ({ nullValue: null });
export const firestoreString = (value: string): FirestoreValue => ({ stringValue: value });

export const verifyFirebaseIdToken = async (idToken: string) => {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new Error("FIREBASE_WEB_API_KEY_MISSING");

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`FIREBASE_ID_TOKEN_INVALID: ${response.status}`);

  const payload = (await response.json()) as FirebaseAccountLookupResponse;
  const uid = payload.users?.[0]?.localId;
  if (!uid) throw new Error("FIREBASE_ID_TOKEN_UID_MISSING");
  return { uid };
};

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const getFirebaseAdminApp = () => {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const missingVariables = [
    !projectId && "FIREBASE_ADMIN_PROJECT_ID",
    !clientEmail && "FIREBASE_ADMIN_CLIENT_EMAIL",
    !privateKey && "FIREBASE_ADMIN_PRIVATE_KEY",
  ].filter(Boolean);
  if (missingVariables.length) {
    throw new Error(`FIREBASE_ADMIN_CONFIGURATION_MISSING: ${missingVariables.join(", ")}`);
  }

  if (!getApps().length) {
    try {
      initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    } catch (error) {
      console.error("FIREBASE_ADMIN_INITIALIZATION_FAILED", {
        error: error instanceof Error ? error.message : "Unbekannter Fehler",
        hasProjectId: Boolean(projectId),
        hasClientEmail: Boolean(clientEmail),
        hasPrivateKey: Boolean(privateKey),
      });
      throw new Error("FIREBASE_ADMIN_INITIALIZATION_FAILED");
    }
  }
  return getApps()[0];
};

export const getFirebaseAdminDb = () => getFirestore(getFirebaseAdminApp());

type FirebaseAccountLookupResponse = { users?: Array<{ localId?: string }> };

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

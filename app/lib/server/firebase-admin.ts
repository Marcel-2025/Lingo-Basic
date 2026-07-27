import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
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

export const verifyFirebaseIdToken = (idToken: string) => getAuth(getFirebaseAdminApp()).verifyIdToken(idToken);

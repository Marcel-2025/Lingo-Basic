import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from "firebase/auth";
import {
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { isNativePlatform } from "@/app/lib/billing";

/**
 * Firebase web configuration for the project `lingo-basic` (Firebase Console → Project settings → Web app
 * "Lingo-Basic"). These values are public identifiers, not secrets; they are still read from environment
 * variables so other environments (staging, forks) can point to their own project.
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

export const isFirebaseConfigured = () => Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.authDomain);
export const getFirebaseProjectId = () => firebaseConfig.projectId;

let auth: Auth | null = null;
let firestore: Firestore | null = null;

/** Lazily initialized so static prerendering (Next.js export) never touches browser-only APIs. */
export const getFirebaseApp = (): FirebaseApp => {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase ist nicht konfiguriert. NEXT_PUBLIC_FIREBASE_API_KEY / _AUTH_DOMAIN / _PROJECT_ID fehlen.");
  }
  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
};

/**
 * Auth persists the session in IndexedDB (fallback LocalStorage), so it survives app restarts and offline starts.
 * Inside the Capacitor WebView no popup resolver is loaded: Google and phone sign-in run natively there and only
 * hand their credential to this SDK.
 */
export const getFirebaseAuth = (): Auth => {
  if (auth) return auth;
  auth = initializeAuth(getFirebaseApp(), {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    ...(isNativePlatform() ? {} : { popupRedirectResolver: browserPopupRedirectResolver }),
  });
  auth.languageCode = "de";
  return auth;
};

/** Firestore with an offline cache: reads work offline and writes are queued until the device is back online. */
export const getDb = (): Firestore => {
  if (firestore) return firestore;
  const app = getFirebaseApp();
  try {
    firestore = initializeFirestore(app, {
      localCache: typeof indexedDB === "undefined"
        ? memoryLocalCache()
        : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    // Persistence can be unavailable (private mode, old WebView). The in-memory cache still works.
    firestore = initializeFirestore(app, { localCache: memoryLocalCache() });
  }
  return firestore;
};

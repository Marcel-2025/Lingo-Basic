import type { AuthUser } from "@/app/lib/types";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
};

interface FirebaseAuthResponse {
  localId?: string;
  email?: string;
  displayName?: string;
  idToken?: string;
  refreshToken?: string;
  expiresIn?: string;
}

interface FirebaseRefreshResponse {
  user_id?: string;
  id_token?: string;
  refresh_token?: string;
  expires_in?: string;
}

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleIdentityApi {
  accounts: {
    id: {
      initialize: (configuration: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void;
      prompt: () => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityApi;
  }
}

let googleScriptPromise: Promise<void> | null = null;
let initializedGoogleClientId = "";
let googleResultHandler: ((response: GoogleCredentialResponse) => void) | null = null;

export const getFirebaseProjectId = () => firebaseConfig.projectId;
export const isFirebaseConfigured = () => Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
export const isGoogleConfigured = () => Boolean(isFirebaseConfigured() && firebaseConfig.googleClientId);

const createAuthUser = (result: FirebaseAuthResponse, fallbackEmail = ""): AuthUser => {
  if (!result.localId || !result.idToken || !result.refreshToken) throw new Error("Firebase hat keine vollständige Sitzung zurückgegeben.");
  const expiresInMs = Math.max(0, Number(result.expiresIn ?? 3600) * 1000);
  return {
    localId: result.localId,
    email: result.email ?? fallbackEmail,
    displayName: result.displayName || result.email || fallbackEmail,
    idToken: result.idToken,
    refreshToken: result.refreshToken,
    expiresAt: Date.now() + expiresInMs,
  };
};

const getFirebaseError = (data: unknown) => {
  const code = typeof data === "object" && data !== null && "error" in data
    ? String((data as { error?: { message?: string } }).error?.message ?? "AUTH_FAILED")
    : "AUTH_FAILED";
  const messages: Record<string, string> = {
    EMAIL_EXISTS: "Diese E-Mail-Adresse wird bereits verwendet.",
    EMAIL_NOT_FOUND: "Kein Konto mit dieser E-Mail-Adresse gefunden.",
    INVALID_PASSWORD: "Das Passwort ist nicht korrekt.",
    INVALID_LOGIN_CREDENTIALS: "E-Mail oder Passwort ist nicht korrekt.",
    INVALID_IDP_RESPONSE: "Die Google-Anmeldung wurde abgelehnt. Prüfe die freigegebene Domain in Firebase.",
    ORIGIN_MISMATCH: "Diese Domain ist nicht für den Google-Login freigegeben.",
    TOKEN_EXPIRED: "Die Sitzung ist abgelaufen. Bitte melde dich erneut an.",
  };
  return messages[code] ?? `Anmeldung fehlgeschlagen (${code}).`;
};

const firebaseAuthRequest = async (endpoint: string, payload: Record<string, unknown>) => {
  if (!firebaseConfig.apiKey) throw new Error("Firebase ist nicht konfiguriert. NEXT_PUBLIC_FIREBASE_API_KEY fehlt.");
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${firebaseConfig.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await response.json()) as FirebaseAuthResponse;
  if (!response.ok) throw new Error(getFirebaseError(data));
  return data;
};

export const authWithEmailAndPassword = async (email: string, password: string, isSignup: boolean) => {
  const endpoint = isSignup ? "accounts:signUp" : "accounts:signInWithPassword";
  const result = await firebaseAuthRequest(endpoint, { email, password, returnSecureToken: true });
  return createAuthUser(result, email);
};

export const authWithGoogleCredential = async (credential: string) => {
  const result = await firebaseAuthRequest("accounts:signInWithIdp", {
    postBody: `id_token=${encodeURIComponent(credential)}&providerId=google.com`,
    requestUri: window.location.origin,
    returnSecureToken: true,
    returnIdpCredential: true,
  });
  return createAuthUser(result);
};

export const refreshAuthToken = async (user: AuthUser): Promise<AuthUser> => {
  if (!firebaseConfig.apiKey) throw new Error("Firebase ist nicht konfiguriert. NEXT_PUBLIC_FIREBASE_API_KEY fehlt.");
  const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${firebaseConfig.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: user.refreshToken }),
  });
  const data = (await response.json()) as FirebaseRefreshResponse;
  if (!response.ok || !data.id_token || !data.refresh_token) throw new Error(getFirebaseError(data));
  return {
    ...user,
    localId: data.user_id ?? user.localId,
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + Math.max(0, Number(data.expires_in ?? 3600) * 1000),
  };
};

export const ensureFreshAuthToken = async (user: AuthUser) => {
  const refreshThreshold = 5 * 60 * 1000;
  return user.expiresAt > Date.now() + refreshThreshold ? user : refreshAuthToken(user);
};

const loadGoogleScript = () => {
  if (googleScriptPromise) return googleScriptPromise;
  googleScriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById("google-identity-script") as HTMLScriptElement | null;
    if (existing && window.google?.accounts.id) {
      resolve();
      return;
    }
    const script = existing ?? document.createElement("script");
    script.id = "google-identity-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Identity Services konnte nicht geladen werden."));
    if (!existing) document.body.appendChild(script);
  });
  return googleScriptPromise;
};

export const requestGoogleCredential = async () => {
  if (!isGoogleConfigured()) {
    throw new Error("Google-Login benötigt NEXT_PUBLIC_GOOGLE_CLIENT_ID und eine Firebase-Konfiguration.");
  }
  await loadGoogleScript();
  const google = window.google;
  if (!google?.accounts.id) throw new Error("Google Identity Services ist noch nicht bereit.");

  return new Promise<string>((resolve, reject) => {
    googleResultHandler = (response) => {
      if (response.credential) resolve(response.credential);
      else reject(new Error("Google hat kein Anmeldetoken zurückgegeben."));
      googleResultHandler = null;
    };

    if (initializedGoogleClientId !== firebaseConfig.googleClientId) {
      google.accounts.id.initialize({
        client_id: firebaseConfig.googleClientId,
        callback: (response) => googleResultHandler?.(response),
      });
      initializedGoogleClientId = firebaseConfig.googleClientId;
    }
    google.accounts.id.prompt();
  });
};

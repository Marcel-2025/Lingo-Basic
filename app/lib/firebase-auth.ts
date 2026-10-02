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

interface GooglePromptNotification {
  isNotDisplayed?: () => boolean;
  getNotDisplayedReason?: () => string;
  isSkippedMoment?: () => boolean;
  getSkippedReason?: () => string;
}

interface GoogleButtonConfiguration {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with";
  shape?: "rectangular" | "pill";
  width?: number;
  locale?: string;
}

interface GoogleIdentityApi {
  accounts: {
    id: {
      initialize: (configuration: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
        cancel_on_tap_outside?: boolean;
      }) => void;
      prompt: (listener?: (notification: GooglePromptNotification) => void) => void;
      renderButton: (element: HTMLElement, configuration: GoogleButtonConfiguration) => void;
      cancel: () => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityApi;
  }
}

/** Distinguishes temporary network problems from real authentication failures. */
export class AuthRequestError extends Error {
  constructor(message: string, readonly kind: "network" | "auth" | "config", readonly code = "") {
    super(message);
    this.name = "AuthRequestError";
  }
}

/** Thrown when Google One Tap cannot be shown; `useButtonFallback` signals that the rendered Google button may still work. */
export class GooglePromptError extends Error {
  constructor(message: string, readonly reason: string, readonly useButtonFallback: boolean) {
    super(message);
    this.name = "GooglePromptError";
  }
}

export const isNetworkAuthError = (error: unknown) => error instanceof AuthRequestError && error.kind === "network";

let googleScriptPromise: Promise<void> | null = null;
let initializedGoogleClientId = "";
let googleCredentialListener: ((response: GoogleCredentialResponse) => void) | null = null;
let pendingGoogleReject: ((error: Error) => void) | null = null;

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

const FIREBASE_ERROR_MESSAGES: Record<string, string> = {
  EMAIL_EXISTS: "Diese E-Mail-Adresse wird bereits verwendet.",
  EMAIL_NOT_FOUND: "Kein Konto mit dieser E-Mail-Adresse gefunden.",
  INVALID_EMAIL: "Die E-Mail-Adresse ist ungültig.",
  INVALID_PASSWORD: "Das Passwort ist nicht korrekt.",
  INVALID_LOGIN_CREDENTIALS: "E-Mail oder Passwort ist nicht korrekt.",
  WEAK_PASSWORD: "Das Passwort muss mindestens 6 Zeichen lang sein.",
  USER_DISABLED: "Dieses Konto wurde deaktiviert.",
  USER_NOT_FOUND: "Das Konto existiert nicht mehr. Bitte melde dich erneut an.",
  TOO_MANY_ATTEMPTS_TRY_LATER: "Zu viele Versuche. Bitte versuche es später erneut.",
  OPERATION_NOT_ALLOWED: "Diese Anmeldemethode ist in Firebase nicht aktiviert.",
  INVALID_IDP_RESPONSE: "Die Google-Anmeldung wurde abgelehnt. Prüfe die freigegebene Domain in Firebase.",
  ORIGIN_MISMATCH: "Diese Domain ist nicht für den Google-Login freigegeben (origin_mismatch).",
  TOKEN_EXPIRED: "Die Sitzung ist abgelaufen. Bitte melde dich erneut an.",
  INVALID_REFRESH_TOKEN: "Die Sitzung ist abgelaufen. Bitte melde dich erneut an.",
};

const getFirebaseErrorCode = (data: unknown) => {
  const raw = typeof data === "object" && data !== null && "error" in data
    ? (data as { error?: { message?: string } | string }).error
    : undefined;
  const message = typeof raw === "string" ? raw : raw?.message ?? "AUTH_FAILED";
  // Firebase sometimes appends details: "WEAK_PASSWORD : Password should be at least 6 characters".
  return String(message).split(" ")[0].toUpperCase();
};

const getFirebaseError = (data: unknown) => {
  const code = getFirebaseErrorCode(data);
  return new AuthRequestError(FIREBASE_ERROR_MESSAGES[code] ?? `Anmeldung fehlgeschlagen (${code}).`, "auth", code);
};

const fetchAuthEndpoint = async (url: string, init: RequestInit) => {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new AuthRequestError("Keine Verbindung zum Anmeldedienst. Bitte prüfe deine Internetverbindung.", "network");
  }
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // Non-JSON error bodies are handled through the status code below.
  }
  if (!response.ok) {
    if (response.status >= 500) throw new AuthRequestError("Der Anmeldedienst ist vorübergehend nicht erreichbar.", "network");
    throw getFirebaseError(data);
  }
  return data;
};

const firebaseAuthRequest = async (endpoint: string, payload: Record<string, unknown>) => {
  if (!firebaseConfig.apiKey) throw new AuthRequestError("Firebase ist nicht konfiguriert. NEXT_PUBLIC_FIREBASE_API_KEY fehlt.", "config");
  return (await fetchAuthEndpoint(`https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${firebaseConfig.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })) as FirebaseAuthResponse;
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
  if (!firebaseConfig.apiKey) throw new AuthRequestError("Firebase ist nicht konfiguriert. NEXT_PUBLIC_FIREBASE_API_KEY fehlt.", "config");
  if (!user.refreshToken) throw new AuthRequestError("Die Sitzung ist abgelaufen. Bitte melde dich erneut an.", "auth", "MISSING_REFRESH_TOKEN");
  const data = (await fetchAuthEndpoint(`https://securetoken.googleapis.com/v1/token?key=${firebaseConfig.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: user.refreshToken }),
  })) as FirebaseRefreshResponse;
  if (!data.id_token || !data.refresh_token) throw getFirebaseError(data);
  return {
    ...user,
    localId: data.user_id ?? user.localId,
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + Math.max(0, Number(data.expires_in ?? 3600) * 1000),
  };
};

/** Refreshes the Firebase ID token five minutes before expiry (ID tokens are valid for one hour). */
export const ensureFreshAuthToken = async (user: AuthUser, force = false) => {
  const refreshThreshold = 5 * 60 * 1000;
  return !force && user.expiresAt > Date.now() + refreshThreshold ? user : refreshAuthToken(user);
};

const loadGoogleScript = () => {
  if (window.google?.accounts.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;
  googleScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById("google-identity-script") as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");
    script.id = "google-identity-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => {
      googleScriptPromise = null;
      script.remove();
      reject(new Error("Google Identity Services konnte nicht geladen werden. Bist du online?"));
    }, { once: true });
    if (!existing) document.body.appendChild(script);
  });
  return googleScriptPromise;
};

/** Loads GIS and initializes it exactly once per client ID. All credentials are routed through one listener. */
const ensureGoogleInitialized = async () => {
  if (!firebaseConfig.googleClientId) {
    throw new AuthRequestError("Google-Login ist nicht konfiguriert: NEXT_PUBLIC_GOOGLE_CLIENT_ID fehlt.", "config");
  }
  if (!isFirebaseConfigured()) {
    throw new AuthRequestError("Google-Login benötigt zusätzlich die Firebase-Konfiguration (API-Key und Projekt-ID).", "config");
  }
  await loadGoogleScript();
  const google = window.google;
  if (!google?.accounts.id) throw new Error("Google Identity Services ist noch nicht bereit.");
  if (initializedGoogleClientId !== firebaseConfig.googleClientId) {
    google.accounts.id.initialize({
      client_id: firebaseConfig.googleClientId,
      callback: (response) => googleCredentialListener?.(response),
      cancel_on_tap_outside: true,
    });
    initializedGoogleClientId = firebaseConfig.googleClientId;
  }
  return google;
};

const GOOGLE_NOT_DISPLAYED_MESSAGES: Record<string, string> = {
  unregistered_origin: "Diese Domain ist nicht als JavaScript-Origin für die Google Client ID freigegeben (origin_mismatch). Trage sie in der Google Cloud Console ein.",
  invalid_client: "Die Google Client ID ist ungültig. Prüfe NEXT_PUBLIC_GOOGLE_CLIENT_ID.",
  missing_client_id: "Google-Login ist nicht konfiguriert: NEXT_PUBLIC_GOOGLE_CLIENT_ID fehlt.",
  secure_http_required: "Google-Login benötigt HTTPS (oder localhost).",
  browser_not_supported: "Dieser Browser unterstützt Google One Tap nicht.",
};

const settlePendingGoogleRequest = () => {
  googleCredentialListener = null;
  pendingGoogleReject = null;
};

export const requestGoogleCredential = async () => {
  const google = await ensureGoogleInitialized();
  pendingGoogleReject?.(new Error("Die vorherige Google-Anmeldung wurde ersetzt."));

  return new Promise<string>((resolve, reject) => {
    pendingGoogleReject = (error) => {
      settlePendingGoogleRequest();
      reject(error);
    };
    googleCredentialListener = (response) => {
      settlePendingGoogleRequest();
      if (response.credential) resolve(response.credential);
      else reject(new Error("Google hat kein Anmeldetoken zurückgegeben."));
    };

    google.accounts.id.prompt((notification) => {
      // With FedCM some of these methods are no longer provided, so every call is optional.
      if (notification.isNotDisplayed?.()) {
        const reason = notification.getNotDisplayedReason?.() ?? "unknown";
        const message = GOOGLE_NOT_DISPLAYED_MESSAGES[reason];
        pendingGoogleReject?.(new GooglePromptError(
          message ?? "Google One Tap ist gerade nicht verfügbar. Nutze den Google-Button unten.",
          reason,
          !message,
        ));
      } else if (notification.isSkippedMoment?.()) {
        const reason = notification.getSkippedReason?.() ?? "unknown";
        pendingGoogleReject?.(new GooglePromptError("Google-Anmeldung wurde abgebrochen. Du kannst den Google-Button unten verwenden.", reason, true));
      }
    });
  });
};

export const cancelGoogleCredentialRequest = () => {
  window.google?.accounts.id.cancel();
  pendingGoogleReject?.(new Error("Google-Anmeldung abgebrochen."));
};

/** Renders the official Google button as a robust fallback when One Tap is suppressed. */
export const renderGoogleButton = async (element: HTMLElement, onCredential: (credential: string) => void) => {
  const google = await ensureGoogleInitialized();
  googleCredentialListener = (response) => {
    if (response.credential) onCredential(response.credential);
  };
  google.accounts.id.renderButton(element, { theme: "outline", size: "large", text: "continue_with", shape: "pill", locale: "de", width: Math.min(element.clientWidth || 320, 400) });
};

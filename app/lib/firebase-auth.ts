import { FirebaseError } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  PhoneAuthProvider,
  RecaptchaVerifier,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { isNativePlatform } from "@/app/lib/billing";
import { getFirebaseAuth, isFirebaseConfigured } from "@/app/lib/firebase";
import type { AuthUser } from "@/app/lib/types";

export { getFirebaseProjectId, isFirebaseConfigured } from "@/app/lib/firebase";

/**
 * Firebase Authentication (modular JS SDK) with three providers:
 * - Email/password: JS SDK on every platform.
 * - Google: popup in the browser; native Credential Manager in the Android app (@capacitor-firebase/authentication,
 *   skipNativeAuth) whose ID token is exchanged for a Firebase session in the JS SDK.
 * - Phone: invisible reCAPTCHA + SMS in the browser; native SMS verification (Play Integrity) in the Android app.
 * The JS SDK is the single source of truth for the session, so Firestore and token refresh work the same everywhere.
 */

export class AuthRequestError extends Error {
  constructor(message: string, readonly kind: "network" | "auth" | "config" | "cancelled", readonly code = "") {
    super(message);
    this.name = "AuthRequestError";
  }
}

export const isNetworkAuthError = (error: unknown) => error instanceof AuthRequestError && error.kind === "network";

export const isGoogleConfigured = () => isFirebaseConfigured();
export const isPhoneConfigured = () => isFirebaseConfigured();

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  "auth/email-already-in-use": "Diese E-Mail-Adresse wird bereits verwendet.",
  "auth/invalid-email": "Die E-Mail-Adresse ist ungültig.",
  "auth/invalid-credential": "E-Mail oder Passwort ist nicht korrekt.",
  "auth/wrong-password": "E-Mail oder Passwort ist nicht korrekt.",
  "auth/user-not-found": "Kein Konto mit dieser E-Mail-Adresse gefunden.",
  "auth/weak-password": "Das Passwort muss mindestens 6 Zeichen lang sein.",
  "auth/user-disabled": "Dieses Konto wurde deaktiviert.",
  "auth/too-many-requests": "Zu viele Versuche. Bitte versuche es später erneut.",
  "auth/operation-not-allowed": "Diese Anmeldemethode ist in Firebase nicht aktiviert.",
  "auth/unauthorized-domain": "Diese Domain ist in Firebase nicht für die Anmeldung freigegeben (Authentication → Settings → Authorized domains).",
  "auth/popup-blocked": "Das Google-Fenster wurde vom Browser blockiert. Bitte Pop-ups erlauben.",
  "auth/popup-closed-by-user": "Google-Anmeldung abgebrochen.",
  "auth/cancelled-popup-request": "Google-Anmeldung abgebrochen.",
  "auth/account-exists-with-different-credential": "Für diese E-Mail existiert bereits ein Konto mit einer anderen Anmeldemethode.",
  "auth/invalid-phone-number": "Die Telefonnummer ist ungültig. Bitte im Format +49 151 2345678 eingeben.",
  "auth/missing-phone-number": "Bitte gib deine Telefonnummer ein.",
  "auth/invalid-verification-code": "Der SMS-Code ist nicht korrekt.",
  "auth/code-expired": "Der SMS-Code ist abgelaufen. Bitte fordere einen neuen an.",
  "auth/quota-exceeded": "Das SMS-Kontingent ist erschöpft. Bitte später erneut versuchen.",
  "auth/captcha-check-failed": "Die reCAPTCHA-Prüfung ist fehlgeschlagen. Bitte erneut versuchen.",
  "auth/invalid-app-credential": "Die App konnte nicht verifiziert werden (reCAPTCHA / Play Integrity). Bitte erneut versuchen.",
  "auth/user-token-expired": "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.",
};

export const toAuthError = (error: unknown): AuthRequestError => {
  if (error instanceof AuthRequestError) return error;
  if (error instanceof FirebaseError) {
    if (error.code === "auth/network-request-failed") {
      return new AuthRequestError("Keine Verbindung zum Anmeldedienst. Bitte prüfe deine Internetverbindung.", "network", error.code);
    }
    const cancelled = error.code === "auth/popup-closed-by-user" || error.code === "auth/cancelled-popup-request";
    return new AuthRequestError(AUTH_ERROR_MESSAGES[error.code] ?? `Anmeldung fehlgeschlagen (${error.code}).`, cancelled ? "cancelled" : "auth", error.code);
  }
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/cancel/i.test(message)) return new AuthRequestError("Anmeldung abgebrochen.", "cancelled");
  if (/developer console|28444|\b10\b/i.test(message)) {
    return new AuthRequestError("Google-Login ist für diese App-Signatur nicht freigegeben. Der SHA-1-Fingerabdruck muss in Firebase hinterlegt sein.", "config");
  }
  if (/no credentials|no.*account/i.test(message)) return new AuthRequestError("Auf diesem Gerät ist kein Google-Konto angemeldet.", "auth");
  return new AuthRequestError(message || "Die Anmeldung ist fehlgeschlagen.", "auth");
};

const requireConfig = () => {
  if (!isFirebaseConfigured()) throw new AuthRequestError("Login ist nicht konfiguriert (Firebase-Umgebungsvariablen fehlen).", "config");
  return getFirebaseAuth();
};

export const toAuthUser = async (user: User): Promise<AuthUser> => {
  const token = await user.getIdTokenResult();
  return {
    localId: user.uid,
    email: user.email ?? "",
    displayName: user.displayName || user.email || user.phoneNumber || undefined,
    phoneNumber: user.phoneNumber ?? undefined,
    idToken: token.token,
    expiresAt: Date.parse(token.expirationTime) || Date.now() + 3_600_000,
  };
};

export const authWithEmailAndPassword = async (email: string, password: string, isSignup: boolean) => {
  const auth = requireConfig();
  try {
    const credential = isSignup
      ? await createUserWithEmailAndPassword(auth, email.trim(), password)
      : await signInWithEmailAndPassword(auth, email.trim(), password);
    return credential.user;
  } catch (error) {
    throw toAuthError(error);
  }
};

export const authWithGoogle = async () => {
  const auth = requireConfig();
  try {
    if (isNativePlatform()) {
      const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
      const result = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
      const idToken = result.credential?.idToken;
      if (!idToken) throw new AuthRequestError("Google hat kein Anmeldetoken zurückgegeben.", "auth");
      return (await signInWithCredential(auth, GoogleAuthProvider.credential(idToken))).user;
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    return (await signInWithPopup(auth, provider)).user;
  } catch (error) {
    throw toAuthError(error);
  }
};

/** Normalizes German-style input ("0151 234…", "0049…") to E.164 ("+49151234…"). */
export const normalizePhoneNumber = (input: string, defaultCountryCode = "+49") => {
  const compact = input.replace(/[\s()/.-]/g, "");
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("00")) return `+${compact.slice(2)}`;
  if (compact.startsWith("0")) return `${defaultCountryCode}${compact.slice(1)}`;
  return compact ? `${defaultCountryCode}${compact}` : "";
};

export interface PhoneVerification {
  /** Confirms the SMS code and signs the user in. */
  confirm: (code: string) => Promise<User>;
  /** Code read automatically from the SMS (Android only), if available. */
  autoRetrievedCode?: string;
}

let recaptchaVerifier: RecaptchaVerifier | null = null;

const resetRecaptcha = () => {
  recaptchaVerifier?.clear();
  recaptchaVerifier = null;
};

const startNativePhoneSignIn = async (phoneNumber: string): Promise<PhoneVerification> => {
  const auth = requireConfig();
  const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
  await FirebaseAuthentication.removeAllListeners();
  return new Promise<PhoneVerification>((resolve, reject) => {
    let verificationId = "";
    const verification: PhoneVerification = {
      confirm: async (code) => {
        if (!verificationId) throw new AuthRequestError("Bitte fordere zuerst einen SMS-Code an.", "auth");
        try {
          return (await signInWithCredential(auth, PhoneAuthProvider.credential(verificationId, code.trim()))).user;
        } catch (error) {
          throw toAuthError(error);
        }
      },
    };
    void FirebaseAuthentication.addListener("phoneCodeSent", (event) => {
      verificationId = event.verificationId;
      resolve(verification);
    });
    void FirebaseAuthentication.addListener("phoneVerificationCompleted", (event) => {
      if (event.verificationCode) verification.autoRetrievedCode = event.verificationCode;
    });
    void FirebaseAuthentication.addListener("phoneVerificationFailed", (event) => {
      reject(toAuthError(new Error(event.message)));
    });
    FirebaseAuthentication.signInWithPhoneNumber({ phoneNumber, skipNativeAuth: true }).catch((error: unknown) => reject(toAuthError(error)));
  });
};

/**
 * Starts phone sign-in and sends the SMS. In the browser an invisible reCAPTCHA is rendered into `recaptchaContainer`
 * (required by Firebase to prevent SMS abuse).
 */
export const startPhoneSignIn = async (rawPhoneNumber: string, recaptchaContainer: HTMLElement | null): Promise<PhoneVerification> => {
  const phoneNumber = normalizePhoneNumber(rawPhoneNumber);
  if (!/^\+[1-9]\d{6,14}$/.test(phoneNumber)) {
    throw new AuthRequestError(AUTH_ERROR_MESSAGES["auth/invalid-phone-number"], "auth", "auth/invalid-phone-number");
  }
  if (isNativePlatform()) return startNativePhoneSignIn(phoneNumber);

  const auth = requireConfig();
  if (!recaptchaContainer) throw new AuthRequestError("reCAPTCHA konnte nicht geladen werden.", "config");
  try {
    resetRecaptcha();
    recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainer, { size: "invisible" });
    const confirmation = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
    return {
      confirm: async (code) => {
        try {
          return (await confirmation.confirm(code.trim())).user;
        } catch (error) {
          throw toAuthError(error);
        } finally {
          resetRecaptcha();
        }
      },
    };
  } catch (error) {
    resetRecaptcha();
    throw toAuthError(error);
  }
};

export const signOutEverywhere = async () => {
  if (!isFirebaseConfigured()) return;
  await signOut(getFirebaseAuth());
  if (isNativePlatform()) {
    try {
      const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
      await FirebaseAuthentication.signOut();
    } catch {
      // The native layer has no session when skipNativeAuth is used; nothing to clean up.
    }
  }
};

import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  getIdToken,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signOut,
  type ConfirmationResult,
  type User,
} from "@react-native-firebase/auth";
import { deleteDoc, doc, getDoc, getFirestore, setDoc } from "@react-native-firebase/firestore";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from "@react-native-google-signin/google-signin";
import { parseProgressDocument, toProgressDocument, USER_PROGRESS_COLLECTION } from "@/app/lib/progress-document";
import type { CloudProgressSnapshot } from "@/app/lib/types";

/**
 * Native Firebase (React Native Firebase, modular API). Configuration comes from google-services.json /
 * GoogleService-Info.plist, so no keys live in the JavaScript code. The session is persisted by the native SDK.
 */

/** OAuth "Web client" of the Firebase project lingo-basic; Google returns ID tokens for this audience. */
const GOOGLE_WEB_CLIENT_ID = "788312123831-sjbea8606vmd5dub0o9lmk9j4aidql5g.apps.googleusercontent.com";

export type FirebaseUser = User;

let googleConfigured = false;
const ensureGoogleConfigured = () => {
  if (googleConfigured) return;
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  googleConfigured = true;
};

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
  "auth/network-request-failed": "Keine Verbindung. Bitte prüfe deine Internetverbindung.",
  "auth/invalid-phone-number": "Die Telefonnummer ist ungültig. Bitte im Format +49 151 2345678 eingeben.",
  "auth/invalid-verification-code": "Der SMS-Code ist nicht korrekt.",
  "auth/session-expired": "Der SMS-Code ist abgelaufen. Bitte fordere einen neuen an.",
  "auth/quota-exceeded": "Das SMS-Kontingent ist erschöpft. Bitte später erneut versuchen.",
  "auth/requires-recent-login": "Bitte melde dich aus Sicherheitsgründen erneut an und lösche das Konto dann direkt danach.",
  "auth/account-exists-with-different-credential": "Für diese E-Mail existiert bereits ein Konto mit einer anderen Anmeldemethode.",
};

export class AuthError extends Error {
  constructor(message: string, readonly code = "") {
    super(message);
    this.name = "AuthError";
  }
}

export const toAuthError = (error: unknown) => {
  if (error instanceof AuthError) return error;
  const code = typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : "";
  if (isErrorWithCode(error)) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) return new AuthError("Google-Anmeldung abgebrochen.", "cancelled");
    if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return new AuthError("Google Play-Dienste sind auf diesem Gerät nicht verfügbar.", error.code);
  }
  if (AUTH_ERROR_MESSAGES[code]) return new AuthError(AUTH_ERROR_MESSAGES[code], code);
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/DEVELOPER_ERROR|developer console|\b10\b/i.test(message)) {
    return new AuthError("Google-Login ist für diese App-Signatur noch nicht freigegeben (SHA-1 in Firebase hinterlegen).", "developer-error");
  }
  return new AuthError(message || "Die Anmeldung ist fehlgeschlagen.", code);
};

const auth = () => getAuth();

export const subscribeToAuth = (listener: (user: FirebaseUser | null) => void) => onAuthStateChanged(auth(), listener);

export const signInWithEmail = async (email: string, password: string, isSignup: boolean) => {
  try {
    return isSignup
      ? await createUserWithEmailAndPassword(auth(), email.trim(), password)
      : await signInWithEmailAndPassword(auth(), email.trim(), password);
  } catch (error) {
    throw toAuthError(error);
  }
};

export const signInWithGoogle = async () => {
  try {
    ensureGoogleConfigured();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) throw new AuthError("Google-Anmeldung abgebrochen.", "cancelled");
    const idToken = response.data.idToken;
    if (!idToken) throw new AuthError("Google hat kein Anmeldetoken zurückgegeben.");
    return await signInWithCredential(auth(), GoogleAuthProvider.credential(idToken));
  } catch (error) {
    throw toAuthError(error);
  }
};

/** Sign in with Apple is only offered on iOS (App Store guideline 4.8 requires it next to Google login). */
export const isAppleSignInAvailable = async () => Platform.OS === "ios" && (await AppleAuthentication.isAvailableAsync());

export const signInWithApple = async () => {
  try {
    // Apple receives the SHA-256 hash of the nonce, Firebase the raw value to verify the token.
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
    const result = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
    if (!result.identityToken) throw new AuthError("Apple hat kein Anmeldetoken zurückgegeben.");
    const credential = new OAuthProvider("apple.com").credential({ idToken: result.identityToken, rawNonce });
    return await signInWithCredential(auth(), credential);
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && (error as { code: unknown }).code === "ERR_REQUEST_CANCELED") {
      throw new AuthError("Apple-Anmeldung abgebrochen.", "cancelled");
    }
    throw toAuthError(error);
  }
};

/** Normalizes German-style input ("0151 …", "0049 …") to E.164 ("+49151…"). */
export const normalizePhoneNumber = (input: string, defaultCountryCode = "+49") => {
  const compact = input.replace(/[\s()/.-]/g, "");
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("00")) return `+${compact.slice(2)}`;
  if (compact.startsWith("0")) return `${defaultCountryCode}${compact.slice(1)}`;
  return compact ? `${defaultCountryCode}${compact}` : "";
};

/** Sends the SMS; Android verifies the device natively (Play Integrity) and may read the code automatically. */
export const startPhoneSignIn = async (rawPhoneNumber: string): Promise<ConfirmationResult> => {
  const phoneNumber = normalizePhoneNumber(rawPhoneNumber);
  if (!/^\+[1-9]\d{6,14}$/.test(phoneNumber)) throw new AuthError(AUTH_ERROR_MESSAGES["auth/invalid-phone-number"], "auth/invalid-phone-number");
  try {
    return await signInWithPhoneNumber(auth(), phoneNumber);
  } catch (error) {
    throw toAuthError(error);
  }
};

export const confirmPhoneCode = async (confirmation: ConfirmationResult, code: string) => {
  try {
    return await confirmation.confirm(code.trim());
  } catch (error) {
    throw toAuthError(error);
  }
};

export const signOutEverywhere = async () => {
  try {
    ensureGoogleConfigured();
    await GoogleSignin.signOut();
  } catch {
    // Not signed in with Google.
  }
  await signOut(auth());
};

// ---------------------------------------------------------------------------
// Firestore: userProgress/{uid}
// ---------------------------------------------------------------------------

const progressRef = (uid: string) => doc(getFirestore(), USER_PROGRESS_COLLECTION, uid);

export const loadCloudProgress = async (uid: string) => {
  const snapshot = await getDoc(progressRef(uid));
  return snapshot.exists() ? parseProgressDocument(snapshot.data() ?? {}) : null;
};

export const saveCloudProgress = async (uid: string, snapshot: CloudProgressSnapshot) => {
  await setDoc(progressRef(uid), toProgressDocument(snapshot));
};

/**
 * Deletes the account and all cloud data (Google Play / App Store requirement for apps with account creation).
 * Firestore data is removed first while the user is still authenticated.
 */
export const deleteAccount = async () => {
  const user = auth().currentUser;
  if (!user) return;
  try {
    await getIdToken(user, true);
    await deleteDoc(progressRef(user.uid));
    await deleteUser(user);
    await signOutEverywhere().catch(() => undefined);
  } catch (error) {
    throw toAuthError(error);
  }
};

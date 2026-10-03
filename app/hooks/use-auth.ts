"use client";

import { useCallback, useEffect, useState } from "react";
import { onIdTokenChanged } from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "@/app/lib/firebase";
import {
  authWithEmailAndPassword,
  authWithGoogle,
  startPhoneSignIn,
  signOutEverywhere,
  toAuthUser,
  type PhoneVerification,
} from "@/app/lib/firebase-auth";
import { removeStoredValue, STORAGE_KEYS } from "@/app/lib/storage";
import type { AuthUser } from "@/app/lib/types";

/**
 * Session state from the Firebase Auth SDK. `onIdTokenChanged` fires on sign-in, sign-out and every automatic
 * token refresh, so `user.idToken` is always current. The SDK persists the session in IndexedDB, which also covers
 * offline restarts. Guest mode (no user) keeps working without any Firebase configuration.
 */
export const useAuth = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Sessions of the former REST implementation are not reusable with the SDK.
    removeStoredValue(STORAGE_KEYS.authUser);
    if (!isFirebaseConfigured()) {
      const timeoutId = window.setTimeout(() => setIsReady(true), 0);
      return () => window.clearTimeout(timeoutId);
    }
    let isMounted = true;
    const unsubscribe = onIdTokenChanged(getFirebaseAuth(), async (firebaseUser) => {
      if (!firebaseUser) {
        if (isMounted) {
          setUser(null);
          setIsReady(true);
        }
        return;
      }
      try {
        const nextUser = await toAuthUser(firebaseUser);
        if (isMounted) setUser(nextUser);
      } catch {
        // Offline start without a cached token: keep the identity, the SDK refreshes the token when online.
        if (isMounted) {
          setUser({
            localId: firebaseUser.uid,
            email: firebaseUser.email ?? "",
            displayName: firebaseUser.displayName || firebaseUser.email || firebaseUser.phoneNumber || undefined,
            phoneNumber: firebaseUser.phoneNumber ?? undefined,
            idToken: "",
            expiresAt: 0,
          });
        }
      } finally {
        if (isMounted) setIsReady(true);
      }
    });
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const loginWithEmail = useCallback(async (email: string, password: string, isSignup: boolean) => {
    await authWithEmailAndPassword(email, password, isSignup);
    setMessage("");
  }, []);

  const loginWithGoogle = useCallback(async () => {
    await authWithGoogle();
    setMessage("");
  }, []);

  const requestPhoneCode = useCallback(
    (phoneNumber: string, recaptchaContainer: HTMLElement | null): Promise<PhoneVerification> => startPhoneSignIn(phoneNumber, recaptchaContainer),
    [],
  );

  const logout = useCallback((reason = "Du wurdest ausgeloggt. Dein Fortschritt bleibt lokal gespeichert.") => {
    setMessage(reason);
    void signOutEverywhere().catch(() => setUser(null));
  }, []);

  return { user, isReady, message, setMessage, loginWithEmail, loginWithGoogle, requestPhoneCode, logout };
};

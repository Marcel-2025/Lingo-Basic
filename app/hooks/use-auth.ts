"use client";

import { useCallback, useEffect, useState } from "react";
import {
  authWithEmailAndPassword,
  authWithGoogleCredential,
  cancelGoogleCredentialRequest,
  ensureFreshAuthToken,
  isFirebaseConfigured,
  isNetworkAuthError,
  requestGoogleCredential,
} from "@/app/lib/firebase-auth";
import { readStoredJson, removeStoredValue, STORAGE_KEYS, writeStoredJson } from "@/app/lib/storage";
import type { AuthUser } from "@/app/lib/types";

/** Only the fields needed to restore a Firebase session are persisted. */
const parseStoredUser = (value: unknown): AuthUser | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<AuthUser>;
  if (typeof raw.localId !== "string" || typeof raw.idToken !== "string" || typeof raw.refreshToken !== "string") return null;
  return {
    localId: raw.localId,
    email: typeof raw.email === "string" ? raw.email : "",
    displayName: typeof raw.displayName === "string" ? raw.displayName : undefined,
    idToken: raw.idToken,
    refreshToken: raw.refreshToken,
    expiresAt: Number.isFinite(raw.expiresAt) ? Number(raw.expiresAt) : 0,
  };
};

export const useAuth = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;
    const restoreSession = async () => {
      await Promise.resolve();
      const storedUser = parseStoredUser(readStoredJson<unknown>(STORAGE_KEYS.authUser, null));
      if (!isMounted) return;
      if (!storedUser) {
        removeStoredValue(STORAGE_KEYS.authUser);
        setIsReady(true);
        return;
      }
      if (!isFirebaseConfigured()) {
        setUser(storedUser);
        setIsReady(true);
        return;
      }
      try {
        const refreshedUser = await ensureFreshAuthToken(storedUser);
        if (isMounted) setUser(refreshedUser);
      } catch (error) {
        if (!isMounted) return;
        if (isNetworkAuthError(error)) {
          // Offline start: keep the session. The token is refreshed once the connection returns.
          setUser(storedUser);
        } else {
          removeStoredValue(STORAGE_KEYS.authUser);
          setMessage("Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.");
        }
      } finally {
        if (isMounted) setIsReady(true);
      }
    };
    void restoreSession();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;
    if (user) writeStoredJson(STORAGE_KEYS.authUser, user);
    else removeStoredValue(STORAGE_KEYS.authUser);
  }, [isReady, user]);

  const updateUser = useCallback((nextUser: AuthUser) => setUser(nextUser), []);

  const loginWithEmail = useCallback(async (email: string, password: string, isSignup: boolean) => {
    const nextUser = await authWithEmailAndPassword(email.trim(), password, isSignup);
    setUser(nextUser);
    setMessage("");
    return nextUser;
  }, []);

  const loginWithGoogleCredential = useCallback(async (credential: string) => {
    const nextUser = await authWithGoogleCredential(credential);
    setUser(nextUser);
    setMessage("");
    return nextUser;
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const credential = await requestGoogleCredential();
    return loginWithGoogleCredential(credential);
  }, [loginWithGoogleCredential]);

  const logout = useCallback((reason = "Du wurdest ausgeloggt. Dein Fortschritt bleibt lokal gespeichert.") => {
    setUser(null);
    setMessage(reason);
  }, []);

  return {
    user,
    isReady,
    message,
    setMessage,
    updateUser,
    loginWithEmail,
    loginWithGoogle,
    loginWithGoogleCredential,
    cancelGoogleLogin: cancelGoogleCredentialRequest,
    logout,
  };
};

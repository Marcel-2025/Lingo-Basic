"use client";

import { useCallback, useEffect, useState } from "react";
import {
  authWithEmailAndPassword,
  authWithGoogleCredential,
  ensureFreshAuthToken,
  isFirebaseConfigured,
  requestGoogleCredential,
} from "@/app/lib/firebase-auth";
import { readStoredJson, removeStoredValue, STORAGE_KEYS, writeStoredJson } from "@/app/lib/storage";
import type { AuthUser } from "@/app/lib/types";

export const useAuth = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;
    const restoreSession = async () => {
      await Promise.resolve();
      const storedUser = readStoredJson<AuthUser | null>(STORAGE_KEYS.authUser, null);
      if (!storedUser || !isMounted) {
        if (isMounted) setIsReady(true);
        return;
      }
      if (!isFirebaseConfigured()) {
        setUser(storedUser);
        setIsReady(true);
        return;
      }
      try {
        const refreshedUser = await ensureFreshAuthToken({ ...storedUser, expiresAt: storedUser.expiresAt ?? 0 });
        if (isMounted) setUser(refreshedUser);
      } catch {
        if (isMounted) {
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
    const nextUser = await authWithEmailAndPassword(email, password, isSignup);
    setUser(nextUser);
    setMessage("");
    return nextUser;
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const credential = await requestGoogleCredential();
    const nextUser = await authWithGoogleCredential(credential);
    setUser(nextUser);
    setMessage("");
    return nextUser;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setMessage("Du wurdest ausgeloggt.");
  }, []);

  return { user, isReady, message, setMessage, updateUser, loginWithEmail, loginWithGoogle, logout };
};

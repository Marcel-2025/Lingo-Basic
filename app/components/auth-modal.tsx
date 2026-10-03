"use client";

import { useEffect, useRef, useState } from "react";
import { isNativePlatform } from "@/app/lib/billing";
import { GooglePromptError, isFirebaseConfigured, isGoogleConfigured, renderGoogleButton } from "@/app/lib/firebase-auth";

interface AuthModalProps {
  gradient: string;
  initialMessage?: string;
  onClose: () => void;
  onEmailAuth: (email: string, password: string, isSignup: boolean) => Promise<unknown>;
  onGoogleAuth: () => Promise<unknown>;
  onGoogleCredential: (credential: string) => Promise<unknown>;
  onCancelGoogle: () => void;
}

export function AuthModal({ gradient, initialMessage, onClose, onEmailAuth, onGoogleAuth, onGoogleCredential, onCancelGoogle }: AuthModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [pending, setPending] = useState<"email" | "google" | null>(null);
  const [message, setMessage] = useState(initialMessage ?? "");
  const [showGoogleButton, setShowGoogleButton] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const firebaseReady = isFirebaseConfigured();
  // Google blocks its web sign-in inside embedded WebViews (Capacitor). Native Google sign-in needs a plugin.
  const [isNativeApp] = useState(() => isNativePlatform());
  const googleReady = isGoogleConfigured() && !isNativeApp;
  const isLoading = pending !== null;

  const runAuth = async (kind: "email" | "google", action: () => Promise<unknown>) => {
    setPending(kind);
    setMessage("");
    try {
      await action();
      onClose();
    } catch (error) {
      if (error instanceof GooglePromptError && error.useButtonFallback) setShowGoogleButton(true);
      setMessage(error instanceof Error ? error.message : "Die Anmeldung ist fehlgeschlagen.");
    } finally {
      setPending(null);
    }
  };

  // Official Google button as fallback when One Tap is suppressed (cooldown, FedCM, third-party cookies).
  useEffect(() => {
    if (!showGoogleButton || !googleButtonRef.current) return;
    renderGoogleButton(googleButtonRef.current, (credential) => void runAuth("google", () => onGoogleCredential(credential)))
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Google-Button konnte nicht geladen werden."));
    // runAuth is recreated each render; the button only needs to be rendered once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGoogleButton]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && pending !== "email") {
        if (pending === "google") onCancelGoogle();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancelGoogle, onClose, pending]);

  const inputClass = "w-full rounded-xl bg-gray-100 p-3 text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 text-gray-900 shadow-2xl">
        <h3 id="auth-title" className="mb-2 text-2xl font-bold">{isSignup ? "Registrieren" : "Einloggen"}</h3>
        <p className="mb-4 text-sm text-gray-600">Optional: Mit einem Konto wird dein Fortschritt zwischen Geräten synchronisiert. Ohne Login bleibt alles lokal gespeichert.</p>
        {!firebaseReady && (
          <p className="mb-4 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-900" role="alert">
            Login ist in dieser Installation nicht konfiguriert (NEXT_PUBLIC_FIREBASE_API_KEY / NEXT_PUBLIC_FIREBASE_PROJECT_ID fehlen). Der Gastmodus funktioniert vollständig.
          </p>
        )}
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!email || !password || isLoading) return;
            void runAuth("email", () => onEmailAuth(email, password, isSignup));
          }}
        >
          <label className="sr-only" htmlFor="auth-email">E-Mail</label>
          <input id="auth-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" required autoComplete="email" placeholder="E-Mail" className={inputClass} disabled={!firebaseReady || isLoading} />
          <label className="sr-only" htmlFor="auth-password">Passwort</label>
          <input id="auth-password" value={password} onChange={(event) => setPassword(event.target.value)} type="password" required minLength={isSignup ? 6 : undefined} autoComplete={isSignup ? "new-password" : "current-password"} placeholder={isSignup ? "Passwort (mind. 6 Zeichen)" : "Passwort"} className={inputClass} disabled={!firebaseReady || isLoading} />
          <button type="submit" disabled={!firebaseReady || isLoading || !email || !password} className={`w-full rounded-xl bg-gradient-to-r ${gradient} py-3 font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-60`}>
            {pending === "email" ? "Bitte warten…" : isSignup ? "Account erstellen" : "Mit E-Mail einloggen"}
          </button>
        </form>
        <div className="mt-3 space-y-3">
          {pending === "google" ? (
            <button type="button" onClick={() => { onCancelGoogle(); setPending(null); }} className="w-full rounded-xl bg-gray-100 py-3 font-bold text-gray-900 focus-visible:outline-2 focus-visible:outline-indigo-500">Google-Anmeldung abbrechen</button>
          ) : (
            <button type="button" disabled={isLoading || !googleReady} onClick={() => void runAuth("google", onGoogleAuth)} className="w-full rounded-xl bg-gray-100 py-3 font-bold text-gray-900 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-60" title={googleReady ? undefined : "NEXT_PUBLIC_GOOGLE_CLIENT_ID fehlt"}>
              Mit Google einloggen
            </button>
          )}
          {isNativeApp && <p className="text-center text-xs text-gray-600">Google-Login ist in der Android-App noch nicht verfügbar. Bitte nutze E-Mail und Passwort.</p>}
          {!isNativeApp && firebaseReady && !googleReady && <p className="text-center text-xs text-gray-600">Google-Login ist nicht konfiguriert (NEXT_PUBLIC_GOOGLE_CLIENT_ID fehlt).</p>}
          {showGoogleButton && <div ref={googleButtonRef} className="flex min-h-11 justify-center" />}
          <button type="button" onClick={() => setIsSignup((value) => !value)} className="w-full text-sm font-bold text-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-500">{isSignup ? "Schon einen Account? Jetzt einloggen" : "Noch kein Account? Jetzt registrieren"}</button>
          <button type="button" onClick={onClose} disabled={pending === "email"} className="w-full text-sm text-gray-600 focus-visible:outline-2 focus-visible:outline-indigo-500">Schließen</button>
          {message && <p role="alert" className="rounded-xl bg-indigo-50 p-2 text-center text-xs font-bold text-indigo-800">{message}</p>}
        </div>
      </div>
    </div>
  );
}

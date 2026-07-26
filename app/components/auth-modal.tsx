"use client";

import { useState } from "react";

interface AuthModalProps {
  gradient: string;
  initialMessage?: string;
  onClose: () => void;
  onEmailAuth: (email: string, password: string, isSignup: boolean) => Promise<unknown>;
  onGoogleAuth: () => Promise<unknown>;
}

export function AuthModal({ gradient, initialMessage, onClose, onEmailAuth, onGoogleAuth }: AuthModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(initialMessage ?? "");

  const runAuth = async (action: () => Promise<unknown>) => {
    setIsLoading(true);
    setMessage("");
    try {
      await action();
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Die Anmeldung ist fehlgeschlagen.");
    } finally {
      setIsLoading(false);
    }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="auth-title"><div className="w-full max-w-md rounded-3xl bg-white p-6 text-gray-900 shadow-2xl"><h3 id="auth-title" className="mb-2 text-2xl font-bold">{isSignup ? "Registrieren" : "Einloggen"}</h3><p className="mb-4 text-sm opacity-70">Mit E-Mail/Passwort oder Google anmelden.</p><div className="space-y-3"><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="E-Mail" className="w-full rounded-xl bg-gray-100 p-3 outline-none focus:ring-2 focus:ring-indigo-500" /><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={isSignup ? "new-password" : "current-password"} placeholder="Passwort" className="w-full rounded-xl bg-gray-100 p-3 outline-none focus:ring-2 focus:ring-indigo-500" /><button type="button" disabled={isLoading || !email || !password} onClick={() => void runAuth(() => onEmailAuth(email, password, isSignup))} className={`w-full rounded-xl bg-gradient-to-r ${gradient} py-3 font-bold text-white disabled:opacity-60`}>{isLoading ? "Bitte warten…" : isSignup ? "Account erstellen" : "Mit E-Mail einloggen"}</button><button type="button" disabled={isLoading} onClick={() => void runAuth(onGoogleAuth)} className="w-full rounded-xl bg-gray-100 py-3 font-bold disabled:opacity-60">Mit Google einloggen</button><button type="button" onClick={() => setIsSignup((value) => !value)} className="w-full text-sm font-bold text-indigo-600">{isSignup ? "Schon einen Account? Jetzt einloggen" : "Noch kein Account? Jetzt registrieren"}</button><button type="button" onClick={onClose} className="w-full text-sm opacity-70">Schließen</button>{message && <p role="alert" className="text-center text-xs font-bold text-indigo-700">{message}</p>}</div></div></div>;
}

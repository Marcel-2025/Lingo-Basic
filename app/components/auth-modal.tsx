"use client";

import { useEffect, useRef, useState } from "react";
import { isFirebaseConfigured, type PhoneVerification } from "@/app/lib/firebase-auth";

interface AuthModalProps {
  gradient: string;
  initialMessage?: string;
  onClose: () => void;
  onEmailAuth: (email: string, password: string, isSignup: boolean) => Promise<unknown>;
  onGoogleAuth: () => Promise<unknown>;
  onRequestPhoneCode: (phoneNumber: string, recaptchaContainer: HTMLElement | null) => Promise<PhoneVerification>;
}

type Method = "email" | "phone";
type Pending = "email" | "google" | "phone-send" | "phone-confirm" | null;

export function AuthModal({ gradient, initialMessage, onClose, onEmailAuth, onGoogleAuth, onRequestPhoneCode }: AuthModalProps) {
  const [method, setMethod] = useState<Method>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [verification, setVerification] = useState<PhoneVerification | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [message, setMessage] = useState(initialMessage ?? "");
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const firebaseReady = isFirebaseConfigured();
  const isLoading = pending !== null;

  const run = async (kind: Exclude<Pending, null>, action: () => Promise<unknown>, closeOnSuccess = true) => {
    setPending(kind);
    setMessage("");
    try {
      await action();
      if (closeOnSuccess) onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Die Anmeldung ist fehlgeschlagen.");
    } finally {
      setPending(null);
    }
  };

  const sendCode = () => run("phone-send", async () => {
    const result = await onRequestPhoneCode(phoneNumber, recaptchaRef.current);
    setVerification(result);
    if (result.autoRetrievedCode) setSmsCode(result.autoRetrievedCode);
    setMessage("Der SMS-Code wurde gesendet.");
  }, false);

  // Android can read the SMS automatically; fill the field as soon as the code arrives.
  useEffect(() => {
    if (!verification || smsCode) return;
    const intervalId = window.setInterval(() => {
      if (verification.autoRetrievedCode) setSmsCode(verification.autoRetrievedCode);
    }, 500);
    return () => window.clearInterval(intervalId);
  }, [smsCode, verification]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isLoading) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLoading, onClose]);

  const inputClass = "w-full rounded-xl bg-gray-100 p-3 text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60";
  const primaryButton = `w-full rounded-xl bg-gradient-to-r ${gradient} py-3 font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-60`;
  const tabClass = (active: boolean) => `flex-1 rounded-lg py-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-indigo-500 ${active ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <div className="max-h-[95vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 text-gray-900 shadow-2xl">
        <h3 id="auth-title" className="mb-2 text-2xl font-bold">{method === "email" && isSignup ? "Registrieren" : "Einloggen"}</h3>
        <p className="mb-4 text-sm text-gray-600">Optional: Mit einem Konto wird dein Fortschritt zwischen Geräten synchronisiert. Ohne Login bleibt alles lokal gespeichert.</p>
        {!firebaseReady && (
          <p className="mb-4 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-900" role="alert">
            Login ist in dieser Installation nicht konfiguriert (Firebase-Umgebungsvariablen fehlen). Der Gastmodus funktioniert vollständig.
          </p>
        )}

        <button type="button" disabled={!firebaseReady || isLoading} onClick={() => void run("google", onGoogleAuth)} className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 font-bold text-gray-900 shadow-sm focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-60">
          <span aria-hidden="true" className="text-lg font-black text-blue-600">G</span>
          {pending === "google" ? "Bitte warten…" : "Mit Google fortfahren"}
        </button>

        <div className="mb-4 flex gap-1 rounded-xl bg-gray-100 p-1" role="tablist" aria-label="Anmeldemethode">
          <button type="button" role="tab" aria-selected={method === "email"} className={tabClass(method === "email")} onClick={() => { setMethod("email"); setMessage(""); }}>E-Mail</button>
          <button type="button" role="tab" aria-selected={method === "phone"} className={tabClass(method === "phone")} onClick={() => { setMethod("phone"); setMessage(""); }}>Telefon</button>
        </div>

        {method === "email" ? (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!email || !password || isLoading) return;
              void run("email", () => onEmailAuth(email, password, isSignup));
            }}
          >
            <label className="sr-only" htmlFor="auth-email">E-Mail</label>
            <input id="auth-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" required autoComplete="email" placeholder="E-Mail" className={inputClass} disabled={!firebaseReady || isLoading} />
            <label className="sr-only" htmlFor="auth-password">Passwort</label>
            <input id="auth-password" value={password} onChange={(event) => setPassword(event.target.value)} type="password" required minLength={isSignup ? 6 : undefined} autoComplete={isSignup ? "new-password" : "current-password"} placeholder={isSignup ? "Passwort (mind. 6 Zeichen)" : "Passwort"} className={inputClass} disabled={!firebaseReady || isLoading} />
            <button type="submit" disabled={!firebaseReady || isLoading || !email || !password} className={primaryButton}>
              {pending === "email" ? "Bitte warten…" : isSignup ? "Account erstellen" : "Mit E-Mail einloggen"}
            </button>
            <button type="button" onClick={() => setIsSignup((value) => !value)} className="w-full text-sm font-bold text-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-500">{isSignup ? "Schon einen Account? Jetzt einloggen" : "Noch kein Account? Jetzt registrieren"}</button>
          </form>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (isLoading) return;
              if (!verification) void sendCode();
              else if (smsCode) void run("phone-confirm", () => verification.confirm(smsCode));
            }}
          >
            <label className="sr-only" htmlFor="auth-phone">Telefonnummer</label>
            <input id="auth-phone" value={phoneNumber} onChange={(event) => { setPhoneNumber(event.target.value); setVerification(null); setSmsCode(""); }} type="tel" inputMode="tel" autoComplete="tel" placeholder="Telefonnummer, z. B. +49 151 2345678" className={inputClass} disabled={!firebaseReady || isLoading} />
            {verification && (
              <>
                <label className="sr-only" htmlFor="auth-sms-code">SMS-Code</label>
                <input id="auth-sms-code" value={smsCode} onChange={(event) => setSmsCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6-stelliger SMS-Code" className={`${inputClass} tracking-widest`} disabled={isLoading} />
              </>
            )}
            <button type="submit" disabled={!firebaseReady || isLoading || !phoneNumber || (Boolean(verification) && smsCode.length < 6)} className={primaryButton}>
              {pending === "phone-send" ? "SMS wird gesendet…" : pending === "phone-confirm" ? "Bitte warten…" : verification ? "Code bestätigen" : "SMS-Code senden"}
            </button>
            {verification && <button type="button" disabled={isLoading} onClick={() => { setVerification(null); setSmsCode(""); void sendCode(); }} className="w-full text-sm font-bold text-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-60">Code erneut senden</button>}
            <p className="text-xs text-gray-600">Es können SMS-Gebühren deines Anbieters anfallen.</p>
          </form>
        )}

        <div ref={recaptchaRef} id="recaptcha-container" />
        <button type="button" onClick={onClose} disabled={isLoading} className="mt-3 w-full text-sm text-gray-600 focus-visible:outline-2 focus-visible:outline-indigo-500">Schließen</button>
        {message && <p role="alert" className="mt-3 rounded-xl bg-indigo-50 p-2 text-center text-xs font-bold text-indigo-800">{message}</p>}
      </div>
    </div>
  );
}

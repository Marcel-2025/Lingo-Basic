"use client";

import { getWebCheckoutUrl, isNativePlatform, PREMIUM_OFFERS } from "@/app/lib/billing";
import type { AuthUser, EntitlementState } from "@/app/lib/types";

interface PremiumModalProps {
  user: AuthUser | null;
  entitlement: EntitlementState;
  gradient: string;
  isRestoring: boolean;
  onClose: () => void;
  onLogin: () => void;
  onRestore: () => void;
  restoreMessage: string;
}

export function PremiumModal({ user, entitlement, gradient, isRestoring, onClose, onLogin, onRestore, restoreMessage }: PremiumModalProps) {
  const nativePlatform = isNativePlatform();

  const startCheckout = (plan: (typeof PREMIUM_OFFERS)[number]["plan"]) => {
    if (!user) {
      onLogin();
      return;
    }
    const checkoutUrl = getWebCheckoutUrl(plan, user.localId);
    if (checkoutUrl && !nativePlatform) window.location.assign(checkoutUrl);
  };

  const checkoutAvailable = (plan: (typeof PREMIUM_OFFERS)[number]["plan"]) =>
    Boolean(user && !nativePlatform && getWebCheckoutUrl(plan, user.localId));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="premium-title">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 text-gray-900 shadow-2xl">
        <div className={`mb-5 rounded-2xl bg-gradient-to-r ${gradient} p-5 text-white`}>
          <p className="text-sm font-bold uppercase tracking-wider text-white/80">Lingo Premium</p>
          <h2 id="premium-title" className="mt-1 text-3xl font-extrabold">Lerne ohne Grenzen</h2>
          <p className="mt-2 text-sm text-white/90">Unbegrenzt lernen, alle Level freischalten und Lingo langfristig unterstützen.</p>
        </div>

        {entitlement.isPremium ? (
          <div className="rounded-2xl bg-green-50 p-4 text-sm font-semibold text-green-800">Premium ist aktiv. Danke, dass du Lingo unterstützt! ✨</div>
        ) : (
          <div className="space-y-3">
            <ul className="space-y-2 text-sm text-gray-700">
              <li>✓ Unbegrenzte Lernkarten und Übungen</li>
              <li>✓ A2 und B1 für alle fünf Sprachen</li>
              <li>✓ Künftige optionale Werbung ausblenden</li>
            </ul>
            {PREMIUM_OFFERS.map((offer) => {
              const available = checkoutAvailable(offer.plan);
              return (
                <button
                  key={offer.plan}
                  type="button"
                  onClick={() => startCheckout(offer.plan)}
                  disabled={Boolean(user) && !available}
                  className={`w-full rounded-2xl border-2 p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${offer.badge ? "border-indigo-500 bg-indigo-50" : "border-gray-100 bg-gray-50"} ${Boolean(user) && !available ? "cursor-not-allowed opacity-70" : "hover:border-indigo-400"}`}
                >
                  <div className="flex items-center justify-between gap-3"><span className="font-bold">{offer.title}</span>{offer.badge && <span className="rounded-full bg-indigo-600 px-2 py-1 text-xs font-bold text-white">{offer.badge}</span>}</div>
                  <span className="mt-1 block text-sm text-gray-600">{offer.description}</span>
                  {!user && <span className="mt-2 block text-xs font-bold text-indigo-700">Zum Freischalten anmelden</span>}
                  {user && nativePlatform && <span className="mt-2 block text-xs font-bold text-indigo-700">Google-Play-Kauf wird mit der Android-Veröffentlichung aktiviert.</span>}
                  {user && !nativePlatform && !available && <span className="mt-2 block text-xs font-bold text-indigo-700">Sicherer Checkout wird gerade eingerichtet.</span>}
                </button>
              );
            })}
            {user && !nativePlatform && <button type="button" onClick={onRestore} disabled={isRestoring} className="w-full rounded-xl border border-gray-200 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:cursor-wait disabled:opacity-70">{isRestoring ? "Kauf wird geprüft…" : "Kauf wiederherstellen"}</button>}
            {restoreMessage && <p className="rounded-xl bg-blue-50 p-3 text-center text-xs font-medium text-blue-900">{restoreMessage}</p>}
          </div>
        )}

        {!user && <p className="mt-4 text-center text-xs text-gray-500">Ein Konto ist erforderlich, damit Käufe auf Web und Android zugeordnet werden können.</p>}
        <button type="button" onClick={onClose} className="mt-5 w-full rounded-xl py-3 text-sm font-bold text-gray-600 hover:bg-gray-100">Schließen</button>
      </div>
    </div>
  );
}

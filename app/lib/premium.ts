/**
 * Central premium configuration.
 *
 * Solange es kein Abo-/Kaufsystem gibt, gelten alle Nutzer als Premium. Über
 * NEXT_PUBLIC_PREMIUM_FOR_ALL=false lässt sich das Free-Verhalten (Tageslimit
 * nach `dailyGoal`) testen, ohne Komponenten anzupassen.
 */
export const PREMIUM_FOR_ALL = process.env.NEXT_PUBLIC_PREMIUM_FOR_ALL !== "false";

export interface PremiumContext {
  isLoggedIn: boolean;
}

/** Single decision point for premium features. Extend here once purchases/entitlements exist. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const isPremiumUser = (_context: PremiumContext) => PREMIUM_FOR_ALL;

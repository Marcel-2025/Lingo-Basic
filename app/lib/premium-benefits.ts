import type { UserStats } from "@/app/lib/types";
import { shiftDateKey } from "@/app/lib/utils";

/**
 * What Premium changes in the game. Everything here is deterministic and framework-free; the native app
 * passes `isPremium` from the store SDK (RevenueCat entitlement) and the web app from userEntitlements.
 */

/** XP (and therefore coins) multiplier for Premium. */
export const PREMIUM_XP_MULTIPLIER = 1.5;

export const applyXpBonus = (xp: number, isPremium: boolean) => (isPremium ? Math.round(xp * PREMIUM_XP_MULTIPLIER) : xp);

/** Automatic streak protection: a missed day is forgiven up to this many times per calendar month. */
export const STREAK_FREEZES_PER_MONTH = 2;

/**
 * If exactly one day was missed and a freeze is available, the streak survives: the missed day is marked as
 * frozen and `lastActiveDate` moves to yesterday so the regular reconcile keeps the streak.
 * `frozenDays` holds the dates already protected (stored in learningInsights).
 */
export const applyStreakFreeze = (
  stats: UserStats,
  frozenDays: string[],
  todayKey: string,
  isPremium: boolean,
): { stats: UserStats; frozenDays: string[]; used: boolean } => {
  if (!isPremium || !stats.lastActiveDate || stats.streak <= 0) return { stats, frozenDays, used: false };
  const yesterday = shiftDateKey(todayKey, -1);
  const dayBefore = shiftDateKey(todayKey, -2);
  if (stats.lastActiveDate !== dayBefore) return { stats, frozenDays, used: false };
  const month = yesterday.slice(0, 7);
  const usedThisMonth = frozenDays.filter((day) => day.startsWith(month)).length;
  if (usedThisMonth >= STREAK_FREEZES_PER_MONTH) return { stats, frozenDays, used: false };
  return { stats: { ...stats, lastActiveDate: yesterday }, frozenDays: [...frozenDays, yesterday], used: true };
};

/** Premium-only town decorations, bought with coins (not real money). */
export interface Decoration {
  id: string;
  name: string;
  icon: string;
  cost: number;
}

export const DECORATIONS: Decoration[] = [
  { id: "fountain", name: "Brunnen", icon: "⛲", cost: 150 },
  { id: "ferris", name: "Riesenrad", icon: "🎡", cost: 400 },
  { id: "statue", name: "Eulen-Statue", icon: "🗿", cost: 250 },
  { id: "garden", name: "Blumengarten", icon: "🌷", cost: 120 },
  { id: "lighthouse", name: "Leuchtturm", icon: "🗼", cost: 500 },
  { id: "castle", name: "Schloss", icon: "🏰", cost: 900 },
];

export const PREMIUM_BENEFITS = [
  { icon: "❤️", title: "Unendlich Leben", text: "Üben ohne Pause, Fehler kosten nichts." },
  { icon: "⚡", title: "+50 % XP und Münzen", text: "Schneller leveln, schneller bauen." },
  { icon: "🧊", title: "Streak-Schutz", text: "Zwei verpasste Tage im Monat werden automatisch verziehen." },
  { icon: "🎡", title: "Stadt-Extras", text: "Brunnen, Riesenrad, Schloss und mehr für deine Stadt." },
  { icon: "🚫", title: "Keine Werbung", text: "Bleibt so, versprochen." },
];

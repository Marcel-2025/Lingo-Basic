import type { UserStats } from "@/app/lib/types";

export const shuffle = <T,>(items: readonly T[]): T[] => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
};

export const getDateKey = (date = new Date(), timeZone = "UTC") => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const valueFor = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  return `${valueFor("year")}-${valueFor("month")}-${valueFor("day")}`;
};

export const getYesterdayKey = (timeZone: string) => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getDateKey(yesterday, timeZone);
};

export const reconcileStreak = (stats: UserStats, timeZone: string): UserStats => {
  if (!stats.lastActiveDate) return stats;
  const today = getDateKey(new Date(), timeZone);
  const yesterday = getYesterdayKey(timeZone);
  if (stats.lastActiveDate === today || stats.lastActiveDate === yesterday) return stats;
  return { ...stats, streak: 0 };
};

export const recordActivity = (stats: UserStats, timeZone: string): UserStats => {
  const today = getDateKey(new Date(), timeZone);
  if (stats.lastActiveDate === today) return stats;
  const yesterday = getYesterdayKey(timeZone);
  return {
    ...stats,
    streak: stats.lastActiveDate === yesterday ? stats.streak + 1 : 1,
    lastActiveDate: today,
  };
};

export const getLevelFromXp = (xp: number) => Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;

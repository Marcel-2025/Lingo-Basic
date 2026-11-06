import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  addPurchasedCoins,
  BUILDINGS,
  buyDecoration,
  claimStreakChest,
  completeQuest,
  EMPTY_CITY,
  getBuildingStatus,
  getCityOverview,
  getCoinsAvailable,
  getDailyQuests,
  getQuestProgress,
  isCityAsleep,
  normalizeCity,
  STREAK_CHEST_REWARD,
  upgradeBuilding,
  type BuildingStatus,
  type CityState,
  type Quest,
} from "@/app/lib/city";
import { REFILL_COIN_COST } from "@/app/lib/lives";
import { DECORATIONS } from "@/app/lib/premium-benefits";
import { t, type TranslationKey } from "~/i18n";
import { celebrate } from "~/lib/celebrations";
import { livesActions } from "~/lib/lives-store";
import { getDayActivity, updateDayActivity, useDayActivity } from "~/lib/day-activity";
import { syncReminders, useReminderSettings } from "~/lib/reminders";
import { useAppState } from "~/state/app-state";

interface CityContextValue {
  city: CityState;
  coins: number;
  overview: ReturnType<typeof getCityOverview>;
  asleep: boolean;
  statuses: BuildingStatus[];
  quests: (Quest & { progress: number; done: boolean })[];
  chestAvailable: boolean;
  upgrade: (buildingId: string) => void;
  claimChest: () => void;
  /** Premium: buys a decoration with coins. */
  buyDecorationWithCoins: (decorationId: string) => boolean;
  /** Spends coins for a full heart refill. */
  refillLivesWithCoins: () => boolean;
  /** Grants purchased coins (after a store purchase). */
  grantPurchasedCoins: (amount: number) => void;
  /** Called by the learning screens. */
  recordCard: (learnedDelta: number) => void;
  recordExercise: (correct: boolean) => void;
}

const CityContext = createContext<CityContextValue | null>(null);

export function CityProvider({ children }: { children: ReactNode }) {
  const { stats, insights, settings, updateInsights, todayKey, isLoaded } = useAppState();
  const dateKey = todayKey();
  const activity = useDayActivity(dateKey);
  const city = useMemo(() => (insights.city ? normalizeCity(insights.city) : EMPTY_CITY), [insights.city]);
  const push = celebrate;

  const setCity = useCallback((updater: (previous: CityState) => CityState) => {
    updateInsights((previous) => ({ ...previous, city: updater(previous.city ? normalizeCity(previous.city) : EMPTY_CITY) }));
  }, [updateInsights]);

  // Level-up and daily-goal celebrations: compare against the last seen values.
  const lastLevelRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isLoaded) return;
    if (lastLevelRef.current === null) {
      lastLevelRef.current = stats.level;
      return;
    }
    if (stats.level > lastLevelRef.current) push({ kind: "level", level: stats.level });
    lastLevelRef.current = stats.level;
  }, [isLoaded, push, stats.level]);

  // Streak celebration whenever the streak grows today.
  const lastStreakRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isLoaded) return;
    if (lastStreakRef.current === null) {
      lastStreakRef.current = stats.streak;
      return;
    }
    if (stats.streak > lastStreakRef.current && stats.streak >= 2) push({ kind: "streak", streak: stats.streak, coins: 0 });
    lastStreakRef.current = stats.streak;
  }, [isLoaded, push, stats.streak]);

  const goalReached = (insights.learnedDays[dateKey] ?? 0) >= Math.max(1, settings.dailyGoal);
  useEffect(() => {
    if (goalReached && !getDayActivity(dateKey).goalReached) {
      updateDayActivity(dateKey, (previous) => ({ ...previous, goalReached: true }));
      push({ kind: "goal", goal: settings.dailyGoal });
    }
  }, [dateKey, goalReached, push, settings.dailyGoal]);

  // Quests complete themselves as soon as the activity counters reach the target.
  const quests = useMemo(() => {
    const done = city.questsDone[dateKey] ?? [];
    return getDailyQuests(dateKey).map((quest) => ({ ...quest, progress: getQuestProgress(quest, activity), done: done.includes(quest.id) }));
  }, [activity, city.questsDone, dateKey]);
  useEffect(() => {
    for (const quest of quests) {
      if (!quest.done && quest.progress >= quest.target) {
        setCity((previous) => completeQuest(previous, dateKey, quest.id));
        push({ kind: "quest", title: t(`quests.${quest.id}` as TranslationKey), coins: quest.reward });
      }
    }
  }, [dateKey, push, quests, setCity]);

  // Keep the local reminders in sync with today's learning state (skips the evening nudge once you learned).
  const reminders = useReminderSettings();
  const learnedToday = (insights.learnedDays[dateKey] ?? 0) > 0;
  useEffect(() => {
    void syncReminders(learnedToday, stats.streak);
  }, [learnedToday, reminders, stats.streak]);

  const chestAvailable = stats.streak >= 3 && stats.lastActiveDate === dateKey && !city.chestsClaimed.includes(dateKey);

  const value = useMemo<CityContextValue>(() => ({
    city,
    coins: getCoinsAvailable(stats, city),
    overview: getCityOverview(city, stats),
    asleep: isCityAsleep(stats, dateKey),
    statuses: BUILDINGS.map((building) => getBuildingStatus(building, city, stats, insights)),
    quests,
    chestAvailable,
    upgrade: (buildingId) => {
      const building = BUILDINGS.find((entry) => entry.id === buildingId);
      const before = city.buildings[buildingId] ?? 0;
      const next = upgradeBuilding(city, buildingId, stats, insights);
      if (building && next !== city) {
        setCity(() => next);
        push({ kind: "building", name: t(`buildings.${building.id}` as TranslationKey), icon: building.icon, level: before + 1 });
      }
    },
    claimChest: () => {
      if (!chestAvailable) return;
      setCity((previous) => claimStreakChest(previous, dateKey));
      push({ kind: "streak-chest", coins: STREAK_CHEST_REWARD });
    },
    buyDecorationWithCoins: (decorationId) => {
      const next = buyDecoration(city, decorationId, stats);
      if (next === city) return false;
      const decoration = DECORATIONS.find((entry) => entry.id === decorationId);
      setCity(() => next);
      if (decoration) push({ kind: "building", name: t(`decorations.${decoration.id}` as TranslationKey), icon: decoration.icon, level: 1 });
      return true;
    },
    refillLivesWithCoins: () => {
      if (getCoinsAvailable(stats, city) < REFILL_COIN_COST) return false;
      setCity((previous) => ({ ...previous, coinsSpent: previous.coinsSpent + REFILL_COIN_COST }));
      livesActions.refill();
      return true;
    },
    grantPurchasedCoins: (amount) => setCity((previous) => addPurchasedCoins(previous, amount)),
    recordCard: (learnedDelta) => updateDayActivity(dateKey, (previous) => ({ ...previous, cards: previous.cards + 1, newWords: previous.newWords + Math.max(0, learnedDelta) })),
    recordExercise: (correct) => updateDayActivity(dateKey, (previous) => ({ ...previous, correctExercises: previous.correctExercises + (correct ? 1 : 0) })),
  }), [chestAvailable, city, dateKey, insights, push, quests, setCity, stats]);

  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
}

export const useCity = () => {
  const context = useContext(CityContext);
  if (!context) throw new Error("useCity must be used inside CityProvider");
  return context;
};

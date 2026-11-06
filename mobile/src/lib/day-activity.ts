import { useSyncExternalStore } from "react";
import type { DayActivity } from "@/app/lib/city";
import { readJson, writeJson } from "~/lib/storage";

/** Today's counters for quests and celebrations (device-local, reset per day). */
interface Stored { dateKey: string; activity: DayActivity }

const KEY = "lingoDayActivity";
const EMPTY: DayActivity = { cards: 0, correctExercises: 0, newWords: 0, goalReached: false };

let current: Stored = { dateKey: "", activity: EMPTY };
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

const load = () => {
  if (loaded) return;
  loaded = true;
  void readJson<Partial<Stored>>(KEY, {}).then((stored) => {
    if (stored && typeof stored.dateKey === "string" && stored.activity) current = { dateKey: stored.dateKey, activity: { ...EMPTY, ...stored.activity } };
    emit();
  });
};

const forDay = (dateKey: string) => (current.dateKey === dateKey ? current.activity : EMPTY);

export const getDayActivity = (dateKey: string) => forDay(dateKey);

export const updateDayActivity = (dateKey: string, patch: (previous: DayActivity) => DayActivity) => {
  current = { dateKey, activity: patch(forDay(dateKey)) };
  emit();
  void writeJson(KEY, current);
};

export function useDayActivity(dateKey: string): DayActivity {
  load();
  const stored = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => current,
  );
  return stored.dateKey === dateKey ? stored.activity : EMPTY;
}

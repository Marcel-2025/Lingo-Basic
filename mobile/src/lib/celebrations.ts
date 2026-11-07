import { useSyncExternalStore } from "react";

/**
 * One-off events: big moments (level, streak, building, chest) play the full-screen overlay; small ones
 * (quest, daily goal) only show a short toast that never blocks the cards.
 * While a lesson runs, celebrations are paused: the lesson's own result screen shows XP, level and streak,
 * so those are dropped and the rest is shown after the lesson.
 */
export type Celebration =
  | { kind: "quest"; title: string; coins: number }
  | { kind: "level"; level: number }
  | { kind: "goal"; goal: number }
  | { kind: "streak"; streak: number; coins: number }
  | { kind: "building"; name: string; icon: string; level: number }
  | { kind: "streak-chest"; coins: number };

export const isToastCelebration = (event: Celebration) => event.kind === "quest" || event.kind === "goal";

let queue: Celebration[] = [];
let toasts: Celebration[] = [];
let paused = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export const celebrate = (event: Celebration) => {
  if (isToastCelebration(event)) toasts = [...toasts, event];
  else queue = [...queue, event];
  emit();
};

export const dismissCelebration = () => {
  queue = queue.slice(1);
  emit();
};

export const dismissToast = () => {
  toasts = toasts.slice(1);
  emit();
};

/** Called by the lesson screen: pause while it is open, resume (dropping what the result screen already showed) when it closes. */
export const pauseCelebrations = () => {
  paused = true;
  emit();
};
export const resumeCelebrations = (drop: Celebration["kind"][] = []) => {
  paused = false;
  queue = queue.filter((event) => !drop.includes(event.kind));
  toasts = toasts.filter((event) => !drop.includes(event.kind));
  emit();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useCelebration = () => {
  const state = useSyncExternalStore(subscribe, () => (paused ? null : queue[0] ?? null), () => null);
  return state;
};

export const useToast = () => useSyncExternalStore(subscribe, () => (paused ? null : toasts[0] ?? null), () => null);

import { useSyncExternalStore } from "react";

/** One-off events the celebration overlay plays (confetti, flame, coins). Module store so effects can enqueue freely. */
export type Celebration =
  | { kind: "quest"; title: string; coins: number }
  | { kind: "level"; level: number }
  | { kind: "goal"; goal: number }
  | { kind: "streak"; streak: number; coins: number }
  | { kind: "building"; name: string; icon: string; level: number }
  | { kind: "streak-chest"; coins: number };

let queue: Celebration[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export const celebrate = (event: Celebration) => {
  queue = [...queue, event];
  emit();
};

export const dismissCelebration = () => {
  queue = queue.slice(1);
  emit();
};

export const useCelebration = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => queue,
    () => queue,
  )[0] ?? null;

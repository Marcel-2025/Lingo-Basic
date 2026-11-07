import { useEffect, useState, useSyncExternalStore } from "react";
import { addHeartPack, FULL_LIVES, getLives, getMsUntilNextLife, loseLife, normalizeLives, refillLives, type LivesState } from "@/app/lib/lives";
import { readJson, writeJson } from "~/lib/storage";

/** Device-local hearts for the exercise mode (part of the backup via app state? No: hearts are a session resource and stay local). */
const KEY = "lingoLives";
let current: LivesState = FULL_LIVES;
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

const load = () => {
  if (!loaded) {
    loaded = readJson<unknown>(KEY, null).then((stored) => {
      if (stored) current = normalizeLives(stored);
      emit();
    });
  }
  return loaded;
};

const set = (next: LivesState) => {
  current = next;
  emit();
  void writeJson(KEY, next);
};

export const livesActions = {
  lose: (isPremium: boolean) => set(loseLife(current, Date.now(), isPremium)),
  refill: () => set(refillLives(current, Date.now())),
  /** Waits for the stored hearts first, so a purchase delivered at app start is not overwritten by the load. */
  addPack: () => void load().then(() => set(addHeartPack(current, Date.now()))),
};

/** Live hearts + countdown, ticking once per second while not full. */
export const useLives = () => {
  load();
  const state = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => current,
  );
  const [now, setNow] = useState(() => Date.now());
  const full = getLives(state, now) >= 5 && state.extra >= 0;
  useEffect(() => {
    if (getMsUntilNextLife(state, Date.now()) === 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state, full]);
  return { state, lives: getLives(state, now), extra: state.extra, msUntilNext: getMsUntilNextLife(state, now) };
};

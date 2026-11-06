/**
 * Hearts ("Leben") for the exercise mode. Framework-free so the rules are testable and shared.
 * Flashcards never cost hearts: learning itself is always free; hearts only gate the quiz.
 */

export const MAX_LIVES = 5;
/** One heart regenerates every 30 minutes. */
export const REFILL_INTERVAL_MS = 30 * 60 * 1000;
/** Coins for a full refill from the in-game economy. */
export const REFILL_COIN_COST = 60;
/** Hearts granted by the purchasable pack (on top of a full refill). */
export const HEART_PACK_EXTRA = 10;

export interface LivesState {
  /** Regular hearts at `updatedAt` (0..MAX_LIVES). */
  lives: number;
  /** Timestamp (ms) the `lives` value refers to; regeneration is computed from here. */
  updatedAt: number;
  /** Purchased extra hearts: used only when regular hearts are empty, never regenerate, never expire. */
  extra: number;
}

export const FULL_LIVES: LivesState = { lives: MAX_LIVES, updatedAt: 0, extra: 0 };

export const normalizeLives = (input: unknown): LivesState => {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const lives = Math.floor(Number(raw.lives));
  const updatedAt = Number(raw.updatedAt);
  const extra = Math.floor(Number(raw.extra));
  return {
    lives: Number.isFinite(lives) ? Math.min(MAX_LIVES, Math.max(0, lives)) : MAX_LIVES,
    updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : 0,
    extra: Number.isFinite(extra) && extra > 0 ? Math.min(extra, 999) : 0,
  };
};

/** Applies regeneration up to `now` without mutating the input. */
export const settleLives = (state: LivesState, now: number): LivesState => {
  if (state.lives >= MAX_LIVES) return { ...state, updatedAt: now };
  const elapsed = Math.max(0, now - state.updatedAt);
  const gained = Math.floor(elapsed / REFILL_INTERVAL_MS);
  if (gained <= 0) return state;
  const lives = Math.min(MAX_LIVES, state.lives + gained);
  return { ...state, lives, updatedAt: lives >= MAX_LIVES ? now : state.updatedAt + gained * REFILL_INTERVAL_MS };
};

export const getLives = (state: LivesState, now: number) => settleLives(state, now).lives;

/** Milliseconds until the next regular heart (0 when full). */
export const getMsUntilNextLife = (state: LivesState, now: number) => {
  const settled = settleLives(state, now);
  if (settled.lives >= MAX_LIVES) return 0;
  return Math.max(0, settled.updatedAt + REFILL_INTERVAL_MS - now);
};

export const canPlay = (state: LivesState, now: number, isPremium: boolean) => isPremium || getLives(state, now) > 0 || state.extra > 0;

/** A wrong answer costs one heart (extra hearts first only when regular ones are empty). Premium never loses hearts. */
export const loseLife = (state: LivesState, now: number, isPremium: boolean): LivesState => {
  if (isPremium) return state;
  const settled = settleLives(state, now);
  if (settled.lives > 0) {
    const wasFull = settled.lives >= MAX_LIVES;
    return { ...settled, lives: settled.lives - 1, updatedAt: wasFull ? now : settled.updatedAt };
  }
  if (settled.extra > 0) return { ...settled, extra: settled.extra - 1 };
  return settled;
};

export const refillLives = (state: LivesState, now: number): LivesState => ({ ...state, lives: MAX_LIVES, updatedAt: now });

export const addHeartPack = (state: LivesState, now: number): LivesState => ({ ...refillLives(state, now), extra: state.extra + HEART_PACK_EXTRA });

export const formatCountdown = (ms: number) => {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

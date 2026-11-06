import { describe, expect, it } from "vitest";
import { addHeartPack, canPlay, getLives, getMsUntilNextLife, loseLife, MAX_LIVES, normalizeLives, REFILL_INTERVAL_MS, refillLives } from "@/app/lib/lives";
import { applyStreakFreeze, applyXpBonus } from "@/app/lib/premium-benefits";
import { DEFAULT_STATS } from "@/app/lib/defaults";

describe("lives", () => {
  const t0 = 1_700_000_000_000;
  it("loses hearts and regenerates one per interval", () => {
    let state = normalizeLives({});
    state = loseLife(state, t0, false);
    state = loseLife(state, t0, false);
    expect(getLives(state, t0)).toBe(MAX_LIVES - 2);
    expect(getMsUntilNextLife(state, t0)).toBe(REFILL_INTERVAL_MS);
    expect(getLives(state, t0 + REFILL_INTERVAL_MS)).toBe(MAX_LIVES - 1);
    expect(getLives(state, t0 + 10 * REFILL_INTERVAL_MS)).toBe(MAX_LIVES);
  });
  it("premium never loses hearts, extra hearts are used when empty", () => {
    const full = normalizeLives({});
    expect(loseLife(full, t0, true)).toBe(full);
    let state = { lives: 0, updatedAt: t0, extra: 2 };
    expect(canPlay(state, t0, false)).toBe(true);
    state = loseLife(state, t0, false);
    expect(state.extra).toBe(1);
    expect(canPlay({ lives: 0, updatedAt: t0, extra: 0 }, t0, false)).toBe(false);
    expect(canPlay({ lives: 0, updatedAt: t0, extra: 0 }, t0, true)).toBe(true);
  });
  it("refills and adds packs", () => {
    const empty = { lives: 0, updatedAt: t0, extra: 0 };
    expect(refillLives(empty, t0).lives).toBe(MAX_LIVES);
    expect(addHeartPack(empty, t0)).toEqual({ lives: MAX_LIVES, updatedAt: t0, extra: 10 });
  });
  it("survives corrupt data", () => {
    expect(normalizeLives({ lives: 99, extra: -4, updatedAt: "x" })).toEqual({ lives: MAX_LIVES, updatedAt: 0, extra: 0 });
  });
});

describe("premium benefits", () => {
  it("adds 50% xp", () => {
    expect(applyXpBonus(10, true)).toBe(15);
    expect(applyXpBonus(10, false)).toBe(10);
  });
  it("freezes a single missed day twice per month for premium", () => {
    const stats = { ...DEFAULT_STATS, streak: 7, lastActiveDate: "2026-11-04" };
    const first = applyStreakFreeze(stats, [], "2026-11-06", true);
    expect(first.used).toBe(true);
    expect(first.stats.lastActiveDate).toBe("2026-11-05");
    expect(first.frozenDays).toEqual(["2026-11-05"]);
    expect(applyStreakFreeze(stats, [], "2026-11-06", false).used).toBe(false);
    expect(applyStreakFreeze(stats, ["2026-11-01", "2026-11-02"], "2026-11-06", true).used).toBe(false);
    expect(applyStreakFreeze({ ...stats, lastActiveDate: "2026-11-02" }, [], "2026-11-06", true).used).toBe(false);
  });
});

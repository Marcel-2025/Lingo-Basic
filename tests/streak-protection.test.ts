import { describe, expect, it } from "vitest";
import { applyStreakProtection } from "@/app/lib/premium-benefits";
import { DEFAULT_STATS } from "@/app/lib/defaults";
import { normalizeInsights } from "@/app/lib/progress";

const stats = { ...DEFAULT_STATS, streak: 5, lastActiveDate: "2026-11-07" };

describe("streak protection", () => {
  it("uses a bought protection for a single missed day when not premium", () => {
    const result = applyStreakProtection(stats, [], "2026-11-09", false, 2);
    expect(result).toMatchObject({ used: true, owned: 1, frozenDays: ["2026-11-08"] });
    expect(result.stats.lastActiveDate).toBe("2026-11-08");
  });
  it("prefers the premium monthly allowance", () => {
    expect(applyStreakProtection(stats, [], "2026-11-09", true, 2)).toMatchObject({ used: true, owned: 2 });
  });
  it("does nothing without protections or when more than one day was missed", () => {
    expect(applyStreakProtection(stats, [], "2026-11-09", false, 0).used).toBe(false);
    expect(applyStreakProtection(stats, [], "2026-11-10", false, 3).used).toBe(false);
  });
  it("keeps the stock through normalize", () => {
    expect(normalizeInsights({ streakFreezes: 3 }).streakFreezes).toBe(3);
    expect(normalizeInsights({ streakFreezes: 99 }).streakFreezes).toBe(10);
  });
});

import { describe, expect, it } from "vitest";
import {
  BUILDINGS,
  claimStreakChest,
  completeQuest,
  EMPTY_CITY,
  getBuildingStatus,
  getCoinsAvailable,
  getDailyQuests,
  isCityAsleep,
  mergeCity,
  normalizeCity,
  upgradeBuilding,
} from "@/app/lib/city";
import { DEFAULT_INSIGHTS, DEFAULT_STATS } from "@/app/lib/defaults";
import { mergeProgressSnapshots, normalizeInsights } from "@/app/lib/progress";
import type { LearningInsights, UserStats } from "@/app/lib/types";

const stats = (xp: number, learnedWords: number): UserStats => ({ ...DEFAULT_STATS, xp, learnedWords });
const insightsWith = (topicId: string, count: number): LearningInsights => ({
  ...DEFAULT_INSIGHTS,
  learnedWordsByTopic: { [topicId]: Array.from({ length: count }, (_, index) => ({ id: `w${index}`, de: `d${index}`, x: `x${index}` })) },
});

describe("city", () => {
  it("earns coins from xp and learned words", () => {
    expect(getCoinsAvailable(stats(100, 2), EMPTY_CITY)).toBe(20 + 6);
  });

  it("requires words first, then coins, then upgrades", () => {
    const bakery = BUILDINGS[0];
    expect(getBuildingStatus(bakery, EMPTY_CITY, stats(1000, 0), DEFAULT_INSIGHTS).blockedBy).toBe("words");
    expect(getBuildingStatus(bakery, EMPTY_CITY, stats(0, 3), insightsWith("food_01", 3)).blockedBy).toBe("coins");
    const rich = stats(1000, 3);
    const city = upgradeBuilding(EMPTY_CITY, "bakery", rich, insightsWith("food_01", 3));
    expect(city.buildings.bakery).toBe(1);
    expect(city.coinsSpent).toBe(bakery.cost[0]);
    expect(upgradeBuilding(city, "bakery", rich, insightsWith("food_01", 3)).buildings.bakery).toBe(1);
  });

  it("gives the same three quests for a date on every device", () => {
    const quests = getDailyQuests("2026-11-06");
    expect(quests).toHaveLength(3);
    expect(new Set(quests.map((quest) => quest.id)).size).toBe(3);
    expect(getDailyQuests("2026-11-06")).toEqual(quests);
  });

  it("completes quests once and pays rewards", () => {
    const quest = getDailyQuests("2026-11-06")[0];
    const city = completeQuest(completeQuest(EMPTY_CITY, "2026-11-06", quest.id), "2026-11-06", quest.id);
    expect(city.questsDone["2026-11-06"]).toEqual([quest.id]);
    expect(getCoinsAvailable(stats(0, 0), city)).toBe(quest.reward);
    expect(getCoinsAvailable(stats(0, 0), claimStreakChest(city, "2026-11-06"))).toBe(quest.reward + 20);
  });

  it("merges by keeping the higher building level and the cheapest consistent spending", () => {
    const a = { ...EMPTY_CITY, buildings: { bakery: 2 }, coinsSpent: 160 };
    const b = { ...EMPTY_CITY, buildings: { bakery: 1, park: 1 }, coinsSpent: 90 };
    const merged = mergeCity(a, b);
    expect(merged.buildings).toEqual({ bakery: 2, park: 1 });
    expect(merged.coinsSpent).toBe(40 + 120 + 50);
  });

  it("survives corrupt data and round-trips through insights normalization", () => {
    expect(normalizeCity({ buildings: { bakery: 99, nope: 1 }, coinsSpent: -5, questsDone: { bad: ["q1"], "2026-01-01": ["q1", "zz"] } })).toEqual({
      buildings: { bakery: 3 },
      coinsSpent: 0,
      questsDone: { "2026-01-01": ["q1"] },
      chestsClaimed: [],
    });
    const insights = normalizeInsights({ ...DEFAULT_INSIGHTS, city: { buildings: { park: 1 }, coinsSpent: 50 } });
    expect(insights.city?.buildings.park).toBe(1);
    expect(normalizeInsights(DEFAULT_INSIGHTS).city).toBeUndefined();
  });

  it("keeps the city when merging cloud and local snapshots", () => {
    const base = { schemaVersion: 3, stats: stats(0, 0), settings: {}, updatedAt: 1 };
    const local = { ...base, learningInsights: { ...DEFAULT_INSIGHTS, city: { ...EMPTY_CITY, buildings: { park: 1 }, coinsSpent: 50 } } };
    const cloud = { ...base, updatedAt: 2, learningInsights: { ...DEFAULT_INSIGHTS, city: { ...EMPTY_CITY, buildings: { bakery: 1 }, coinsSpent: 40 } } };
    const merged = mergeProgressSnapshots(local as never, cloud as never);
    expect(merged.snapshot.learningInsights.city?.buildings).toEqual({ bakery: 1, park: 1 });
  });

  it("lets the town fall asleep after two idle days", () => {
    expect(isCityAsleep({ ...DEFAULT_STATS, lastActiveDate: "2026-11-04" }, "2026-11-06")).toBe(true);
    expect(isCityAsleep({ ...DEFAULT_STATS, lastActiveDate: "2026-11-05" }, "2026-11-06")).toBe(false);
    expect(isCityAsleep(DEFAULT_STATS, "2026-11-06")).toBe(false);
  });
});

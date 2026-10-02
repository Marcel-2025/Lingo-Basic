import { describe, expect, it } from "vitest";
import { PROGRESS_SCHEMA_VERSION } from "@/app/lib/defaults";
import { createQuestion } from "@/app/lib/exercises";
import { normalizePack } from "@/app/lib/pack-normalization";
import { mergeProgressSnapshots, normalizeDateKey, normalizeInsights, normalizeProgressSnapshot, normalizeSettings, normalizeStats } from "@/app/lib/progress";
import { isWordLearned, isWordMastered, recordLearningInInsights } from "@/app/hooks/use-learning-history";
import { getDateKey, getLevelFromXp, reconcileStreak, recordActivity, shiftDateKey, shuffle } from "@/app/lib/utils";
import type { CloudProgressSnapshot } from "@/app/lib/types";

const snapshot = (overrides: Partial<CloudProgressSnapshot> & { updatedAt: number }): CloudProgressSnapshot =>
  normalizeProgressSnapshot({ schemaVersion: PROGRESS_SCHEMA_VERSION, ...overrides });

describe("storage normalization", () => {
  it("survives corrupt values", () => {
    expect(normalizeSettings("garbage").targetLang).toBe("EN");
    const settings = normalizeSettings({ targetLang: "XX", contentLevel: "C2", theme: "Neon", difficulty: 9, dailyGoal: -5, timeZone: "Mars/Base" });
    expect(settings).toMatchObject({ targetLang: "EN", contentLevel: "A1", theme: "Ocean", difficulty: "all", dailyGoal: 20, soundEnabled: true });
    expect(normalizeStats({ xp: "abc", correctAnswers: 10, totalAnswers: 4 })).toMatchObject({ xp: 0, level: 1, correctAnswers: 4 });
    expect(normalizeInsights({ learnedDays: { "2026-01-01": 2, nonsense: 3 }, masteredWordIds: [1, "a", "a"] })).toEqual({
      learnedDays: { "2026-01-01": 2 },
      learnedWordsByTopic: {},
      masteredWordIds: ["a"],
    });
  });

  it("migrates legacy learned words stored as strings", () => {
    const insights = normalizeInsights({ learnedWordsByTopic: { food_01: ["Wasser", { id: "food_01_bread", de: "Brot", x: "bread" }] } });
    expect(insights.learnedWordsByTopic.food_01).toEqual([
      { id: "legacy_food_01_1", de: "Wasser", x: "" },
      { id: "food_01_bread", de: "Brot", x: "bread" },
    ]);
  });

  it("migrates Date.toDateString() activity dates", () => {
    expect(normalizeDateKey("Sun Jul 26 2026")).toBe("2026-07-26");
    expect(normalizeDateKey("2026-07-26")).toBe("2026-07-26");
    expect(normalizeDateKey("nope")).toBe("");
  });

  it("recalculates the level from XP", () => {
    expect(getLevelFromXp(0)).toBe(1);
    expect(getLevelFromXp(100)).toBe(2);
    expect(getLevelFromXp(400)).toBe(3);
    expect(normalizeStats({ xp: 400, level: 99 }).level).toBe(3);
  });
});

describe("streaks (calendar based, time zone safe)", () => {
  const base = normalizeStats({});

  it("shifts date keys across month and year boundaries", () => {
    expect(shiftDateKey("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDateKey("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("uses the user's time zone for the calendar day", () => {
    const instant = new Date("2026-07-26T23:30:00Z");
    expect(getDateKey(instant, "UTC")).toBe("2026-07-26");
    expect(getDateKey(instant, "Europe/Berlin")).toBe("2026-07-27");
    expect(getDateKey(instant, "America/New_York")).toBe("2026-07-26");
  });

  it("increments on consecutive days and resets after a gap", () => {
    const day1 = recordActivity(base, "Europe/Berlin", new Date("2026-07-26T10:00:00Z"));
    expect(day1).toMatchObject({ streak: 1, lastActiveDate: "2026-07-26" });
    const sameDay = recordActivity(day1, "Europe/Berlin", new Date("2026-07-26T20:00:00Z"));
    expect(sameDay.streak).toBe(1);
    const day2 = recordActivity(day1, "Europe/Berlin", new Date("2026-07-27T08:00:00Z"));
    expect(day2.streak).toBe(2);
    const afterGap = recordActivity(day2, "Europe/Berlin", new Date("2026-07-30T08:00:00Z"));
    expect(afterGap.streak).toBe(1);
  });

  it("reconciles a broken streak on app start", () => {
    const stats = { ...base, streak: 5, lastActiveDate: "2026-07-20" };
    expect(reconcileStreak(stats, "UTC", new Date("2026-07-21T12:00:00Z")).streak).toBe(5);
    expect(reconcileStreak(stats, "UTC", new Date("2026-07-23T12:00:00Z")).streak).toBe(0);
  });
});

describe("cloud merge", () => {
  it("takes settings from the newer side", () => {
    const local = snapshot({ updatedAt: 200, settings: { ...normalizeSettings({}), theme: "Grape" } });
    const cloud = snapshot({ updatedAt: 100, settings: { ...normalizeSettings({}), theme: "Lime" } });
    expect(mergeProgressSnapshots(local, cloud).snapshot.settings.theme).toBe("Grape");
    expect(mergeProgressSnapshots({ ...local, updatedAt: 50 }, cloud).snapshot.settings.theme).toBe("Lime");
  });

  it("never drops learning history or counters", () => {
    const local = snapshot({
      updatedAt: 100,
      stats: normalizeStats({ xp: 50, totalAnswers: 10, correctAnswers: 8, streak: 2, lastActiveDate: "2026-07-27" }),
      learningInsights: normalizeInsights({ learnedDays: { "2026-07-27": 3 }, learnedWordsByTopic: { food_01: [{ id: "food_01_water", de: "Wasser", x: "water", lang: "EN" }] }, masteredWordIds: ["EN:food_01_water"] }),
    });
    const cloud = snapshot({
      updatedAt: 300,
      stats: normalizeStats({ xp: 30, totalAnswers: 4, correctAnswers: 4, streak: 9, lastActiveDate: "2026-07-25" }),
      learningInsights: normalizeInsights({ learnedDays: { "2026-07-25": 1, "2026-07-27": 1 }, learnedWordsByTopic: { food_01: [{ id: "food_01_bread", de: "Brot", x: "bread", lang: "EN" }] } }),
    });
    const { snapshot: merged, localChanged, cloudChanged } = mergeProgressSnapshots(local, cloud);
    expect(merged.stats).toMatchObject({ xp: 50, totalAnswers: 10, correctAnswers: 8, streak: 2, lastActiveDate: "2026-07-27" });
    expect(merged.learningInsights.learnedDays).toEqual({ "2026-07-25": 1, "2026-07-27": 3 });
    expect(merged.learningInsights.learnedWordsByTopic.food_01.map((entry) => entry.id).sort()).toEqual(["food_01_bread", "food_01_water"]);
    expect(merged.learningInsights.masteredWordIds).toEqual(["EN:food_01_water"]);
    expect(localChanged).toBe(true);
    expect(cloudChanged).toBe(true);
    expect(merged.updatedAt).toBeGreaterThan(300);
  });

  it("reports no changes for identical snapshots", () => {
    const local = snapshot({ updatedAt: 100, stats: normalizeStats({ xp: 10 }) });
    const result = mergeProgressSnapshots(local, { ...local });
    expect(result.localChanged).toBe(false);
    expect(result.cloudChanged).toBe(false);
  });

  it("fills missing cloud fields with defaults", () => {
    const cloud = normalizeProgressSnapshot({ updatedAt: 5 });
    expect(cloud.settings.targetLang).toBe("EN");
    expect(cloud.stats.xp).toBe(0);
    expect(cloud.learningInsights.learnedDays).toEqual({});
  });
});

describe("learning history by word ID and language", () => {
  const empty = normalizeInsights({});

  it("tracks by ID, not visible text, and separates languages", () => {
    const afterEn = recordLearningInInsights(empty, { topicId: "food_01", word: { id: "food_01_water", de: "Wasser", x: "water", lang: "EN" }, mastered: true, dateKey: "2026-07-27" });
    expect(isWordLearned(afterEn, "food_01", "food_01_water", "EN")).toBe(true);
    expect(isWordLearned(afterEn, "food_01", "food_01_water", "IT")).toBe(false);
    expect(isWordMastered(afterEn, "food_01_water", "EN")).toBe(true);
    expect(isWordMastered(afterEn, "food_01_water", "IT")).toBe(false);

    const again = recordLearningInInsights(afterEn, { topicId: "food_01", word: { id: "food_01_water", de: "Wasser (korrigiert)", x: "water", lang: "EN" }, mastered: true, dateKey: "2026-07-27" });
    expect(again.learnedWordsByTopic.food_01).toHaveLength(1);
    expect(again.learnedDays["2026-07-27"]).toBe(2);
  });

  it("treats legacy entries without language as learned for every language", () => {
    const legacy = normalizeInsights({ learnedWordsByTopic: { food_01: [{ id: "food_01_water", de: "Wasser", x: "water" }] }, masteredWordIds: ["food_01_water"] });
    expect(isWordLearned(legacy, "food_01", "food_01_water", "IT")).toBe(true);
    expect(isWordMastered(legacy, "food_01_water", "RU")).toBe(true);
  });
});

describe("exercises", () => {
  const pack = normalizePack({
    lang: "EN",
    level: "A1",
    topics: [{ id: "t", title: "T", vocab: [["Eins", "one"], ["Zwei", "two"], ["Drei", "three"], ["Vier", "four"], ["Fünf", "five"], ["Auch Eins", "one"]].map(([de, x]) => ({ de, x })) }],
  }).pack!;

  it("creates one correct and three distinct wrong options", () => {
    for (let index = 0; index < 50; index += 1) {
      const question = createQuestion(pack);
      expect(question).not.toBeNull();
      expect(question!.options).toHaveLength(4);
      expect(new Set(question!.options).size).toBe(4);
      expect(question!.options).toContain(question!.word.x);
    }
  });

  it("requires at least four vocab entries", () => {
    const small = { ...pack, topics: [{ ...pack.topics[0], vocab: pack.topics[0].vocab.slice(0, 3) }] };
    expect(createQuestion(small)).toBeNull();
  });

  it("shuffle (Fisher-Yates) keeps all elements and does not mutate the input", () => {
    const input = [1, 2, 3, 4, 5];
    const output = shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
    expect([...output].sort()).toEqual(input);
  });
});

describe("firestore mapping", async () => {
  const { parseFirestoreProgress, toFirestoreFields } = await import("@/app/lib/cloud-sync");

  it("round-trips a snapshot through Firestore fields", () => {
    const original = snapshot({ updatedAt: 1234, stats: normalizeStats({ xp: 120 }) });
    const parsed = parseFirestoreProgress(toFirestoreFields(original));
    expect(parsed.stats.xp).toBe(120);
    expect(parsed.updatedAt).toBe(1234);
    expect(parsed.storedSchemaVersion).toBe(PROGRESS_SCHEMA_VERSION);
  });

  it("tolerates corrupt JSON fields", () => {
    const parsed = parseFirestoreProgress({ statsJson: { stringValue: "{broken" }, updatedAt: { integerValue: "7" } });
    expect(parsed.stats.xp).toBe(0);
    expect(parsed.updatedAt).toBe(7);
    expect(parsed.storedSchemaVersion).toBe(1);
  });
});

import { describe, expect, it } from "vitest";
import { buildLessonSteps, buildPath, correctOption, getPathProgress, mergeLessons, normalizeLessons, recordLessonResult, starsForMistakes } from "@/app/lib/lessons";
import { normalizeInsights } from "@/app/lib/progress";
import type { LanguagePack, VocabItem } from "@/app/lib/types";

const word = (id: string): VocabItem => ({ id, de: `de-${id}`, x: `x-${id}`, difficulty: 1, tags: [] });
const words = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => word(`${prefix}${i}`));
const pack: LanguagePack = {
  version: 1, lang: "EN", level: "A1", sentences: [],
  topics: [
    { id: "food", title: "Essen", difficulty: 1, vocab: words("f", 20) },
    { id: "home", title: "Zuhause", difficulty: 1, vocab: words("h", 12) },
    { id: "empty", title: "Leer", difficulty: 1, vocab: [] },
  ],
};
const empty = normalizeInsights({});

describe("learning path", () => {
  it("splits topics into lessons of 5 and merges tiny remainders", () => {
    const path = buildPath(pack);
    expect(path).toHaveLength(2);
    expect(path[0].lessons.map((lesson) => lesson.words.length)).toEqual([5, 5, 5, 5]);
    expect(path[1].lessons.map((lesson) => lesson.words.length)).toEqual([5, 7]);
    expect(path[0].lessons[2].id).toBe("EN:A1:food:2");
  });

  it("unlocks lessons one after another", () => {
    const path = buildPath(pack);
    let insights = empty;
    let progress = getPathProgress(path, insights);
    expect(progress.current?.id).toBe("EN:A1:food:0");
    expect(progress.status["EN:A1:food:1"]).toBe("locked");
    insights = recordLessonResult(insights, "EN:A1:food:0", 2);
    progress = getPathProgress(path, insights);
    expect(progress.status["EN:A1:food:0"]).toBe("done");
    expect(progress.current?.id).toBe("EN:A1:food:1");
    expect(progress).toMatchObject({ done: 1, total: 6 });
  });

  it("keeps the best rating and survives normalize + merge", () => {
    let insights = recordLessonResult(empty, "a", 3);
    insights = recordLessonResult(insights, "a", 1);
    expect(insights.lessons).toEqual({ a: 3 });
    expect(normalizeInsights(insights).lessons).toEqual({ a: 3 });
    expect(normalizeLessons({ a: 0, b: 7, c: "x" })).toEqual({ b: 3 });
    expect(mergeLessons({ a: 1, b: 3 }, { a: 2 })).toEqual({ a: 2, b: 3 });
  });

  it("rates mistakes", () => {
    expect([0, 1, 2, 3, 9].map(starsForMistakes)).toEqual([3, 2, 2, 1, 1]);
  });

  it("builds learn steps then one quiz step per word with 4 distinct options incl. the answer", () => {
    const path = buildPath(pack);
    const lesson = path[0].lessons[0];
    const steps = buildLessonSteps(lesson, pack.topics[0].vocab, pack.topics.flatMap((topic) => topic.vocab));
    expect(steps).toHaveLength(10);
    expect(steps.slice(0, 5).every((step) => step.kind === "learn")).toBe(true);
    for (const step of steps.slice(5)) {
      if (step.kind === "learn") throw new Error("unexpected");
      expect(new Set(step.options).size).toBe(4);
      expect(step.options).toContain(correctOption(step));
    }
    expect(new Set(steps.slice(5).map((step) => step.kind)).size).toBe(3);
  });
});

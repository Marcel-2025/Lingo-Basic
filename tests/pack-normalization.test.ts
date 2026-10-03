import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getLegacyPackPath, getPackKey, getPackPath, SUPPORTED_LANGUAGES, SUPPORTED_LEVELS } from "@/app/lib/languages";
import { findTopicForWord, getVocabFromPack, normalizeDifficulty, normalizePack, slugify } from "@/app/lib/pack-normalization";

const word = (de: string, x: string, extra: Record<string, unknown> = {}) => ({ de, x, ...extra });

describe("normalizeDifficulty", () => {
  it("keeps numeric values", () => {
    expect(normalizeDifficulty(1)).toBe(1);
    expect(normalizeDifficulty(2)).toBe(2);
    expect(normalizeDifficulty(3)).toBe(3);
  });

  it("converts legacy easy/medium/hard", () => {
    expect(normalizeDifficulty("easy")).toBe(1);
    expect(normalizeDifficulty("medium")).toBe(2);
    expect(normalizeDifficulty("hard")).toBe(3);
  });

  it("falls back for invalid values", () => {
    expect(normalizeDifficulty(7)).toBe(1);
    expect(normalizeDifficulty("extreme", 2)).toBe(2);
    expect(normalizeDifficulty(undefined, 3)).toBe(3);
  });
});

describe("slugify / word IDs", () => {
  it("creates ASCII slugs including umlauts and ß", () => {
    expect(slugify("Straße")).toBe("strasse");
    expect(slugify("Frühstück & Café")).toBe("fruhstuck_cafe");
    expect(slugify("  ")).toBe("entry");
  });

  it("generates topicId + German slug for missing IDs (identical across languages)", () => {
    const en = normalizePack({ lang: "EN", level: "A1", topics: [{ id: "food_01", title: "Essen", vocab: [word("Wasser", "water")] }] });
    const ru = normalizePack({ lang: "RU", level: "A1", topics: [{ id: "food_01", title: "Essen", vocab: [word("Wasser", "вода")] }] });
    expect(en.pack?.topics[0].vocab[0].id).toBe("food_01_wasser");
    expect(ru.pack?.topics[0].vocab[0].id).toBe("food_01_wasser");
    expect(en.warnings.some((warning) => warning.includes("generierte ID"))).toBe(true);
  });

  it("keeps supplied IDs even if the text changes", () => {
    const result = normalizePack({ lang: "EN", level: "A1", topics: [{ id: "food_01", title: "Essen", vocab: [word("Wasser (still)", "still water", { id: "food_01_water" })] }] });
    expect(result.pack?.topics[0].vocab[0].id).toBe("food_01_water");
  });

  it("de-duplicates duplicate word IDs with a warning", () => {
    const result = normalizePack({
      lang: "EN",
      level: "A1",
      topics: [{ id: "t", title: "T", vocab: [word("A", "a", { id: "dup" }), word("B", "b", { id: "dup" })] }],
    });
    expect(result.pack?.topics[0].vocab.map((entry) => entry.id)).toEqual(["dup", "dup_2"]);
    expect(result.warnings.some((warning) => warning.includes("Doppelte Word-ID"))).toBe(true);
  });
});

describe("normalizePack", () => {
  it("rejects non-objects and unsupported languages/levels without throwing", () => {
    expect(normalizePack(null).pack).toBeNull();
    expect(normalizePack("text").pack).toBeNull();
    expect(normalizePack({ lang: "XX", level: "A1", topics: [] }).errors.join(" ")).toContain("lang");
    expect(normalizePack({ lang: "EN", level: "C2", topics: [] }).errors.join(" ")).toContain("level");
  });

  it("accepts lowercase lang/level", () => {
    const result = normalizePack({ lang: "en", level: "a1", vocab: [word("Haus", "house")] });
    expect(result.pack?.lang).toBe("EN");
    expect(result.pack?.level).toBe("A1");
  });

  it("loads legacy flat vocab lists into a fallback topic 'Allgemein'", () => {
    const result = normalizePack({
      version: 1,
      lang: "ES",
      level: "A1",
      vocab: [word("Haus", "casa", { difficulty: "hard" }), word("Hund", "perro")],
    });
    expect(result.pack?.topics).toHaveLength(1);
    expect(result.pack?.topics[0].title).toBe("Allgemein");
    expect(result.pack?.topics[0].id).toBe("general");
    expect(result.pack?.topics[0].vocab[0]).toMatchObject({ id: "general_haus", difficulty: 3, tags: ["allgemein"] });
    expect(result.pack?.version).toBeGreaterThanOrEqual(3);
  });

  it("fills missing tags and difficulty from the topic", () => {
    const result = normalizePack({ lang: "FR", level: "A2", topics: [{ id: "city", title: "Stadt & Leben", difficulty: "medium", vocab: [word("Ampel", "feu")] }] });
    expect(result.pack?.topics[0].vocab[0]).toMatchObject({ difficulty: 2, tags: ["stadt_leben"] });
  });

  it("fails for incomplete packs instead of crashing", () => {
    const result = normalizePack({ lang: "EN", level: "A1", topics: [{ id: "t", title: "T", vocab: [{ de: "Nur Deutsch" }] }] });
    expect(result.pack).toBeNull();
    expect(result.errors.join(" ")).toContain("de und x");
  });

  it("normalizes sentences with stable IDs, translations and focusWord", () => {
    const result = normalizePack({
      lang: "IT",
      level: "A1",
      vocab: [word("Haus", "casa")],
      sentences: [{ de: "Das ist mein Haus.", x: "Questa è la mia casa.", focusWord: "casa" }, { id: "s2", de: "Hallo", translations: { it: "Ciao" } }],
    });
    expect(result.pack?.sentences[0]).toMatchObject({ id: "sent_001", translations: { it: "Questa è la mia casa." }, focusWord: "casa" });
    expect(result.pack?.sentences[1].id).toBe("s2");
  });

  it("repairs Latin-1 mojibake", () => {
    const result = normalizePack({ lang: "EN", level: "A1", vocab: [word("FrÃ¼hstÃ¼ck", "breakfast")] });
    expect(result.pack?.topics[0].vocab[0].de).toBe("Frühstück");
  });

  it("finds topics and vocab by word ID", () => {
    const { pack } = normalizePack({ lang: "EN", level: "A1", topics: [{ id: "a", title: "A", vocab: [word("X", "x", { id: "a_x" })] }, { id: "b", title: "B", vocab: [word("Y", "y", { id: "b_y" })] }] });
    expect(pack && getVocabFromPack(pack)).toHaveLength(2);
    expect(pack && findTopicForWord(pack, "b_y")?.id).toBe("b");
  });
});

describe("language/level paths", () => {
  it("builds /packs/{lang}/{level}.json", () => {
    expect(getPackPath("EN", "A1")).toBe("/packs/en/a1.json");
    expect(getPackPath("IT", "B1")).toBe("/packs/it/b1.json");
    expect(getLegacyPackPath("RU")).toBe("/packs/ru.json");
  });

  it("uses language + level as cache key", () => {
    expect(getPackKey("EN", "A1")).toBe("EN:A1");
    expect(getPackKey("EN", "A1")).not.toBe(getPackKey("EN", "A2"));
  });
});

describe("shipped packs", () => {
  const root = path.resolve(__dirname, "..");

  for (const [code, language] of Object.entries(SUPPORTED_LANGUAGES)) {
    for (const level of SUPPORTED_LEVELS) {
      const file = path.join(root, "public", "packs", language.fileName, `${level.toLowerCase()}.json`);
      it(`${code} ${level} normalizes without errors or changes to IDs`, () => {
        const raw = JSON.parse(readFileSync(file, "utf8"));
        const result = normalizePack(raw);
        expect(result.errors).toEqual([]);
        expect(result.pack?.lang).toBe(code);
        expect(result.pack?.level).toBe(level);
        const rawIds = raw.topics.flatMap((topic: { vocab: { id: string }[] }) => topic.vocab.map((entry) => entry.id));
        expect(getVocabFromPack(result.pack!).map((entry) => entry.id)).toEqual(rawIds);
      });
    }
  }

  it("legacy flat packs still load", () => {
    const legacyFiles = readdirSync(path.join(root, "public", "packs")).filter((file) => file.endsWith(".json"));
    for (const file of legacyFiles) {
      const result = normalizePack(JSON.parse(readFileSync(path.join(root, "public", "packs", file), "utf8")));
      expect(result.pack, file).not.toBeNull();
    }
  });
});

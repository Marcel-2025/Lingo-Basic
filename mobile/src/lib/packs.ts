import { getPackKey, SUPPORTED_LANGUAGES } from "@/app/lib/languages";
import { normalizePack } from "@/app/lib/pack-normalization";
import type { CefrLevel, Difficulty, LanguageCode, LanguagePack } from "@/app/lib/types";
import { BUNDLED_PACKS } from "~/lib/bundled-packs";
import { readJson, STORAGE_KEYS, writeJson } from "~/lib/storage";

export type PackSource = "bundled" | "import";

export interface PackLoadResult {
  pack: LanguagePack | null;
  source?: PackSource;
  message?: string;
}

type ImportedPacks = Record<string, unknown>;

/**
 * Offline-first: imported packs (validated, stored in AsyncStorage under `${lang}:${level}`) take precedence,
 * otherwise the pack bundled into the app is used. No network is needed to learn.
 */
export const loadPack = async (lang: LanguageCode, level: CefrLevel): Promise<PackLoadResult> => {
  const key = getPackKey(lang, level);
  const imported = await readJson<ImportedPacks>(STORAGE_KEYS.importedPacks, {});
  if (imported[key]) {
    const result = normalizePack(imported[key]);
    if (result.pack) return { pack: result.pack, source: "import" };
  }
  const bundled = BUNDLED_PACKS[key];
  if (!bundled) return { pack: null, message: `${SUPPORTED_LANGUAGES[lang].label} ${level} ist noch nicht verfügbar.` };
  const result = normalizePack(bundled());
  return result.pack
    ? { pack: result.pack, source: "bundled" }
    : { pack: null, message: result.errors.slice(0, 2).join(" ") || "Das Sprachpaket ist ungültig." };
};

export const importPack = async (input: unknown) => {
  const result = normalizePack(input);
  if (!result.pack) throw new Error(result.errors.slice(0, 3).join(" ") || "Das Sprachpaket ist ungültig.");
  const imported = await readJson<ImportedPacks>(STORAGE_KEYS.importedPacks, {});
  imported[getPackKey(result.pack.lang, result.pack.level)] = result.pack;
  await writeJson(STORAGE_KEYS.importedPacks, imported);
  return result;
};

export const removeImportedPack = async (lang: LanguageCode, level: CefrLevel) => {
  const imported = await readJson<ImportedPacks>(STORAGE_KEYS.importedPacks, {});
  delete imported[getPackKey(lang, level)];
  await writeJson(STORAGE_KEYS.importedPacks, imported);
};

export const clearImportedPacks = () => writeJson(STORAGE_KEYS.importedPacks, {});

export const filterPackByDifficulty = (pack: LanguagePack, difficulty: "all" | Difficulty): LanguagePack =>
  difficulty === "all"
    ? pack
    : {
        ...pack,
        topics: pack.topics
          .map((topic) => ({ ...topic, vocab: topic.vocab.filter((word) => word.difficulty === difficulty) }))
          .filter((topic) => topic.vocab.length > 0),
      };

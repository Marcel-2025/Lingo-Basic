import { getPackKey } from "@/app/lib/languages";
import { normalizePack } from "@/app/lib/pack-normalization";
import type { CefrLevel, Difficulty, LanguageCode, LanguagePack } from "@/app/lib/types";
import { t } from "~/i18n";
import { buildPack } from "~/lib/content";
import { readJson, STORAGE_KEYS, writeJson } from "~/lib/storage";

export type PackSource = "bundled" | "import";

export interface PackLoadResult {
  pack: LanguagePack | null;
  source?: PackSource;
  message?: string;
}

type ImportedPacks = Record<string, unknown>;

/**
 * Offline-first: imported packs (validated, stored in AsyncStorage under `${lang}:${level}`, German-based) take
 * precedence when the base language is German; otherwise the pack is built from the bundled multilingual content.
 * No network is needed to learn. `message` is a translation key.
 */
export const loadPack = async (base: LanguageCode, lang: LanguageCode, level: CefrLevel): Promise<PackLoadResult> => {
  const key = getPackKey(lang, level);
  if (base === "DE") {
    const imported = await readJson<ImportedPacks>(STORAGE_KEYS.importedPacks, {});
    if (imported[key]) {
      const result = normalizePack(imported[key]);
      if (result.pack) return { pack: result.pack, source: "import" };
    }
  }
  const pack = buildPack(base, lang, level);
  return pack ? { pack, source: "bundled" } : { pack: null, message: "packs.unavailable" };
};

export const importPack = async (input: unknown) => {
  const result = normalizePack(input);
  if (!result.pack) throw new Error(result.errors.slice(0, 3).join(" ") || t("packs.invalid"));
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

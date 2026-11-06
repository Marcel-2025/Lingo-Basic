import type { CefrLevel, LanguageCode } from "@/app/lib/types";

export const SUPPORTED_LANGUAGES: Record<LanguageCode, { label: string; fileName: string; speechCode: string }> = {
  DE: { label: "Deutsch", fileName: "de", speechCode: "de-DE" },
  EN: { label: "Englisch", fileName: "en", speechCode: "en-US" },
  ES: { label: "Spanisch", fileName: "es", speechCode: "es-ES" },
  FR: { label: "Französisch", fileName: "fr", speechCode: "fr-FR" },
  RU: { label: "Russisch", fileName: "ru", speechCode: "ru-RU" },
  IT: { label: "Italienisch", fileName: "it", speechCode: "it-IT" },
  TR: { label: "Türkisch", fileName: "tr", speechCode: "tr-TR" },
  PT: { label: "Portugiesisch", fileName: "pt", speechCode: "pt-PT" },
  NL: { label: "Niederländisch", fileName: "nl", speechCode: "nl-NL" },
  PL: { label: "Polnisch", fileName: "pl", speechCode: "pl-PL" },
};

export const SUPPORTED_LEVELS: CefrLevel[] = ["A1", "A2", "B1"];

export const DEFAULT_LANGUAGE: LanguageCode = "EN";
export const DEFAULT_UI_LANGUAGE: LanguageCode = "DE";

/** Target languages that can be learned from `base` (every supported language except the base itself). */
export const getLearnableLanguages = (base: LanguageCode): LanguageCode[] =>
  (Object.keys(SUPPORTED_LANGUAGES) as LanguageCode[]).filter((code) => code !== base);

/** Picks a sensible target when it would equal the base language: German speakers learn English, everyone else German. */
export const getDefaultTargetFor = (base: LanguageCode): LanguageCode => (base === "DE" ? "EN" : "DE");
export const DEFAULT_LEVEL: CefrLevel = "A1";

export const getPackKey = (lang: LanguageCode, level: CefrLevel) => `${lang}:${level}`;

export const getPackPath = (lang: LanguageCode, level: CefrLevel) =>
  `/packs/${SUPPORTED_LANGUAGES[lang].fileName}/${level.toLowerCase()}.json`;

export const getLegacyPackPath = (lang: LanguageCode) =>
  `/packs/${SUPPORTED_LANGUAGES[lang].fileName}.json`;

export const isLanguageCode = (value: unknown): value is LanguageCode =>
  typeof value === "string" && value in SUPPORTED_LANGUAGES;

export const isCefrLevel = (value: unknown): value is CefrLevel =>
  typeof value === "string" && SUPPORTED_LEVELS.includes(value as CefrLevel);

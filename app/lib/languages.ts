import type { CefrLevel, LanguageCode } from "@/app/lib/types";

export const SUPPORTED_LANGUAGES: Record<LanguageCode, { label: string; fileName: string; speechCode: string }> = {
  EN: { label: "Englisch", fileName: "en", speechCode: "en-US" },
  ES: { label: "Spanisch", fileName: "es", speechCode: "es-ES" },
  FR: { label: "Französisch", fileName: "fr", speechCode: "fr-FR" },
  RU: { label: "Russisch", fileName: "ru", speechCode: "ru-RU" },
  IT: { label: "Italienisch", fileName: "it", speechCode: "it-IT" },
};

export const SUPPORTED_LEVELS: CefrLevel[] = ["A1", "A2", "B1"];

export const DEFAULT_LANGUAGE: LanguageCode = "EN";
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

import { useSyncExternalStore } from "react";
import type { LanguageCode } from "@/app/lib/types";
import { de } from "~/i18n/de";
import { en } from "~/i18n/en";
import { es } from "~/i18n/es";
import { fr } from "~/i18n/fr";
import { it } from "~/i18n/it";
import { nl } from "~/i18n/nl";
import { pl } from "~/i18n/pl";
import { pt } from "~/i18n/pt";
import { ru } from "~/i18n/ru";
import { tr } from "~/i18n/tr";

/**
 * Tiny i18n layer: nested dictionaries per language, flattened to "section.key" at load time.
 * `t()` works anywhere (notifications, purchase messages); `useT()` re-renders components when the
 * app language changes. Missing keys fall back to German, so a half-translated language never shows raw keys.
 */

type Flat = Record<string, string>;
type DeepKeys<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : DeepKeys<T[K], `${Prefix}${K}.`>;
}[keyof T & string];
/** All keys, with the plural suffix stripped ("common.words" for common.words_one/_other). */
export type TranslationKey = DeepKeys<typeof de> extends infer K ? (K extends `${infer Base}_one` ? Base : K extends `${infer Base}_other` ? Base : K) : never;
export type Params = Record<string, string | number>;

const flatten = (value: unknown, prefix = "", into: Flat = {}): Flat => {
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) flatten(entry, prefix ? `${prefix}.${key}` : key, into);
  } else if (typeof value === "string") {
    into[prefix] = value;
  }
  return into;
};

const LOADERS: Record<LanguageCode, () => unknown> = {
  DE: () => de,
  EN: () => en,
  ES: () => es,
  FR: () => fr,
  IT: () => it,
  PT: () => pt,
  NL: () => nl,
  PL: () => pl,
  RU: () => ru,
  TR: () => tr,
};

const cache = new Map<LanguageCode, Flat>();
const dictionary = (lang: LanguageCode) => {
  let flat = cache.get(lang);
  if (!flat) {
    flat = flatten(LOADERS[lang]());
    cache.set(lang, flat);
  }
  return flat;
};
const fallback = dictionary("DE");

/** Plural category for the handful of rules the supported languages need (Intl.PluralRules is not reliable on Hermes). */
const pluralSuffix = (lang: LanguageCode, n: number) => {
  const abs = Math.abs(n);
  if (lang === "RU" || lang === "PL") {
    const mod10 = abs % 10;
    const mod100 = abs % 100;
    if (mod10 === 1 && mod100 !== 11) return "one";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "few";
    return "many";
  }
  if (lang === "FR" || lang === "PT" || lang === "TR") return abs <= 1 ? "one" : "other";
  return abs === 1 ? "one" : "other";
};

let current: LanguageCode = "DE";
const listeners = new Set<() => void>();

export const setLanguage = (lang: LanguageCode) => {
  if (lang === current) return;
  current = lang;
  listeners.forEach((listener) => listener());
};
export const getLanguage = () => current;

const interpolate = (template: string, params?: Params) =>
  params ? template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match)) : template;

const lookup = (lang: LanguageCode, key: string, params?: Params) => {
  const flat = dictionary(lang);
  const n = params?.n;
  if (typeof n === "number") {
    const suffix = pluralSuffix(lang, n);
    const candidates = [`${key}_${suffix}`, suffix === "few" || suffix === "many" ? `${key}_other` : "", `${key}_other`, key].filter(Boolean);
    for (const candidate of candidates) {
      const hit = flat[candidate] ?? (lang === "DE" ? undefined : fallback[candidate]);
      if (hit !== undefined) return interpolate(hit, params);
    }
  }
  const text = flat[key] ?? fallback[key] ?? key;
  return interpolate(text, params);
};

/** Translates `key` in the current app language. `params.n` selects the plural form. */
export const t = (key: TranslationKey, params?: Params) => lookup(current, key, params);

/** Translation function bound to the current language; re-renders the component when the language changes. */
export const useT = () => {
  const lang = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => current,
  );
  return (key: TranslationKey, params?: Params) => lookup(lang, key, params);
};

export type Translate = ReturnType<typeof useT>;

/** Name of `lang` in the current app language. */
export const languageName = (lang: LanguageCode) => t(`languages.${lang}` as TranslationKey);

/** BCP-47 locale for dates and numbers, matching the app language. */
export const LOCALES: Record<LanguageCode, string> = {
  DE: "de-DE", EN: "en-US", ES: "es-ES", FR: "fr-FR", IT: "it-IT", PT: "pt-PT", NL: "nl-NL", PL: "pl-PL", RU: "ru-RU", TR: "tr-TR",
};

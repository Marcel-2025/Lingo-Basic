import { isCefrLevel, isLanguageCode } from "@/app/lib/languages";
import type {
  Difficulty,
  LanguagePack,
  LegacyDifficulty,
  PackNormalizationResult,
  SentenceItem,
  TopicItem,
  VocabItem,
} from "@/app/lib/types";

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : null;

const repairMojibake = (value: string) => {
  if (!/[ÃÐÑðŸâÅ]/.test(value)) return value;
  try {
    const bytes = Uint8Array.from([...value].map((character) => character.charCodeAt(0)));
    const repaired = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return repaired.includes("�") ? value : repaired;
  } catch {
    return value;
  }
};

const asTrimmedString = (value: unknown) => (typeof value === "string" ? repairMojibake(value).trim() : "");

const asStringArray = (value: unknown) =>
  Array.isArray(value) ? value.map(asTrimmedString).filter(Boolean) : [];

export const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "entry";

export const normalizeDifficulty = (value: unknown, fallback: Difficulty = 1): Difficulty => {
  if (value === 1 || value === 2 || value === 3) return value;
  const legacy: Record<LegacyDifficulty, Difficulty> = { easy: 1, medium: 2, hard: 3 };
  return typeof value === "string" && value in legacy ? legacy[value as LegacyDifficulty] : fallback;
};

const getUniqueId = (candidate: string, usedIds: Set<string>) => {
  let id = candidate;
  let duplicateNumber = 2;
  while (usedIds.has(id)) {
    id = `${candidate}_${duplicateNumber}`;
    duplicateNumber += 1;
  }
  usedIds.add(id);
  return id;
};

const normalizeVocab = (
  rawValue: unknown,
  topic: Pick<TopicItem, "id" | "title" | "difficulty">,
  index: number,
  usedIds: Set<string>,
  errors: string[],
  warnings: string[],
): VocabItem | null => {
  const raw = asRecord(rawValue);
  if (!raw) {
    errors.push(`${topic.id}.vocab[${index}] muss ein Objekt sein.`);
    return null;
  }

  const de = asTrimmedString(raw.de);
  const x = asTrimmedString(raw.x);
  if (!de || !x) {
    errors.push(`${topic.id}.vocab[${index}] benötigt die Felder de und x.`);
    return null;
  }

  const suppliedId = asTrimmedString(raw.id);
  const fallbackId = `${topic.id}_${slugify(x)}`;
  const id = getUniqueId(suppliedId || fallbackId, usedIds);
  if (!suppliedId) warnings.push(`${topic.id}.vocab[${index}] erhielt die generierte ID ${id}.`);
  if (suppliedId && id !== suppliedId) warnings.push(`Doppelte Word-ID ${suppliedId} wurde zu ${id} normalisiert.`);

  const tags = asStringArray(raw.tags);
  return {
    id,
    de,
    x,
    ex: asTrimmedString(raw.ex) || undefined,
    exTr: asTrimmedString(raw.exTr) || undefined,
    difficulty: normalizeDifficulty(raw.difficulty, topic.difficulty),
    tags: tags.length > 0 ? tags : [slugify(topic.title)],
  };
};

const normalizeTopic = (
  rawValue: unknown,
  index: number,
  usedTopicIds: Set<string>,
  usedWordIds: Set<string>,
  errors: string[],
  warnings: string[],
): TopicItem | null => {
  const raw = asRecord(rawValue);
  if (!raw) {
    errors.push(`topics[${index}] muss ein Objekt sein.`);
    return null;
  }

  const title = asTrimmedString(raw.title) || "Allgemein";
  const suppliedId = asTrimmedString(raw.id);
  const id = getUniqueId(suppliedId || `topic_${String(index + 1).padStart(2, "0")}_${slugify(title)}`, usedTopicIds);
  if (!suppliedId) warnings.push(`topics[${index}] erhielt die generierte ID ${id}.`);
  if (suppliedId && id !== suppliedId) warnings.push(`Doppelte Topic-ID ${suppliedId} wurde zu ${id} normalisiert.`);

  const topic: Omit<TopicItem, "vocab"> = {
    id,
    title,
    icon: asTrimmedString(raw.icon) || undefined,
    level: asTrimmedString(raw.level) || undefined,
    difficulty: normalizeDifficulty(raw.difficulty),
  };
  const rawVocab = Array.isArray(raw.vocab) ? raw.vocab : [];
  if (rawVocab.length === 0) errors.push(`${id} enthält keine Vokabeln.`);
  const vocab = rawVocab
    .map((entry, vocabIndex) => normalizeVocab(entry, topic, vocabIndex, usedWordIds, errors, warnings))
    .filter((entry): entry is VocabItem => entry !== null);

  return { ...topic, vocab };
};

const normalizeSentence = (
  rawValue: unknown,
  index: number,
  lang: string,
  usedIds: Set<string>,
  errors: string[],
  warnings: string[],
): SentenceItem | null => {
  const raw = asRecord(rawValue);
  if (!raw) {
    errors.push(`sentences[${index}] muss ein Objekt sein.`);
    return null;
  }
  const de = asTrimmedString(raw.de);
  if (!de) {
    errors.push(`sentences[${index}] benötigt de.`);
    return null;
  }
  const translationsRaw = asRecord(raw.translations) ?? {};
  const translations = Object.fromEntries(
    Object.entries(translationsRaw)
      .map(([key, value]) => [key, asTrimmedString(value)] as const)
      .filter(([, value]) => Boolean(value)),
  );
  const legacyX = asTrimmedString(raw.x);
  if (legacyX && !translations[lang.toLowerCase()]) translations[lang.toLowerCase()] = legacyX;

  const suppliedId = asTrimmedString(raw.id);
  const id = getUniqueId(suppliedId || `sent_${String(index + 1).padStart(3, "0")}`, usedIds);
  if (!suppliedId) warnings.push(`sentences[${index}] erhielt die generierte ID ${id}.`);

  return {
    id,
    de,
    x: legacyX || undefined,
    translations,
    focusWord: asTrimmedString(raw.focusWord) || undefined,
  };
};

export const normalizePack = (input: unknown): PackNormalizationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const raw = asRecord(input);
  if (!raw) return { pack: null, errors: ["Das Sprachpaket muss ein JSON-Objekt sein."], warnings };

  const rawLang = asTrimmedString(raw.lang).toUpperCase();
  const rawLevel = asTrimmedString(raw.level).toUpperCase();
  if (!isLanguageCode(rawLang)) errors.push("lang muss einer unterstützten Zielsprache entsprechen.");
  if (!isCefrLevel(rawLevel)) errors.push("level muss A1, A2 oder B1 sein.");
  if (errors.length > 0 || !isLanguageCode(rawLang) || !isCefrLevel(rawLevel)) return { pack: null, errors, warnings };

  const usedTopicIds = new Set<string>();
  const usedWordIds = new Set<string>();
  const rawTopics = Array.isArray(raw.topics) ? raw.topics : [];
  const rawLegacyVocab = Array.isArray(raw.vocab) ? raw.vocab : [];
  const topics = rawTopics.length > 0
    ? rawTopics
        .map((topic, index) => normalizeTopic(topic, index, usedTopicIds, usedWordIds, errors, warnings))
        .filter((topic): topic is TopicItem => topic !== null)
    : [];

  if (topics.length === 0 && rawLegacyVocab.length > 0) {
    warnings.push("Legacy-vocab wurde als Thema Allgemein normalisiert.");
    const fallback = normalizeTopic(
      { id: "general", title: "Allgemein", difficulty: 1, vocab: rawLegacyVocab },
      0,
      usedTopicIds,
      usedWordIds,
      errors,
      warnings,
    );
    if (fallback) topics.push(fallback);
  }
  if (topics.length === 0) errors.push("Das Sprachpaket enthält keine gültigen Themen oder Vokabeln.");

  const usedSentenceIds = new Set<string>();
  const sentences = (Array.isArray(raw.sentences) ? raw.sentences : [])
    .map((sentence, index) => normalizeSentence(sentence, index, rawLang, usedSentenceIds, errors, warnings))
    .filter((sentence): sentence is SentenceItem => sentence !== null);

  if (errors.length > 0) return { pack: null, errors, warnings };
  return {
    pack: {
      version: Math.max(3, Number(raw.version) || 1),
      lang: rawLang,
      level: rawLevel,
      topics,
      sentences,
    },
    errors,
    warnings,
  };
};

export const getVocabFromPack = (pack: LanguagePack) => pack.topics.flatMap((topic) => topic.vocab);

export const findTopicForWord = (pack: LanguagePack, wordId: string) =>
  pack.topics.find((topic) => topic.vocab.some((word) => word.id === wordId));

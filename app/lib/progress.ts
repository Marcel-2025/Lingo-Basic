import { DEFAULT_STATS, getDefaultSettings, PROGRESS_SCHEMA_VERSION } from "@/app/lib/defaults";
import { isCefrLevel, isLanguageCode } from "@/app/lib/languages";
import { getLevelFromXp } from "@/app/lib/utils";
import type {
  AppSettings,
  CloudProgressSnapshot,
  LanguageCode,
  LearnedWord,
  LearningInsights,
  ThemeName,
  UserStats,
} from "@/app/lib/types";

/**
 * Pure, framework-free normalization and merge logic for user progress.
 * Everything that comes from LocalStorage or Firestore passes through here,
 * so corrupted or outdated data never reaches React state unchecked.
 */

type UnknownRecord = Record<string, unknown>;

const THEMES: readonly ThemeName[] = ["Ocean", "Sunset", "Lime", "Grape"];
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const asRecord = (value: unknown): UnknownRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : {};

const asCount = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
};

const isValidTimeZone = (value: unknown): value is string => {
  if (typeof value !== "string" || !value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

/**
 * Converts stored activity dates to a stable `YYYY-MM-DD` key.
 * Older app versions stored `Date.toDateString()` values ("Sun Jul 26 2026"); those are migrated.
 */
export const normalizeDateKey = (value: unknown): string => {
  if (typeof value !== "string" || !value.trim()) return "";
  const trimmed = value.trim();
  if (DATE_KEY_PATTERN.test(trimmed)) return trimmed;
  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) return "";
  const date = new Date(parsed);
  // toDateString() has no time part, so it is interpreted as local midnight. Use the local calendar day.
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export const normalizeStats = (input: unknown): UserStats => {
  const raw = asRecord(input);
  const xp = asCount(raw.xp, DEFAULT_STATS.xp);
  const totalAnswers = asCount(raw.totalAnswers);
  return {
    xp,
    level: getLevelFromXp(xp),
    streak: asCount(raw.streak),
    lastActiveDate: normalizeDateKey(raw.lastActiveDate),
    learnedWords: asCount(raw.learnedWords),
    masteredWords: asCount(raw.masteredWords),
    correctAnswers: Math.min(asCount(raw.correctAnswers), totalAnswers),
    totalAnswers,
  };
};

export const normalizeSettings = (input: unknown): AppSettings => {
  const raw = asRecord(input);
  const defaults = getDefaultSettings();
  const difficulty = raw.difficulty === "all" ? "all" : Number(raw.difficulty);
  const dailyGoal = asCount(raw.dailyGoal, defaults.dailyGoal);
  return {
    targetLang: isLanguageCode(raw.targetLang) ? raw.targetLang : defaults.targetLang,
    contentLevel: isCefrLevel(raw.contentLevel) ? raw.contentLevel : defaults.contentLevel,
    difficulty: difficulty === "all" || difficulty === 1 || difficulty === 2 || difficulty === 3 ? difficulty : defaults.difficulty,
    dailyGoal: Math.min(200, Math.max(1, dailyGoal || defaults.dailyGoal)),
    theme: THEMES.includes(raw.theme as ThemeName) ? (raw.theme as ThemeName) : defaults.theme,
    isDarkMode: typeof raw.isDarkMode === "boolean" ? raw.isDarkMode : defaults.isDarkMode,
    soundEnabled: typeof raw.soundEnabled === "boolean" ? raw.soundEnabled : defaults.soundEnabled,
    vibrationEnabled: typeof raw.vibrationEnabled === "boolean" ? raw.vibrationEnabled : defaults.vibrationEnabled,
    timeZone: isValidTimeZone(raw.timeZone) ? raw.timeZone : defaults.timeZone,
  };
};

/** Key used to identify a learned or mastered word independent of the visible text. */
export const getWordProgressKey = (wordId: string, lang?: LanguageCode) => (lang ? `${lang}:${wordId}` : wordId);

const normalizeLearnedWord = (value: unknown, topicId: string, index: number): LearnedWord | null => {
  // Very old versions stored only the German text.
  if (typeof value === "string") {
    const text = value.trim();
    return text ? { id: `legacy_${topicId}_${index + 1}`, de: text, x: "" } : null;
  }
  const raw = asRecord(value);
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (!id) return null;
  return {
    id,
    de: typeof raw.de === "string" ? raw.de : "",
    x: typeof raw.x === "string" ? raw.x : "",
    ...(isLanguageCode(raw.lang) ? { lang: raw.lang } : {}),
  };
};

const dedupeWords = (words: LearnedWord[]) => {
  const seen = new Set<string>();
  return words.filter((word) => {
    const key = getWordProgressKey(word.id, word.lang);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const normalizeInsights = (input: unknown): LearningInsights => {
  const raw = asRecord(input);
  const learnedDays = Object.fromEntries(
    Object.entries(asRecord(raw.learnedDays))
      .filter(([dateKey]) => DATE_KEY_PATTERN.test(dateKey))
      .map(([dateKey, count]) => [dateKey, asCount(count)] as const)
      .filter(([, count]) => count > 0),
  );
  const learnedWordsByTopic = Object.fromEntries(
    Object.entries(asRecord(raw.learnedWordsByTopic)).map(([topicId, entries]) => [
      topicId,
      dedupeWords(
        (Array.isArray(entries) ? entries : [])
          .map((entry, index) => normalizeLearnedWord(entry, topicId, index))
          .filter((entry): entry is LearnedWord => entry !== null),
      ),
    ]),
  );
  const masteredWordIds = Array.isArray(raw.masteredWordIds)
    ? [...new Set(raw.masteredWordIds.filter((entry): entry is string => typeof entry === "string" && entry.length > 0))]
    : [];
  return { learnedDays, learnedWordsByTopic, masteredWordIds };
};

export const normalizeProgressSnapshot = (input: unknown): CloudProgressSnapshot => {
  const raw = asRecord(input);
  const settings = normalizeSettings(raw.settings);
  const updatedAt = Number(raw.updatedAt);
  return {
    schemaVersion: PROGRESS_SCHEMA_VERSION,
    stats: normalizeStats(raw.stats),
    settings,
    learningInsights: normalizeInsights(raw.learningInsights),
    updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : 0,
  };
};

const mergeInsights = (primary: LearningInsights, secondary: LearningInsights): LearningInsights => {
  const learnedDays = { ...secondary.learnedDays };
  Object.entries(primary.learnedDays).forEach(([dateKey, count]) => {
    learnedDays[dateKey] = Math.max(count, learnedDays[dateKey] ?? 0);
  });
  const topicIds = new Set([...Object.keys(primary.learnedWordsByTopic), ...Object.keys(secondary.learnedWordsByTopic)]);
  const learnedWordsByTopic = Object.fromEntries(
    [...topicIds].map((topicId) => [
      topicId,
      dedupeWords([...(primary.learnedWordsByTopic[topicId] ?? []), ...(secondary.learnedWordsByTopic[topicId] ?? [])]),
    ]),
  );
  return {
    learnedDays,
    learnedWordsByTopic,
    masteredWordIds: [...new Set([...primary.masteredWordIds, ...secondary.masteredWordIds])],
  };
};

const mergeStats = (primary: UserStats, secondary: UserStats): UserStats => {
  const xp = Math.max(primary.xp, secondary.xp);
  const streakSource = primary.lastActiveDate === secondary.lastActiveDate
    ? (primary.streak >= secondary.streak ? primary : secondary)
    : (primary.lastActiveDate > secondary.lastActiveDate ? primary : secondary);
  const totalAnswers = Math.max(primary.totalAnswers, secondary.totalAnswers);
  return {
    xp,
    level: getLevelFromXp(xp),
    streak: streakSource.streak,
    lastActiveDate: streakSource.lastActiveDate,
    learnedWords: Math.max(primary.learnedWords, secondary.learnedWords),
    masteredWords: Math.max(primary.masteredWords, secondary.masteredWords),
    correctAnswers: Math.min(totalAnswers, Math.max(primary.correctAnswers, secondary.correctAnswers)),
    totalAnswers,
  };
};

const serialize = (snapshot: CloudProgressSnapshot) =>
  JSON.stringify({ stats: snapshot.stats, settings: snapshot.settings, learningInsights: snapshot.learningInsights });

export interface ProgressMergeResult {
  snapshot: CloudProgressSnapshot;
  /** The merged state differs from the local state and must be applied locally. */
  localChanged: boolean;
  /** The merged state differs from the cloud state and must be uploaded. */
  cloudChanged: boolean;
}

/**
 * Merges a local and a cloud snapshot without silently dropping data:
 * - settings come from the more recently changed side,
 * - learning history (days, words, mastered IDs) is unioned,
 * - monotonic counters (XP, answers, learned words) keep the higher value,
 * - streak comes from the side with the later activity date.
 * Counters use the maximum, not the sum, because the shared baseline is unknown; this never loses progress
 * but can under-count when two offline devices learn in parallel.
 */
export const mergeProgressSnapshots = (localInput: CloudProgressSnapshot, cloudInput: CloudProgressSnapshot): ProgressMergeResult => {
  const local = normalizeProgressSnapshot(localInput);
  const cloud = normalizeProgressSnapshot(cloudInput);
  const localIsNewer = local.updatedAt > cloud.updatedAt;
  const newer = localIsNewer ? local : cloud;
  const older = localIsNewer ? cloud : local;
  const merged: CloudProgressSnapshot = {
    schemaVersion: PROGRESS_SCHEMA_VERSION,
    settings: newer.settings,
    stats: mergeStats(newer.stats, older.stats),
    learningInsights: mergeInsights(newer.learningInsights, older.learningInsights),
    updatedAt: Math.max(local.updatedAt, cloud.updatedAt),
  };
  const mergedKey = serialize(merged);
  const localChanged = mergedKey !== serialize(local);
  const cloudChanged = mergedKey !== serialize(cloud) || cloudInput.schemaVersion !== PROGRESS_SCHEMA_VERSION;
  // A changed merge result is a new local state; give it a fresh timestamp so other devices pick it up.
  if (localChanged && cloudChanged) merged.updatedAt = Math.max(merged.updatedAt, Date.now());
  return { snapshot: merged, localChanged, cloudChanged };
};

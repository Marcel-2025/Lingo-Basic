import { shuffle } from "@/app/lib/utils";
import type { LanguagePack, LearningInsights, VocabItem } from "@/app/lib/types";

/**
 * Learning path: every topic of a pack is split into lessons of LESSON_SIZE words. Lessons unlock one after
 * another; a finished lesson keeps its best star rating (1–3) in `insights.lessons`.
 * A lesson = LESSON_SIZE new-word cards followed by one quiz step per word (choose, reverse, listen).
 * UI-independent, so it is unit-tested and shared with the web app.
 */

export const LESSON_SIZE = 5;
/** XP bonus for finishing a lesson (on top of the per-answer XP). */
export const LESSON_BONUS_XP = 20;

export interface PathLesson {
  /** `${lang}:${level}:${topicId}:${index}` – stable across app languages. */
  id: string;
  topicId: string;
  /** 0-based index inside the topic. */
  index: number;
  words: VocabItem[];
}

export interface PathSection {
  topicId: string;
  title: string;
  icon?: string;
  lessons: PathLesson[];
}

export const lessonId = (pack: Pick<LanguagePack, "lang" | "level">, topicId: string, index: number) => `${pack.lang}:${pack.level}:${topicId}:${index}`;

export const buildPath = (pack: LanguagePack): PathSection[] =>
  pack.topics
    .filter((topic) => topic.vocab.length > 0)
    .map((topic) => {
      const lessons: PathLesson[] = [];
      for (let start = 0, index = 0; start < topic.vocab.length; start += LESSON_SIZE, index += 1) {
        const words = topic.vocab.slice(start, start + LESSON_SIZE);
        // A tiny remainder (1–2 words) is merged into the previous lesson instead of being its own lesson.
        if (words.length < 3 && lessons.length) {
          lessons[lessons.length - 1].words.push(...words);
          break;
        }
        lessons.push({ id: lessonId(pack, topic.id, index), topicId: topic.id, index, words: [...words] });
      }
      return { topicId: topic.id, title: topic.title, icon: topic.icon, lessons };
    });

export const getLessonStars = (insights: LearningInsights, id: string) => insights.lessons?.[id] ?? 0;

export type LessonStatus = "done" | "current" | "locked";

export interface PathProgress {
  /** Status per lesson id. */
  status: Record<string, LessonStatus>;
  done: number;
  total: number;
  /** The lesson to play next (first not finished one), null when the whole path is done. */
  current: PathLesson | null;
}

/** Sequential unlock: the first unfinished lesson is "current", everything after it is locked. */
export const getPathProgress = (path: PathSection[], insights: LearningInsights): PathProgress => {
  const status: Record<string, LessonStatus> = {};
  let current: PathLesson | null = null;
  let done = 0;
  let total = 0;
  for (const section of path) {
    for (const lesson of section.lessons) {
      total += 1;
      if (getLessonStars(insights, lesson.id) > 0) {
        status[lesson.id] = "done";
        done += 1;
      } else if (!current) {
        status[lesson.id] = "current";
        current = lesson;
      } else {
        status[lesson.id] = "locked";
      }
    }
  }
  return { status, done, total, current };
};

/** 3 stars without mistakes, 2 with up to two, otherwise 1 (finishing always earns a star). */
export const starsForMistakes = (mistakes: number) => (mistakes <= 0 ? 3 : mistakes <= 2 ? 2 : 1);

/** Stores the best rating of a lesson (never lowers it). */
export const recordLessonResult = (insights: LearningInsights, id: string, stars: number): LearningInsights => {
  const clamped = Math.max(1, Math.min(3, Math.round(stars)));
  const previous = insights.lessons?.[id] ?? 0;
  if (previous >= clamped) return insights;
  return { ...insights, lessons: { ...(insights.lessons ?? {}), [id]: clamped } };
};

export type LessonStep =
  | { kind: "learn"; word: VocabItem }
  /** Shows the base-language meaning, answer is the target word. */
  | { kind: "choose-target"; word: VocabItem; options: string[] }
  /** Shows the target word, answer is the meaning. */
  | { kind: "choose-base"; word: VocabItem; options: string[] }
  /** Plays the target word, answer is the meaning. */
  | { kind: "listen"; word: VocabItem; options: string[] };

export type QuizStep = Exclude<LessonStep, { kind: "learn" }>;

export const correctOption = (step: QuizStep) => (step.kind === "choose-target" ? step.word.x : step.word.de);

const normalize = (value: string) => value.trim().toLocaleLowerCase();

const pickOptions = (word: VocabItem, pool: VocabItem[], field: "x" | "de") => {
  const seen = new Set([normalize(word[field])]);
  const distractors: string[] = [];
  for (const entry of shuffle(pool)) {
    if (distractors.length === 3) break;
    const key = normalize(entry[field]);
    if (entry.id === word.id || seen.has(key) || !key) continue;
    seen.add(key);
    distractors.push(entry[field]);
  }
  return shuffle([word[field], ...distractors]);
};

const QUIZ_KINDS: QuizStep["kind"][] = ["choose-target", "choose-base", "listen"];

/** Builds a quiz step for one word; distractors come from the topic first, then from the whole pack. */
export const createQuizStep = (word: VocabItem, kind: QuizStep["kind"], topicVocab: VocabItem[], allVocab: VocabItem[]): QuizStep => {
  const field = kind === "choose-target" ? "x" : "de";
  const pool = topicVocab.length >= 6 ? topicVocab : [...topicVocab, ...allVocab];
  return { kind, word, options: pickOptions(word, pool, field) };
};

export const buildLessonSteps = (lesson: PathLesson, topicVocab: VocabItem[], allVocab: VocabItem[]): LessonStep[] => {
  const learn: LessonStep[] = lesson.words.map((word) => ({ kind: "learn", word }));
  const quiz: LessonStep[] = shuffle(lesson.words).map((word, index) => createQuizStep(word, QUIZ_KINDS[index % QUIZ_KINDS.length], topicVocab, allVocab));
  return [...learn, ...quiz];
};

/** Merge helper for backups: per lesson the better rating wins. */
export const mergeLessons = (a?: Record<string, number>, b?: Record<string, number>) => {
  if (!a && !b) return undefined;
  const merged: Record<string, number> = { ...(b ?? {}) };
  Object.entries(a ?? {}).forEach(([id, stars]) => {
    merged[id] = Math.max(stars, merged[id] ?? 0);
  });
  return merged;
};

export const normalizeLessons = (input: unknown): Record<string, number> | undefined => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const entries = Object.entries(input as Record<string, unknown>)
    .filter(([id, stars]) => id.length > 0 && typeof stars === "number" && Number.isFinite(stars) && stars >= 1)
    .map(([id, stars]) => [id, Math.min(3, Math.round(stars as number))] as const);
  return entries.length ? Object.fromEntries(entries) : undefined;
};

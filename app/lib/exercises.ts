import { getVocabFromPack } from "@/app/lib/pack-normalization";
import { shuffle } from "@/app/lib/utils";
import type { LanguagePack, VocabItem } from "@/app/lib/types";

/** Exercise logic is UI-independent so new types (typing, listening, sentences) can reuse it. */
export interface Question {
  word: VocabItem;
  options: string[];
}

export const ANSWER_LOCK_MS = 900;

/** Builds one multiple-choice question: one correct option and three distinct wrong options. */
export const createQuestion = (pack: LanguagePack, previousWordId?: string): Question | null => {
  const vocab = getVocabFromPack(pack);
  if (vocab.length < 4) return null;
  const candidates = vocab.length > 4 && previousWordId ? vocab.filter((entry) => entry.id !== previousWordId) : vocab;
  const word = shuffle(candidates)[0];
  const normalize = (value: string) => value.trim().toLocaleLowerCase();
  const seen = new Set([normalize(word.x)]);
  const distractors: string[] = [];
  for (const entry of shuffle(vocab)) {
    if (distractors.length === 3) break;
    const key = normalize(entry.x);
    if (entry.id === word.id || seen.has(key)) continue;
    seen.add(key);
    distractors.push(entry.x);
  }
  return distractors.length === 3 ? { word, options: shuffle([word.x, ...distractors]) } : null;
};

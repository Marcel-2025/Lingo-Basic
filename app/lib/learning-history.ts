import { getWordProgressKey } from "@/app/lib/progress";
import type { LanguageCode, LearnedWord, LearningInsights } from "@/app/lib/types";

/** Framework-free learning-history logic, shared by the web app and the native app. */
export interface RecordLearningArgs {
  topicId: string;
  word: LearnedWord & { lang: LanguageCode };
  mastered?: boolean;
  dateKey: string;
}

/** Legacy entries without `lang` count for every language, so existing progress is never lost or double-counted. */
const matchesWord = (entry: LearnedWord, wordId: string, lang: LanguageCode) =>
  entry.id === wordId && (!entry.lang || entry.lang === lang);

export const isWordLearned = (insights: LearningInsights, topicId: string, wordId: string, lang: LanguageCode) =>
  (insights.learnedWordsByTopic[topicId] ?? []).some((entry) => matchesWord(entry, wordId, lang));

export const isWordMastered = (insights: LearningInsights, wordId: string, lang: LanguageCode) =>
  insights.masteredWordIds.includes(getWordProgressKey(wordId, lang)) || insights.masteredWordIds.includes(wordId);

export const recordLearningInInsights = (
  previous: LearningInsights,
  { topicId, word, mastered = false, dateKey }: RecordLearningArgs,
): LearningInsights => {
  const wordsForTopic = previous.learnedWordsByTopic[topicId] ?? [];
  const alreadyLearned = wordsForTopic.some((entry) => matchesWord(entry, word.id, word.lang));
  const masteredKey = getWordProgressKey(word.id, word.lang);
  const masteredWordIds = mastered && !isWordMastered(previous, word.id, word.lang)
    ? [...previous.masteredWordIds, masteredKey]
    : previous.masteredWordIds;
  return {
    learnedDays: {
      ...previous.learnedDays,
      [dateKey]: (previous.learnedDays[dateKey] ?? 0) + 1,
    },
    learnedWordsByTopic: {
      ...previous.learnedWordsByTopic,
      [topicId]: alreadyLearned ? wordsForTopic : [...wordsForTopic, word],
    },
    masteredWordIds,
  };
};

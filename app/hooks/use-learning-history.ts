"use client";

import { useCallback } from "react";
import { getWordProgressKey } from "@/app/lib/progress";
import type { LanguageCode, LearnedWord, LearningInsights } from "@/app/lib/types";

interface RecordLearningArgs {
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

export const useLearningHistory = (
  insights: LearningInsights,
  updateInsights: (updater: (previous: LearningInsights) => LearningInsights) => void,
) => {
  const hasLearnedWord = useCallback(
    (topicId: string, wordId: string, lang: LanguageCode) => isWordLearned(insights, topicId, wordId, lang),
    [insights],
  );

  const hasMasteredWord = useCallback(
    (wordId: string, lang: LanguageCode) => isWordMastered(insights, wordId, lang),
    [insights],
  );

  const recordLearning = useCallback(
    (args: RecordLearningArgs) => updateInsights((previous) => recordLearningInInsights(previous, args)),
    [updateInsights],
  );

  const recordActivityDay = useCallback((dateKey: string) => {
    updateInsights((previous) => ({
      ...previous,
      learnedDays: {
        ...previous.learnedDays,
        [dateKey]: (previous.learnedDays[dateKey] ?? 0) + 1,
      },
    }));
  }, [updateInsights]);

  return { hasLearnedWord, hasMasteredWord, recordLearning, recordActivityDay };
};

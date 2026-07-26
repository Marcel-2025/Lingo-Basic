"use client";

import { useCallback } from "react";
import type { LearnedWord, LearningInsights } from "@/app/lib/types";

interface RecordLearningArgs {
  topicId: string;
  word: LearnedWord;
  mastered?: boolean;
  dateKey: string;
}

export const useLearningHistory = (
  insights: LearningInsights,
  updateInsights: (updater: (previous: LearningInsights) => LearningInsights) => void,
) => {
  const hasLearnedWord = useCallback(
    (topicId: string, wordId: string) => (insights.learnedWordsByTopic[topicId] ?? []).some((word) => word.id === wordId),
    [insights.learnedWordsByTopic],
  );

  const hasMasteredWord = useCallback(
    (wordId: string) => insights.masteredWordIds.includes(wordId),
    [insights.masteredWordIds],
  );

  const recordLearning = useCallback(
    ({ topicId, word, mastered = false, dateKey }: RecordLearningArgs) => {
      updateInsights((previous) => {
        const wordsForTopic = previous.learnedWordsByTopic[topicId] ?? [];
        const alreadyLearned = wordsForTopic.some((entry) => entry.id === word.id);
        const masteredWordIds = mastered && !previous.masteredWordIds.includes(word.id)
          ? [...previous.masteredWordIds, word.id]
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
      });
    },
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

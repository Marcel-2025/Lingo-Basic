"use client";

import { useCallback } from "react";
import { isWordLearned, isWordMastered, recordLearningInInsights, type RecordLearningArgs } from "@/app/lib/learning-history";
import type { LanguageCode, LearningInsights } from "@/app/lib/types";

export { isWordLearned, isWordMastered, recordLearningInInsights } from "@/app/lib/learning-history";

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

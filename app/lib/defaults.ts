import { DEFAULT_LANGUAGE, DEFAULT_LEVEL } from "@/app/lib/languages";
import type { AppSettings, LearningInsights, UserStats } from "@/app/lib/types";

export const PROGRESS_SCHEMA_VERSION = 2;

export const DEFAULT_STATS: UserStats = {
  xp: 0,
  level: 1,
  streak: 0,
  lastActiveDate: "",
  learnedWords: 0,
  masteredWords: 0,
  correctAnswers: 0,
  totalAnswers: 0,
};

export const getDefaultSettings = (): AppSettings => ({
  targetLang: DEFAULT_LANGUAGE,
  contentLevel: DEFAULT_LEVEL,
  difficulty: "all",
  dailyGoal: 20,
  theme: "Ocean",
  isDarkMode: false,
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
});

export const DEFAULT_INSIGHTS: LearningInsights = {
  learnedDays: {},
  learnedWordsByTopic: {},
  masteredWordIds: [],
};

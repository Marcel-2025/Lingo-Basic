export type LanguageCode = "EN" | "ES" | "FR" | "RU" | "IT";

export type CefrLevel = "A1" | "A2" | "B1";

export type Difficulty = 1 | 2 | 3;

export type LegacyDifficulty = "easy" | "medium" | "hard";

export type ThemeName = "Ocean" | "Sunset" | "Lime" | "Grape";

export interface VocabItem {
  id: string;
  de: string;
  x: string;
  ex?: string;
  exTr?: string;
  difficulty: Difficulty;
  tags: string[];
}

export interface SentenceItem {
  id: string;
  de: string;
  x?: string;
  translations: Record<string, string>;
  focusWord?: string;
}

export interface TopicItem {
  id: string;
  title: string;
  icon?: string;
  level?: string;
  difficulty: Difficulty;
  vocab: VocabItem[];
}

export interface LanguagePack {
  version: number;
  lang: LanguageCode;
  level: CefrLevel;
  vocab?: VocabItem[];
  topics: TopicItem[];
  sentences: SentenceItem[];
}

export interface UserStats {
  xp: number;
  level: number;
  streak: number;
  lastActiveDate: string;
  learnedWords: number;
  masteredWords: number;
  correctAnswers: number;
  totalAnswers: number;
}

export interface AppSettings {
  targetLang: LanguageCode;
  contentLevel: CefrLevel;
  difficulty: "all" | Difficulty;
  dailyGoal: number;
  theme: ThemeName;
  isDarkMode: boolean;
  timeZone: string;
}

export interface LearnedWord {
  id: string;
  de: string;
  x: string;
}

export interface LearningInsights {
  learnedDays: Record<string, number>;
  learnedWordsByTopic: Record<string, LearnedWord[]>;
  masteredWordIds: string[];
}

export interface AuthUser {
  localId: string;
  email: string;
  displayName?: string;
  idToken: string;
  refreshToken: string;
  expiresAt: number;
}

export type EntitlementPlan = "free" | "premium_monthly" | "premium_yearly" | "ad_free_lifetime";

export type EntitlementStatus = "active" | "trialing" | "cancelled" | "expired" | "unknown";

export type EntitlementSource = "none" | "stripe" | "google_play" | "revenuecat";

export interface UserEntitlement {
  plan: EntitlementPlan;
  status: EntitlementStatus;
  source: EntitlementSource;
  expiresAt: number | null;
  updatedAt: number;
}

export interface EntitlementState extends UserEntitlement {
  isPremium: boolean;
  isAdFree: boolean;
}

export interface CloudProgressSnapshot {
  schemaVersion: number;
  stats: UserStats;
  settings: AppSettings;
  learningInsights: LearningInsights;
  updatedAt: number;
}

export interface PackNormalizationResult {
  pack: LanguagePack | null;
  errors: string[];
  warnings: string[];
}

export interface PackLoadState {
  status: "idle" | "loading" | "ready" | "error";
  source?: "cache" | "network" | "legacy" | "import";
  message?: string;
}

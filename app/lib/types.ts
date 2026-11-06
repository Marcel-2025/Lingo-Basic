export type LanguageCode = "DE" | "EN" | "ES" | "FR" | "RU" | "IT" | "TR" | "PT" | "NL" | "PL";

export type CefrLevel = "A1" | "A2" | "B1";

export type Difficulty = 1 | 2 | 3;

export type LegacyDifficulty = "easy" | "medium" | "hard";

export type ThemeName = "Ocean" | "Sunset" | "Lime" | "Grape";

export interface VocabItem {
  id: string;
  /** Meaning in the learner's base language (historically German, hence the name). */
  de: string;
  /** Word in the target language. */
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
  /** App language; also the base language the words are learned from (mobile). */
  uiLang: LanguageCode;
  targetLang: LanguageCode;
  contentLevel: CefrLevel;
  difficulty: "all" | Difficulty;
  dailyGoal: number;
  theme: ThemeName;
  isDarkMode: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  timeZone: string;
}

export interface LearnedWord {
  id: string;
  de: string;
  x: string;
  /** Zielsprache, in der das Wort gelernt wurde. Fehlt nur bei Legacy-Einträgen. */
  lang?: LanguageCode;
}

export interface LearningInsights {
  learnedDays: Record<string, number>;
  learnedWordsByTopic: Record<string, LearnedWord[]>;
  /** Einträge im Format `${lang}:${wordId}`; Legacy-Einträge bestehen nur aus der Word-ID. */
  masteredWordIds: string[];
  /** Aufbauspiel „Deine Stadt“ (Gebäude, ausgegebene Münzen, erledigte Tagesaufgaben). */
  city?: CityStateLike;
  /** Tage, an denen der Premium-Streak-Schutz gegriffen hat. */
  frozenDays?: string[];
}

/** Structural copy of CityState from app/lib/city.ts (kept here to avoid a type cycle). */
export interface CityStateLike {
  buildings: Record<string, number>;
  coinsSpent: number;
  questsDone: Record<string, string[]>;
  chestsClaimed: string[];
  decorations: string[];
  coinsPurchased: number;
}

/** Snapshot of the signed-in Firebase user. The session itself is managed by the Firebase Auth SDK. */
export interface AuthUser {
  localId: string;
  email: string;
  displayName?: string;
  phoneNumber?: string;
  /** Current Firebase ID token (refreshed automatically by the SDK), used for calls to the own backend. */
  idToken: string;
  expiresAt: number;
}

export type EntitlementPlan = "free" | "premium_monthly" | "premium_yearly" | "premium_lifetime";

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

export type PackOrigin = "network" | "import";

export interface PackLoadState {
  status: "idle" | "loading" | "ready" | "error";
  source?: PackOrigin | "cache" | "legacy";
  message?: string;
}

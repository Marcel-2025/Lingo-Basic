import { DECORATIONS } from "@/app/lib/premium-benefits";
import type { LearningInsights, UserStats } from "@/app/lib/types";

/**
 * "Deine Stadt": the building game that turns learning progress into a growing town.
 * Framework-free so web and native share one rule set; everything is derived from stats + insights,
 * only the spent coins, building levels and quest completions are stored (inside LearningInsights.city).
 */

export interface CityState {
  /** buildingId → level (1..MAX_BUILDING_LEVEL). Missing = not built. */
  buildings: Record<string, number>;
  /** Coins spent in total; available coins = earned − spent. */
  coinsSpent: number;
  /** Date key → ids of quests completed that day. */
  questsDone: Record<string, string[]>;
  /** Date key → claimed daily streak chest. */
  chestsClaimed: string[];
  /** Premium decorations bought with coins. */
  decorations: string[];
  /** Coins from purchased coin packs (real money) – added to the earned coins. */
  coinsPurchased: number;
}

export const EMPTY_CITY: CityState = { buildings: {}, coinsSpent: 0, questsDone: {}, chestsClaimed: [], decorations: [], coinsPurchased: 0 };

export const MAX_BUILDING_LEVEL = 3;

export interface BuildingDefinition {
  id: string;
  name: string;
  icon: string;
  /** Learning topics (topic id prefixes across levels) that unlock and grow this building. */
  topics: string[];
  /** Coin cost per level. */
  cost: [number, number, number];
  /** Learned words in the linked topics required per level. */
  wordsRequired: [number, number, number];
  description: string;
}

export const BUILDINGS: BuildingDefinition[] = [
  { id: "bakery", name: "Bäckerei", icon: "🥐", topics: ["food_01", "cooking_08"], cost: [40, 120, 300], wordsRequired: [3, 12, 25], description: "Essen & Trinken, Kochen" },
  { id: "station", name: "Bahnhof", icon: "🚉", topics: ["travel_02", "transport_09", "travel_03"], cost: [60, 160, 380], wordsRequired: [3, 12, 25], description: "Reisen & Verkehr" },
  { id: "house", name: "Wohnhaus", icon: "🏡", topics: ["home_03", "household_10"], cost: [40, 120, 300], wordsRequired: [3, 12, 25], description: "Zuhause & Haushalt" },
  { id: "office", name: "Büro", icon: "🏢", topics: ["work_04", "career_01"], cost: [80, 200, 450], wordsRequired: [4, 14, 28], description: "Beruf & Karriere" },
  { id: "hospital", name: "Klinik", icon: "🏥", topics: ["health_05", "lifestyle_08"], cost: [80, 200, 450], wordsRequired: [4, 14, 28], description: "Gesundheit & Lebensstil" },
  { id: "market", name: "Markt", icon: "🛒", topics: ["shopping_06", "money_09"], cost: [60, 160, 380], wordsRequired: [3, 12, 25], description: "Einkaufen & Geld" },
  { id: "park", name: "Park", icon: "🌳", topics: ["family_07", "nature_04", "environment_05"], cost: [50, 140, 340], wordsRequired: [3, 12, 25], description: "Familie, Natur & Umwelt" },
  { id: "school", name: "Schule", icon: "🏫", topics: ["time_08", "education_06", "basics_09"], cost: [70, 180, 400], wordsRequired: [4, 14, 28], description: "Lernen & Grundlagen" },
  { id: "boutique", name: "Boutique", icon: "👗", topics: ["body_10"], cost: [50, 140, 340], wordsRequired: [3, 10, 18], description: "Körper & Kleidung" },
  { id: "cafe", name: "Café", icon: "☕", topics: ["daily_01", "leisure_07"], cost: [60, 160, 380], wordsRequired: [3, 12, 25], description: "Tagesablauf & Freizeit" },
  { id: "townhall", name: "Rathaus", icon: "🏛️", topics: ["city_02", "society_02", "opinion_04"], cost: [120, 300, 600], wordsRequired: [5, 16, 32], description: "Stadt, Gesellschaft & Meinung" },
  { id: "radio", name: "Sender", icon: "📡", topics: ["communication_03", "digital_06", "media_07"], cost: [100, 260, 550], wordsRequired: [5, 16, 32], description: "Kommunikation & Medien" },
  { id: "theatre", name: "Theater", icon: "🎭", topics: ["feelings_05", "culture_10"], cost: [90, 240, 500], wordsRequired: [4, 14, 28], description: "Gefühle & Kultur" },
];

export interface Quest {
  id: string;
  title: string;
  reward: number;
  target: number;
}

const QUEST_POOL: Omit<Quest, "id">[] = [
  { title: "10 Lernkarten beantworten", reward: 25, target: 10 },
  { title: "20 Lernkarten beantworten", reward: 45, target: 20 },
  { title: "5 Übungen richtig lösen", reward: 25, target: 5 },
  { title: "3 neue Wörter lernen", reward: 30, target: 3 },
  { title: "Tagesziel erreichen", reward: 40, target: 1 },
  { title: "8 Übungen richtig lösen", reward: 40, target: 8 },
];

/** Day-level activity counters the quests read (kept by the app in memory + learnedDays). */
export interface DayActivity {
  cards: number;
  correctExercises: number;
  newWords: number;
  goalReached: boolean;
}

const hashDate = (dateKey: string) => [...dateKey].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);

/** Three quests per day, chosen deterministically from the date so every device shows the same ones. */
export const getDailyQuests = (dateKey: string): Quest[] => {
  const seed = hashDate(dateKey);
  const picks = new Set<number>();
  let n = seed;
  while (picks.size < 3) {
    n = (n * 1103515245 + 12345) >>> 0;
    picks.add(n % QUEST_POOL.length);
  }
  return [...picks].map((index) => ({ id: `q${index}`, ...QUEST_POOL[index] }));
};

export const getQuestProgress = (quest: Quest, activity: DayActivity) => {
  switch (quest.id) {
    case "q0": return Math.min(activity.cards, quest.target);
    case "q1": return Math.min(activity.cards, quest.target);
    case "q2": return Math.min(activity.correctExercises, quest.target);
    case "q3": return Math.min(activity.newWords, quest.target);
    case "q4": return activity.goalReached ? 1 : 0;
    case "q5": return Math.min(activity.correctExercises, quest.target);
    default: return 0;
  }
};

/** Coins earned from learning: 1 per 5 XP, 3 per learned word, plus quest rewards and streak chests. */
export const getCoinsEarned = (stats: UserStats, city: CityState) => {
  const questCoins = Object.entries(city.questsDone).reduce((sum, [dateKey, ids]) => {
    const quests = getDailyQuests(dateKey);
    return sum + ids.reduce((inner, id) => inner + (quests.find((quest) => quest.id === id)?.reward ?? 0), 0);
  }, 0);
  const chestCoins = city.chestsClaimed.length * STREAK_CHEST_REWARD;
  return Math.floor(stats.xp / 5) + stats.learnedWords * 3 + questCoins + chestCoins + city.coinsPurchased;
};

export const STREAK_CHEST_REWARD = 20;

export const getCoinsAvailable = (stats: UserStats, city: CityState) => Math.max(0, getCoinsEarned(stats, city) - city.coinsSpent);

/** Learned words (any language) in the topics linked to a building. */
export const getWordsForBuilding = (building: BuildingDefinition, insights: LearningInsights) =>
  Object.entries(insights.learnedWordsByTopic).reduce((sum, [topicId, words]) => (building.topics.includes(topicId) ? sum + words.length : sum), 0);

export interface BuildingStatus {
  building: BuildingDefinition;
  level: number;
  words: number;
  nextCost: number | null;
  nextWordsRequired: number | null;
  canUpgrade: boolean;
  blockedBy: "max" | "words" | "coins" | null;
}

export const getBuildingStatus = (building: BuildingDefinition, city: CityState, stats: UserStats, insights: LearningInsights): BuildingStatus => {
  const level = city.buildings[building.id] ?? 0;
  const words = getWordsForBuilding(building, insights);
  if (level >= MAX_BUILDING_LEVEL) return { building, level, words, nextCost: null, nextWordsRequired: null, canUpgrade: false, blockedBy: "max" };
  const nextCost = building.cost[level];
  const nextWordsRequired = building.wordsRequired[level];
  const coins = getCoinsAvailable(stats, city);
  const blockedBy = words < nextWordsRequired ? "words" : coins < nextCost ? "coins" : null;
  return { building, level, words, nextCost, nextWordsRequired, canUpgrade: blockedBy === null, blockedBy };
};

export const upgradeBuilding = (city: CityState, buildingId: string, stats: UserStats, insights: LearningInsights): CityState => {
  const building = BUILDINGS.find((entry) => entry.id === buildingId);
  if (!building) return city;
  const status = getBuildingStatus(building, city, stats, insights);
  if (!status.canUpgrade || status.nextCost === null) return city;
  return { ...city, buildings: { ...city.buildings, [buildingId]: status.level + 1 }, coinsSpent: city.coinsSpent + status.nextCost };
};

export const completeQuest = (city: CityState, dateKey: string, questId: string): CityState => {
  const done = city.questsDone[dateKey] ?? [];
  if (done.includes(questId)) return city;
  return { ...city, questsDone: { ...city.questsDone, [dateKey]: [...done, questId] } };
};

export const buyDecoration = (city: CityState, decorationId: string, stats: UserStats): CityState => {
  const decoration = DECORATIONS.find((entry) => entry.id === decorationId);
  if (!decoration || city.decorations.includes(decorationId) || getCoinsAvailable(stats, city) < decoration.cost) return city;
  return { ...city, decorations: [...city.decorations, decorationId], coinsSpent: city.coinsSpent + decoration.cost };
};

export const addPurchasedCoins = (city: CityState, amount: number): CityState => ({ ...city, coinsPurchased: city.coinsPurchased + Math.max(0, Math.floor(amount)) });

export const claimStreakChest = (city: CityState, dateKey: string): CityState =>
  city.chestsClaimed.includes(dateKey) ? city : { ...city, chestsClaimed: [...city.chestsClaimed, dateKey] };

/** Population = every learned word moves one citizen in. Level = sum of building levels. */
export const getCityOverview = (city: CityState, stats: UserStats) => {
  const buildingLevels = Object.values(city.buildings).reduce((sum, level) => sum + level, 0);
  return {
    population: stats.learnedWords,
    buildingLevels,
    cityLevel: Math.floor(buildingLevels / 3) + 1,
    maxLevels: BUILDINGS.length * MAX_BUILDING_LEVEL,
  };
};

/** Days without learning until the town "falls asleep" (purely visual; nothing is lost). */
export const SLEEP_AFTER_DAYS = 2;

export const isCityAsleep = (stats: UserStats, todayKey: string) => {
  if (!stats.lastActiveDate) return false;
  const last = Date.parse(`${stats.lastActiveDate}T00:00:00Z`);
  const today = Date.parse(`${todayKey}T00:00:00Z`);
  if (!Number.isFinite(last) || !Number.isFinite(today)) return false;
  return (today - last) / 86_400_000 >= SLEEP_AFTER_DAYS;
};

// ---------------------------------------------------------------- normalization & merge (used by progress.ts)

const asLevel = (value: unknown) => {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? Math.min(number, MAX_BUILDING_LEVEL) : 0;
};

export const normalizeCity = (input: unknown): CityState => {
  const raw = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const buildingsRaw = raw.buildings && typeof raw.buildings === "object" ? (raw.buildings as Record<string, unknown>) : {};
  const buildings = Object.fromEntries(
    BUILDINGS.map((building) => [building.id, asLevel(buildingsRaw[building.id])] as const).filter(([, level]) => level > 0),
  );
  const questsRaw = raw.questsDone && typeof raw.questsDone === "object" ? (raw.questsDone as Record<string, unknown>) : {};
  const questsDone = Object.fromEntries(
    Object.entries(questsRaw)
      .filter(([dateKey, ids]) => /^\d{4}-\d{2}-\d{2}$/.test(dateKey) && Array.isArray(ids))
      .map(([dateKey, ids]): [string, string[]] => [dateKey, [...new Set((ids as unknown[]).filter((id): id is string => typeof id === "string" && /^q\d$/.test(id)))]])
      .filter(([, ids]) => ids.length > 0),
  );
  const coinsSpent = Number(raw.coinsSpent);
  const chestsClaimed = Array.isArray(raw.chestsClaimed) ? [...new Set(raw.chestsClaimed.filter((entry): entry is string => typeof entry === "string" && /^\d{4}-\d{2}-\d{2}$/.test(entry)))] : [];
  const decorations = Array.isArray(raw.decorations) ? [...new Set(raw.decorations.filter((entry): entry is string => typeof entry === "string" && DECORATIONS.some((d) => d.id === entry)))] : [];
  const coinsPurchased = Number(raw.coinsPurchased);
  return {
    buildings,
    coinsSpent: Number.isFinite(coinsSpent) && coinsSpent > 0 ? Math.floor(coinsSpent) : 0,
    questsDone,
    chestsClaimed,
    decorations,
    coinsPurchased: Number.isFinite(coinsPurchased) && coinsPurchased > 0 ? Math.floor(coinsPurchased) : 0,
  };
};

/** Union of achievements: higher building level wins, quests/chests are unioned, spent coins follow the buildings. */
export const mergeCity = (a: CityState, b: CityState): CityState => {
  const buildings: Record<string, number> = {};
  for (const building of BUILDINGS) {
    const level = Math.max(a.buildings[building.id] ?? 0, b.buildings[building.id] ?? 0);
    if (level > 0) buildings[building.id] = level;
  }
  const decorations = [...new Set([...a.decorations, ...b.decorations])];
  const spentForBuildings = BUILDINGS.reduce((sum, building) => sum + building.cost.slice(0, buildings[building.id] ?? 0).reduce((inner, cost) => inner + cost, 0), 0)
    + decorations.reduce((sum, id) => sum + (DECORATIONS.find((d) => d.id === id)?.cost ?? 0), 0);
  const dateKeys = new Set([...Object.keys(a.questsDone), ...Object.keys(b.questsDone)]);
  const questsDone = Object.fromEntries([...dateKeys].map((dateKey) => [dateKey, [...new Set([...(a.questsDone[dateKey] ?? []), ...(b.questsDone[dateKey] ?? [])])]]));
  return {
    buildings,
    coinsSpent: Math.max(spentForBuildings, Math.min(a.coinsSpent, b.coinsSpent)),
    questsDone,
    chestsClaimed: [...new Set([...a.chestsClaimed, ...b.chestsClaimed])].sort(),
    decorations,
    coinsPurchased: Math.max(a.coinsPurchased, b.coinsPurchased),
  };
};

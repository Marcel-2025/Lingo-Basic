import AsyncStorage from "@react-native-async-storage/async-storage";

/** AsyncStorage replaces LocalStorage. Corrupt values never crash the app: callers normalize what comes back. */
export const STORAGE_KEYS = {
  stats: "lingoStats",
  settings: "lingoSettings",
  insights: "lingoLearningInsights",
  updatedAt: "lingoProgressUpdatedAt",
  syncMarker: "lingoCloudSyncMarker",
  importedPacks: "lingoImportedPacks",
} as const;

export const readJson = async <T,>(key: string, fallback: T): Promise<T> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const writeJson = async (key: string, value: unknown) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable: the session keeps working in memory.
  }
};

export const removeKey = async (key: string) => {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Nothing to clean up.
  }
};

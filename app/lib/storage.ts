export const STORAGE_KEYS = {
  stats: "lingoStats",
  settings: "lingoSettings",
  insights: "lingoLearningInsights",
  authUser: "lingoAuthUser",
  updatedAt: "lingoProgressUpdatedAt",
} as const;

const getStorage = () => (typeof window === "undefined" ? null : window.localStorage);

export const readStoredJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = getStorage()?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const writeStoredJson = <T,>(key: string, value: T) => {
  try {
    getStorage()?.setItem(key, JSON.stringify(value));
  } catch {
    // Local storage is an offline convenience. The active session stays usable if it is unavailable.
  }
};

export const readStoredNumber = (key: string, fallback = 0) => {
  try {
    const value = Number(getStorage()?.getItem(key));
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  } catch {
    return fallback;
  }
};

export const writeStoredNumber = (key: string, value: number) => {
  try {
    getStorage()?.setItem(key, String(value));
  } catch {
    // See writeStoredJson.
  }
};

export const removeStoredValue = (key: string) => {
  try {
    getStorage()?.removeItem(key);
  } catch {
    // No action required when browser storage is unavailable.
  }
};

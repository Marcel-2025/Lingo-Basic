import { getPackKey } from "@/app/lib/languages";
import type { CefrLevel, LanguageCode, LanguagePack } from "@/app/lib/types";

const DB_NAME = "LingoDB";
const DB_VERSION = 2;
const LEGACY_STORE_NAME = "packs";
const PACK_STORE_NAME = "packCache";

interface CachedPack {
  packKey: string;
  pack: LanguagePack;
  cachedAt: number;
}

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(LEGACY_STORE_NAME)) {
        database.createObjectStore(LEGACY_STORE_NAME, { keyPath: "lang" });
      }
      if (!database.objectStoreNames.contains(PACK_STORE_NAME)) {
        database.createObjectStore(PACK_STORE_NAME, { keyPath: "packKey" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB konnte nicht geöffnet werden."));
  });

const readValue = <T,>(database: IDBDatabase, storeName: string, key: IDBValidKey): Promise<T | null> =>
  new Promise((resolve, reject) => {
    const request = database.transaction(storeName, "readonly").objectStore(storeName).get(key);
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB-Lesevorgang fehlgeschlagen."));
  });

export const getPackFromDB = async (lang: LanguageCode, level: CefrLevel) => {
  const database = await openDatabase();
  try {
    const cached = await readValue<CachedPack>(database, PACK_STORE_NAME, getPackKey(lang, level));
    if (cached?.pack) return { pack: cached.pack, source: "cache" as const };

    // Migration path for version 1: only reuse a legacy cache entry if its actual level matches.
    const legacy = await readValue<LanguagePack>(database, LEGACY_STORE_NAME, lang);
    if (legacy?.level === level && legacy.lang === lang) return { pack: legacy, source: "legacy" as const };
    return null;
  } finally {
    database.close();
  }
};

export const savePackToDB = async (pack: LanguagePack) => {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(PACK_STORE_NAME, "readwrite");
      transaction.objectStore(PACK_STORE_NAME).put({
        packKey: getPackKey(pack.lang, pack.level),
        pack,
        cachedAt: Date.now(),
      } satisfies CachedPack);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB-Speichern fehlgeschlagen."));
    });
  } finally {
    database.close();
  }
};

export const deletePackFromDB = async (lang: LanguageCode, level: CefrLevel) => {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(PACK_STORE_NAME, "readwrite");
      transaction.objectStore(PACK_STORE_NAME).delete(getPackKey(lang, level));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB-Löschen fehlgeschlagen."));
    });
  } finally {
    database.close();
  }
};

export const clearAllPacksFromDB = async () => {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(PACK_STORE_NAME, "readwrite");
      transaction.objectStore(PACK_STORE_NAME).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB-Löschen fehlgeschlagen."));
    });
  } finally {
    database.close();
  }
};

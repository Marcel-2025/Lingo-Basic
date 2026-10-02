"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clearAllPacksFromDB, deletePackFromDB, getPackFromDB, savePackToDB } from "@/app/lib/indexed-db";
import { getLegacyPackPath, getPackPath, SUPPORTED_LANGUAGES } from "@/app/lib/languages";
import { normalizePack } from "@/app/lib/pack-normalization";
import type { CefrLevel, LanguageCode, LanguagePack, PackLoadState, PackOrigin } from "@/app/lib/types";

class PackUnavailableError extends Error {}

const parsePackJson = (json: unknown) => {
  const result = normalizePack(json);
  if (!result.pack) throw new Error(result.errors.slice(0, 3).join(" ") || "Das Sprachpaket ist ungültig.");
  return result;
};

const fetchJson = async (url: string) => {
  const response = await fetch(url, { cache: "no-store" });
  if (response.status === 404) throw new PackUnavailableError();
  if (!response.ok) throw new Error(`Das Sprachpaket konnte nicht geladen werden (HTTP ${response.status}).`);
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new Error("Das Sprachpaket enthält kein gültiges JSON.");
  }
};

const describe = (lang: LanguageCode, level: CefrLevel) => `${SUPPORTED_LANGUAGES[lang].label} ${level}`;

interface LoadOptions {
  /** Ignore an imported pack and fetch the public one from /packs (explicit user action). */
  forcePublic?: boolean;
}

/**
 * Offline-first pack loading:
 * 1. IndexedDB cache for `${lang}:${level}` (imported packs take precedence and are not overwritten),
 * 2. /packs/{lang}/{level}.json, validated + normalized, then cached,
 * 3. legacy /packs/{lang}.json only if its declared level matches,
 * 4. otherwise the cache, or a clear "not available" state.
 */
export const useLanguagePack = (lang: LanguageCode, level: CefrLevel) => {
  const [pack, setPack] = useState<LanguagePack | null>(null);
  const [loadState, setLoadState] = useState<PackLoadState>({ status: "idle" });
  const requestIdRef = useRef(0);

  const load = useCallback(async ({ forcePublic = false }: LoadOptions = {}) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const isCurrentRequest = () => requestId === requestIdRef.current;
    setLoadState({ status: "loading" });
    // Never show a pack of a different language/level while the new one loads.
    setPack((current) => (current && current.lang === lang && current.level === level ? current : null));

    let cachedPack: LanguagePack | null = null;
    try {
      const cached = await getPackFromDB(lang, level);
      const normalized = cached ? normalizePack(cached.pack) : null;
      if (cached && normalized?.pack && normalized.pack.lang === lang && normalized.pack.level === level) {
        cachedPack = normalized.pack;
        if (cached.source === "legacy") await savePackToDB(cachedPack, "network");
        if (cached.origin === "import" && !forcePublic) {
          if (isCurrentRequest()) {
            setPack(cachedPack);
            setLoadState({ status: "ready", source: "import", message: "Importiertes Pack aus dem Offline-Speicher." });
          }
          return;
        }
        if (isCurrentRequest()) {
          setPack(cachedPack);
          setLoadState({ status: "ready", source: "cache", message: "Offline-Cache wird verwendet." });
        }
      }
    } catch {
      // IndexedDB can be unavailable (private mode). Continue with the network.
    }

    let failure: unknown = null;
    try {
      const loadedPack = parsePackJson(await fetchJson(getPackPath(lang, level))).pack!;
      if (loadedPack.lang !== lang || loadedPack.level !== level) {
        throw new Error(`Die Datei ${getPackPath(lang, level)} enthält ${loadedPack.lang} ${loadedPack.level} statt ${lang} ${level}.`);
      }
      try {
        await savePackToDB(loadedPack, "network");
      } catch {
        // The pack still works for this session without a cache.
      }
      if (isCurrentRequest()) {
        setPack(loadedPack);
        setLoadState({ status: "ready", source: "network" });
      }
      return;
    } catch (error) {
      failure = error;
    }

    // Legacy flat files (/packs/en.json) are only accepted if their real level matches.
    if (failure instanceof PackUnavailableError) {
      try {
        const legacyPack = parsePackJson(await fetchJson(getLegacyPackPath(lang))).pack!;
        if (legacyPack.level === level && legacyPack.lang === lang) {
          try {
            await savePackToDB(legacyPack, "network");
          } catch {
            // See above.
          }
          if (isCurrentRequest()) {
            setPack(legacyPack);
            setLoadState({ status: "ready", source: "legacy", message: "Ein kompatibles Legacy-Pack wurde geladen." });
          }
          return;
        }
      } catch {
        // Fall through to the cache / error state.
      }
    }

    if (!isCurrentRequest()) return;
    if (cachedPack) {
      setLoadState({ status: "ready", source: "cache", message: "Offline: gespeichertes Pack wird verwendet." });
      return;
    }
    setPack(null);
    const message = failure instanceof PackUnavailableError
      ? `${describe(lang, level)} ist noch nicht verfügbar. Wähle ein anderes Level oder importiere ein Pack.`
      : failure instanceof TypeError
        ? `Keine Verbindung und kein gespeichertes Pack für ${describe(lang, level)}.`
        : failure instanceof Error ? failure.message : `Für ${describe(lang, level)} ist kein Pack verfügbar.`;
    setLoadState({ status: "error", message });
  }, [lang, level]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const importPack = useCallback(async (input: unknown, origin: PackOrigin = "import") => {
    const result = parsePackJson(input);
    const importedPack = result.pack!;
    await savePackToDB(importedPack, origin);
    if (importedPack.lang === lang && importedPack.level === level) {
      setPack(importedPack);
      setLoadState({ status: "ready", source: origin, message: result.warnings[0] });
    }
    return { pack: importedPack, warnings: result.warnings };
  }, [lang, level]);

  const reloadPublicPack = useCallback(() => load({ forcePublic: true }), [load]);

  const clearCurrentCache = useCallback(async () => {
    await deletePackFromDB(lang, level);
    await load({ forcePublic: true });
  }, [lang, level, load]);

  const clearAllCaches = useCallback(async () => {
    await clearAllPacksFromDB();
    await load({ forcePublic: true });
  }, [load]);

  return { pack, loadState, reload: reloadPublicPack, importPack, clearCurrentCache, clearAllCaches };
};

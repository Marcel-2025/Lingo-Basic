"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { deletePackFromDB, getPackFromDB, savePackToDB } from "@/app/lib/indexed-db";
import { getLegacyPackPath, getPackPath } from "@/app/lib/languages";
import { normalizePack } from "@/app/lib/pack-normalization";
import type { CefrLevel, LanguageCode, LanguagePack, PackLoadState } from "@/app/lib/types";

const parseResponse = async (response: Response) => {
  const json = (await response.json()) as unknown;
  const result = normalizePack(json);
  if (!result.pack) throw new Error(result.errors.join(" ") || "Das Sprachpaket ist ungültig.");
  return result.pack;
};

export const useLanguagePack = (lang: LanguageCode, level: CefrLevel) => {
  const [pack, setPack] = useState<LanguagePack | null>(null);
  const [loadState, setLoadState] = useState<PackLoadState>({ status: "idle" });
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const isCurrentRequest = () => requestId === requestIdRef.current;
    setLoadState({ status: "loading" });

    let cachedPack: LanguagePack | null = null;
    try {
      const cached = await getPackFromDB(lang, level);
      if (cached) {
        const normalized = normalizePack(cached.pack);
        if (normalized.pack) {
          cachedPack = normalized.pack;
          if (isCurrentRequest()) {
            setPack(cachedPack);
            setLoadState({ status: "ready", source: cached.source, message: "Offline-Cache wird verwendet." });
          }
          if (cached.source === "legacy") await savePackToDB(cachedPack);
        }
      }
    } catch {
      // Continue with the public pack. A browser may reject IndexedDB in private mode.
    }

    try {
      const response = await fetch(getPackPath(lang, level), { cache: "no-store" });
      if (!response.ok) throw new Error(`Für ${lang} ${level} ist noch kein Pack verfügbar.`);
      const loadedPack = await parseResponse(response);
      if (loadedPack.lang !== lang || loadedPack.level !== level) {
        throw new Error(`Das geladene Pack passt nicht zu ${lang} ${level}.`);
      }
      await savePackToDB(loadedPack);
      if (isCurrentRequest()) {
        setPack(loadedPack);
        setLoadState({ status: "ready", source: "network" });
      }
      return;
    } catch (networkError) {
      try {
        const legacyResponse = await fetch(getLegacyPackPath(lang), { cache: "no-store" });
        if (legacyResponse.ok) {
          const legacyPack = await parseResponse(legacyResponse);
          if (legacyPack.level === level && legacyPack.lang === lang) {
            await savePackToDB(legacyPack);
            if (isCurrentRequest()) {
              setPack(legacyPack);
              setLoadState({ status: "ready", source: "legacy", message: "Ein kompatibles Legacy-Pack wurde geladen." });
            }
            return;
          }
        }
      } catch {
        // The cache below remains the offline fallback.
      }

      if (isCurrentRequest()) {
        if (cachedPack) {
          setLoadState({ status: "ready", source: "cache", message: "Offline: gespeichertes Pack wird verwendet." });
        } else {
          setPack(null);
          setLoadState({
            status: "error",
            message: networkError instanceof Error ? networkError.message : `Für ${lang} ${level} ist kein Pack verfügbar.`,
          });
        }
      }
    }
  }, [lang, level]);

  useEffect(() => {
    void load();
  }, [load]);

  const importPack = useCallback(async (input: unknown, source: "import" | "network" = "import") => {
    const result = normalizePack(input);
    if (!result.pack) throw new Error(result.errors.join(" ") || "Das Sprachpaket ist ungültig.");
    await savePackToDB(result.pack);
    if (result.pack.lang === lang && result.pack.level === level) {
      setPack(result.pack);
      setLoadState({ status: "ready", source, message: result.warnings[0] });
    }
    return { pack: result.pack, warnings: result.warnings };
  }, [lang, level]);

  const clearCurrentCache = useCallback(async () => {
    await deletePackFromDB(lang, level);
    await load();
  }, [lang, level, load]);

  return { pack, loadState, reload: load, importPack, clearCurrentCache };
};

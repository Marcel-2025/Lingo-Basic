import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { LanguagePack } from "@/app/lib/types";
import { filterPackByDifficulty, loadPack, type PackLoadResult, type PackSource } from "~/lib/packs";
import { useAppState } from "~/state/app-state";

interface PackState {
  /** Pack as loaded (all difficulties). */
  pack: LanguagePack | null;
  /** Pack filtered by the selected learning mode. */
  activePack: LanguagePack | null;
  source?: PackSource;
  message?: string;
  isLoading: boolean;
  reload: () => void;
}

const PackContext = createContext<PackState | null>(null);

/** One shared pack for all tabs, reloaded when language or level changes or after an import. */
export function PackProvider({ children }: { children: ReactNode }) {
  const { settings, isLoaded } = useAppState();
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState<{ requestKey: string } & PackLoadResult>({ requestKey: "", pack: null });
  const requestKey = `${settings.targetLang}:${settings.contentLevel}:${reloadToken}`;

  useEffect(() => {
    if (!isLoaded) return;
    let isCurrent = true;
    void loadPack(settings.targetLang, settings.contentLevel).then((loaded) => {
      if (isCurrent) setResult({ requestKey, ...loaded });
    });
    return () => {
      isCurrent = false;
    };
  }, [isLoaded, requestKey, settings.contentLevel, settings.targetLang]);

  // While a new language/level loads, never show the previous pack.
  const isLoading = result.requestKey !== requestKey;
  const pack = isLoading ? null : result.pack;
  const { source, message } = isLoading ? { source: undefined, message: undefined } : result;
  const activePack = useMemo(() => (pack ? filterPackByDifficulty(pack, settings.difficulty) : null), [pack, settings.difficulty]);
  const reload = useCallback(() => setReloadToken((value) => value + 1), []);
  const value = useMemo(() => ({ pack, activePack, source, message, isLoading, reload }), [activePack, isLoading, message, pack, reload, source]);

  return <PackContext.Provider value={value}>{children}</PackContext.Provider>;
}

export const usePackState = () => {
  const context = useContext(PackContext);
  if (!context) throw new Error("usePackState must be used inside PackProvider");
  return context;
};

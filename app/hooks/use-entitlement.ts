"use client";

import { useCallback, useEffect, useState } from "react";
import { FREE_ENTITLEMENT_STATE, loadEntitlement } from "@/app/lib/entitlements";
import type { AuthUser, EntitlementState } from "@/app/lib/types";

type EntitlementLoadStatus = "idle" | "loading" | "ready" | "error";

export const useEntitlement = (user: AuthUser | null) => {
  const [entitlement, setEntitlement] = useState<EntitlementState>(FREE_ENTITLEMENT_STATE);
  const [status, setStatus] = useState<EntitlementLoadStatus>("idle");
  const [message, setMessage] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);

  const refresh = useCallback(() => setRefreshNonce((value) => value + 1), []);

  useEffect(() => {
    let isMounted = true;
    const hydrate = async () => {
      await Promise.resolve();
      if (!isMounted) return;
      if (!user) {
        setEntitlement(FREE_ENTITLEMENT_STATE);
        setStatus("ready");
        setMessage("");
        return;
      }
      setStatus("loading");
      try {
        const nextEntitlement = await loadEntitlement(user);
        if (!isMounted) return;
        setEntitlement(nextEntitlement);
        setStatus("ready");
        setMessage("");
      } catch (error) {
        if (!isMounted) return;
        setEntitlement(FREE_ENTITLEMENT_STATE);
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Premium-Status konnte nicht geladen werden.");
      }
    };
    void hydrate();
    return () => { isMounted = false; };
  }, [refreshNonce, user]);

  return { entitlement, status, message, refresh };
};

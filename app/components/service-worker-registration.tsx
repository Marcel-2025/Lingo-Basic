"use client";

import { useEffect } from "react";
import { isNativePlatform } from "@/app/lib/billing";

/**
 * Registers the offline shell in production only. In development a service worker would serve stale
 * hot-reload bundles, so any previously registered worker is removed instead.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = async () => {
      try {
        // In the Capacitor app all files are already bundled locally; a service worker would only add a second cache.
        if (process.env.NODE_ENV !== "production" || isNativePlatform()) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));
          return;
        }
        await navigator.serviceWorker.register("/sw.js");
      } catch {
        // The app stays fully usable without an installable shell.
      }
    };
    void register();
  }, []);
  return null;
}

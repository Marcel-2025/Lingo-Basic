"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js");
      } catch {
        // The app stays fully usable without an installable shell.
      }
    };
    void register();
  }, []);
  return null;
}

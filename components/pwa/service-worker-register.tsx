"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;

    let registration: ServiceWorkerRegistration | null = null;

    function warmPosShell() {
      if (!navigator.onLine) return;
      const worker = registration?.active ?? navigator.serviceWorker.controller;
      worker?.postMessage({ type: "WARM_POS_SHELL" });
    }

    function handleWorkerMessage(event: MessageEvent) {
      if (event.data?.type === "SYNC_OFFLINE_CHECKOUTS") {
        window.dispatchEvent(new Event("kasirkita:sync-offline-checkouts"));
      }
    }

    navigator.serviceWorker.addEventListener("message", handleWorkerMessage);
    window.addEventListener("online", warmPosShell);

    navigator.serviceWorker.register("/sw.js")
      .then(async (result) => {
        registration = result;
        result.waiting?.postMessage({ type: "SKIP_WAITING" });
        await navigator.serviceWorker.ready;
        warmPosShell();
        void result.update();
      })
      .catch(() => {
        // The POS still has its local data cache if service workers are unavailable.
      });

    return () => {
      navigator.serviceWorker.removeEventListener("message", handleWorkerMessage);
      window.removeEventListener("online", warmPosShell);
    };
  }, []);

  return null;
}

"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function TurnstileWidget({ onVerify, resetSignal = 0 }: { onVerify: (token: string) => void; resetSignal?: number }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const callbackRef = useRef(onVerify);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    callbackRef.current = onVerify;
  }, [onVerify]);

  const renderWidget = useCallback(() => {
    if (!siteKey || !scriptReady || !window.turnstile || !containerRef.current || widgetIdRef.current) return;
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action: "store_checkout",
      theme: "light",
      size: "flexible",
      callback: (token: string) => callbackRef.current(token),
      "expired-callback": () => callbackRef.current(""),
      "error-callback": () => callbackRef.current(""),
    });
  }, [scriptReady, siteKey]);

  useEffect(() => {
    renderWidget();
    return () => {
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    };
  }, [renderWidget]);

  useEffect(() => {
    if (resetSignal > 0 && widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
      callbackRef.current("");
    }
  }, [resetSignal]);

  if (!siteKey) return <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">Verifikasi keamanan checkout belum dikonfigurasi.</p>;

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={() => setScriptReady(true)} />
      <div ref={containerRef} className="min-h-[65px] w-full overflow-hidden rounded-xl" aria-label="Verifikasi keamanan" />
    </>
  );
}

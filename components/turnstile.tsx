"use client";

import { useEffect, useRef, useState } from "react";

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      theme?: "auto" | "light" | "dark";
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    }
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * Renders the Cloudflare Turnstile widget and mirrors the verification token
 * into a hidden `turnstile_token` input, so a plain <form> POST (or Server
 * Action) picks it up automatically.
 *
 * Turnstile tokens are single-use, and the mirrored token survives React's
 * post-action form reset — so a resubmit after a failed action would replay an
 * already-spent token. Bump `resetKey` (e.g. an error counter) to ask the
 * widget for a fresh one.
 */
export function Turnstile({ sitekey, resetKey }: { sitekey: string; resetKey?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const lastResetKeyRef = useRef(resetKey);
  const [token, setToken] = useState("");

  useEffect(() => {
    let cancelled = false;

    const render = () => {
      if (cancelled || widgetIdRef.current !== undefined) return;
      const container = containerRef.current;
      if (!container || !window.turnstile) return;
      widgetIdRef.current = window.turnstile.render(container, {
        sitekey,
        theme: "auto",
        callback: (value) => setToken(value),
        "expired-callback": () => setToken(""),
        "error-callback": () => setToken(""),
      });
    };

    if (window.turnstile) {
      render();
    } else {
      let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = SCRIPT_ID;
        script.src = SCRIPT_SRC;
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", render);
    }

    return () => {
      cancelled = true;
      if (widgetIdRef.current !== undefined) {
        window.turnstile?.remove(widgetIdRef.current);
        widgetIdRef.current = undefined;
      }
    };
  }, [sitekey]);

  // Deliberately *not* folded into the render effect above: putting `resetKey`
  // in its deps would tear down and rebuild the iframe on every error. Reset
  // the existing widget instead, and skip the initial mount by only acting
  // when the key actually changed (undefined stays undefined, so an absent
  // prop never resets).
  useEffect(() => {
    if (lastResetKeyRef.current === resetKey) return;
    lastResetKeyRef.current = resetKey;
    // Drop the spent token first: even if the widget can't be reset yet, a
    // stale token must never reach the server action.
    setToken("");
    if (widgetIdRef.current !== undefined) window.turnstile?.reset(widgetIdRef.current);
  }, [resetKey]);

  return (
    <div>
      <div ref={containerRef} />
      <input type="hidden" name="turnstile_token" value={token} />
    </div>
  );
}

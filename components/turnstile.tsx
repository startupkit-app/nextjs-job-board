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
      size?: "normal" | "compact";
      appearance?: "always" | "execute" | "interaction-only";
      execution?: "render" | "execute";
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    }
  ) => string;
  execute: (element: HTMLElement) => void;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

interface QuietState {
  requested: boolean;
  executed: boolean;
  verified: boolean;
  failed: boolean;
}

function runChallenge(container: HTMLElement | null, widgetId: string | undefined, state: QuietState) {
  state.requested = true;
  if (!container || widgetId === undefined || state.executed) return;
  state.executed = true;
  window.turnstile?.execute(container);
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
 *
 * `quiet` hides the widget unless Cloudflare needs the visitor and starts the
 * challenge on the first interaction with the surrounding form. A submit that
 * beats the token is held until the token arrives or the widget errors.
 */
export function Turnstile({
  sitekey,
  resetKey,
  size = "normal",
  quiet = false,
}: {
  sitekey: string;
  resetKey?: number;
  size?: "normal" | "compact";
  quiet?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const lastResetKeyRef = useRef(resetKey);
  const [token, setToken] = useState("");
  const [failed, setFailed] = useState(false);
  // Native form listeners read this between renders, so it cannot be React state.
  const quietRef = useRef<QuietState>({ requested: false, executed: false, verified: false, failed: false });
  const heldSubmitterRef = useRef<HTMLElement | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const state = quietRef.current;

    const render = () => {
      if (cancelled || widgetIdRef.current !== undefined) return;
      const container = containerRef.current;
      if (!container || !window.turnstile) return;
      widgetIdRef.current = window.turnstile.render(container, {
        sitekey,
        theme: "auto",
        size,
        ...(quiet && { appearance: "interaction-only", execution: "execute" }),
        callback: (value) => {
          state.verified = true;
          setToken(value);
        },
        "expired-callback": () => {
          state.verified = false;
          setToken("");
          // An execute-mode widget does not refresh itself: the next interaction runs it again.
          if (quiet && widgetIdRef.current !== undefined) {
            window.turnstile?.reset(widgetIdRef.current);
            state.executed = false;
          }
        },
        "error-callback": () => {
          state.verified = false;
          state.failed = true;
          setToken("");
          setFailed(true);
        },
      });
      if (quiet && state.requested) runChallenge(container, widgetIdRef.current, state);
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
      state.executed = false;
      state.verified = false;
      if (widgetIdRef.current !== undefined) {
        window.turnstile?.remove(widgetIdRef.current);
        widgetIdRef.current = undefined;
      }
    };
  }, [sitekey, size, quiet]);

  useEffect(() => {
    const form = quiet ? containerRef.current?.closest("form") : null;
    if (!form) return;
    const state = quietRef.current;
    const start = () => runChallenge(containerRef.current, widgetIdRef.current, state);
    const holdUntilVerified = (event: SubmitEvent) => {
      if (state.verified || state.failed || widgetIdRef.current === undefined) return;
      // Fires before React's root listener, which skips the form action for a prevented submit.
      event.preventDefault();
      heldSubmitterRef.current = event.submitter;
      start();
    };
    form.addEventListener("focusin", start);
    form.addEventListener("submit", holdUntilVerified);
    return () => {
      form.removeEventListener("focusin", start);
      form.removeEventListener("submit", holdUntilVerified);
    };
  }, [quiet]);

  // An effect, so the held submit reads the hidden input after React commits the token.
  useEffect(() => {
    const submitter = heldSubmitterRef.current;
    if (submitter === undefined || (!token && !failed)) return;
    heldSubmitterRef.current = undefined;
    containerRef.current?.closest("form")?.requestSubmit(submitter);
  }, [token, failed]);

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
    setFailed(false);
    Object.assign(quietRef.current, { executed: false, verified: false, failed: false });
    if (widgetIdRef.current !== undefined) window.turnstile?.reset(widgetIdRef.current);
  }, [resetKey]);

  return (
    <div>
      <div ref={containerRef} />
      <input type="hidden" name="turnstile_token" value={token} />
    </div>
  );
}

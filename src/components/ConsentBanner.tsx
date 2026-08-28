"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

/**
 * The cookie consent gate.
 *
 * famlove is an EU trader selling to consumers, so under ePrivacy a cookie
 * that is not strictly necessary cannot be set before the visitor agrees.
 * DataFast's default script identifies visitors with a cookie, which is what
 * makes this banner necessary — the site ran without one until it was added.
 *
 * The three states are deliberately not "on / off":
 *
 *   no answer yet — Google Analytics runs with consent denied, which is its
 *                   cookieless mode: no cookie, no stored identifier. That is
 *                   lawful without consent, so basic traffic counts are never
 *                   lost to an unanswered banner. DataFast does not load.
 *   accepted      — GA consent updates to granted and DataFast is injected.
 *   declined      — nothing changes from the unanswered state, and the answer
 *                   is remembered so the banner stops asking.
 *
 * Advertising signals stay denied in every state, because famlove does not
 * advertise and consent should not be collected for something that will not
 * happen.
 */

const KEY = "famlove.consent";
type Choice = "granted" | "denied";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    datafast?: (goal: string, params?: Record<string, string>) => void;
  }
}

function loadDataFast() {
  const id = process.env.NEXT_PUBLIC_DATAFAST_ID;
  const domain = process.env.NEXT_PUBLIC_DATAFAST_DOMAIN;
  if (!id || document.getElementById("datafast")) return;

  const script = document.createElement("script");
  script.id = "datafast";
  script.defer = true;
  script.src = "https://datafa.st/js/script.js";
  script.setAttribute("data-website-id", id);
  if (domain) script.setAttribute("data-domain", domain);
  document.head.appendChild(script);
}

function grant() {
  // Analytics only. Nothing here advertises, so the ad signals stay denied.
  window.gtag?.("consent", "update", { analytics_storage: "granted" });
  loadDataFast();
}

export function ConsentBanner() {
  // null while unknown, so nothing renders until the stored answer is read —
  // reading localStorage during render would not match the server's HTML.
  const [choice, setChoice] = useState<Choice | null | "unset">(null);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(KEY);
    } catch {
      // Private mode, or storage blocked. Treat it as unanswered rather than
      // as consent — the safe direction is always "no cookie".
    }
    if (stored === "granted") {
      grant();
      setChoice("granted");
    } else if (stored === "denied") {
      setChoice("denied");
    } else {
      setChoice("unset");
    }
  }, []);

  const answer = useCallback((next: Choice) => {
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Unstorable, so the banner returns next visit. Annoying, not unlawful.
    }
    if (next === "granted") grant();
    setChoice(next);
  }, []);

  if (choice !== "unset") return null;

  /*
   * Top on phones, bottom on desktop.
   *
   * X and Instagram open links in a webview that starts as a partial-height
   * sheet: the page is full height but only its top is on screen until the
   * user drags it up. Anything pinned to bottom-0 is then simply below the
   * fold, and no amount of padding or safe-area inset reaches it — the
   * buttons were unreachable in X's in-app browser, which is exactly where
   * this product's traffic arrives from.
   *
   * The safe-area padding stays for iOS, where the home indicator overlaps a
   * bottom bar on a normal browser.
   */
  return (
    <div
      role="dialog"
      aria-label="Cookies"
      className="fixed inset-x-0 top-0 z-50 border-b border-line bg-ink-2/95 backdrop-blur sm:bottom-0 sm:top-auto sm:border-b-0 sm:border-t sm:pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-5 sm:py-4">
        <p className="flex-1 text-sm leading-relaxed text-mute">
          {/* Short on phones: a banner that needs four lines to make its point
              is a banner people dismiss without reading either way. */}
          <span className="sm:hidden">We count visits. Allow a cookie and we can tell a returning visitor from a new one. </span>
          <span className="hidden sm:inline">
            We count visits to see what people actually read. Say yes and we can
            tell a returning visitor from a new one, which needs a cookie. Say no
            and we still count the visit, just without one.{" "}
          </span>
          <Link
            href="/legal/privacy"
            className="text-chalk underline underline-offset-4"
          >
            What we collect
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => answer("denied")}
            className="rounded-full border border-line px-4 py-2 text-sm font-medium text-mute transition hover:border-line-2 hover:text-chalk"
          >
            No cookies
          </button>
          <button
            type="button"
            onClick={() => answer("granted")}
            className="btn-love rounded-full px-5 py-2 text-sm font-semibold"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}

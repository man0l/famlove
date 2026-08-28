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

  return (
    <div
      role="dialog"
      aria-label="Cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-ink-2/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-5">
        <p className="flex-1 text-sm leading-relaxed text-mute">
          We count visits to see what people actually read. Say yes and we can
          tell a returning visitor from a new one, which needs a cookie. Say no
          and we still count the visit, just without one.{" "}
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

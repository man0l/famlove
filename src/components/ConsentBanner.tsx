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
 *   accepted      — GA consent updates to granted, and DataFast and the X
 *                   pixel are injected.
 *   declined      — nothing changes from the unanswered state, and the answer
 *                   is remembered so the banner stops asking.
 *
 * Google's ad signals stay denied in every state: famlove buys no Google ads,
 * and consent should not be collected for something that will not happen. X
 * is different — famlove does buy X ads, so its pixel loads on Allow and
 * never before.
 */

const KEY = "famlove.consent";
type Choice = "granted" | "denied";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    datafast?: (goal: string, params?: Record<string, string>) => void;
    twq?: (...args: unknown[]) => void;
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

/*
 * X's base snippet, kept verbatim as a string on purpose.
 *
 * uwt.js reaches back into the stub this defines — twq.queue, twq.version,
 * twq.exe — so rewriting it as tidy TypeScript is a guess at a private
 * contract, and the day X changes it the guess breaks silently rather than
 * loudly. Injected only from grant() and trackXEvent(), never on load: it is
 * an advertising tag and sets a cookie.
 */
function loadXPixel() {
  const id = process.env.NEXT_PUBLIC_X_PIXEL_ID;
  if (!id || document.getElementById("x-pixel")) return;

  const script = document.createElement("script");
  script.id = "x-pixel";
  script.text =
    "!function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments);" +
    "},s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js'," +
    "a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');" +
    `twq('config','${id}');`;
  document.head.appendChild(script);
}

function grant() {
  // Google's ad signals stay denied — famlove buys no Google ads.
  window.gtag?.("consent", "update", { analytics_storage: "granted" });
  loadDataFast();
  loadXPixel();
}

/**
 * Report a conversion to X, if and only if the visitor allowed cookies.
 *
 * This does not guard on `window.twq` being present, and that is the whole
 * point. React runs effects child-first and <ConsentBanner /> is the last node
 * in <body>, so on a cold load of /p/slug?listed=1 by somebody who consented
 * last week, the caller's effect runs *before* the banner's. A `if (!twq)
 * return` here would drop every conversion, and the event would sit at zero
 * looking exactly like a campaign problem rather than a code one. So it loads
 * the pixel itself — idempotent — and relies on the stub's queue.
 *
 * `conversionId` is both the dedupe key and what X is told, so that a server
 * report of the same listing collapses onto this one instead of doubling it.
 */
export function trackXEvent(eventId: string | undefined, conversionId: string) {
  if (!eventId || !conversionId) return;

  let granted = false;
  try {
    granted = window.localStorage.getItem(KEY) === "granted";
  } catch {
    // Storage throws in private mode. No answer readable means no consent.
  }
  if (!granted) return;

  /*
   * A refresh of ?listed=1 is otherwise a second identical event, and X counts
   * it. If sessionStorage is unavailable we fire anyway: a possible duplicate
   * is a smaller error than a conversion nobody ever recorded.
   */
  const seen = `famlove.x.${eventId}.${conversionId}`;
  try {
    if (window.sessionStorage.getItem(seen)) return;
    window.sessionStorage.setItem(seen, "1");
  } catch {
    /* fire anyway */
  }

  loadXPixel();
  window.twq?.("event", eventId, { conversion_id: conversionId });
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
          <span className="sm:hidden">
            We count visits, and measure our X ads. Both need a cookie — say no
            and we still count the visit, without one.{" "}
          </span>
          <span className="hidden sm:inline">
            We count visits to see what people actually read, and we measure
            whether our ads on X led anywhere. Say yes and both get a cookie —
            one to tell a returning visitor from a new one, one to match a
            listing back to an ad. Say no and we still count the visit, just
            without either.{" "}
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

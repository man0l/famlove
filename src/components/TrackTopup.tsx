"use client";

import { useEffect } from "react";

/**
 * Fire the "a jar actually got topped up" goal, once.
 *
 * Deduplicated on the Stripe session id, because /wallet?topped_up=1 is a
 * plain URL: it survives a reload, a back button and a shared link, and each
 * of those would otherwise count as another purchase.
 *
 * Not named `payment` on purpose — DataFast reserves that name for its own
 * Stripe integration, and squatting on it would collide with the numbers that
 * integration produces. This goal counts completions as the browser sees
 * them; the money itself is the webhook's business, and revenue attribution
 * belongs in the Stripe connection rather than here, where an ad blocker or a
 * closed tab silently loses the event.
 *
 * window.datafast only exists once the script has loaded, which only happens
 * after the visitor allows cookies. So this is consent-gated by construction:
 * no consent, no script, no call.
 */
export function TrackTopup({ sessionId }: { sessionId: string }) {
  useEffect(() => {
    if (!sessionId) return;
    const key = `famlove.topup.${sessionId}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // Storage blocked. Better to risk one duplicate than to lose the goal.
    }
    window.datafast?.("topup_completed");
  }, [sessionId]);

  return null;
}

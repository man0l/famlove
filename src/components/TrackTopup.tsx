"use client";

import { useEffect } from "react";
import { trackXEvent } from "./ConsentBanner";

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
 * no consent, no script, no call. trackXEvent checks the stored answer for
 * itself, for the reason its own comment gives.
 */
export function TrackTopup({
  sessionId,
  netCents,
  currency,
  buyerEmail,
}: {
  sessionId: string;
  /** What famlove actually earned, in minor units — see below on why net. */
  netCents?: number;
  currency?: string;
  buyerEmail?: string | null;
}) {
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

    /*
     * The same purchase, told to X, so a campaign can optimise for people who
     * pay rather than people who arrive.
     *
     * Only when the sale is one we can see in our own ledger. /wallet is a
     * plain URL, so ?topped_up=1&session_id=anything is a request anybody can
     * make — and an unverified purchase event is not merely a wrong number,
     * it is a wrong number the optimiser spends money acting on. No row, no
     * event: a made-up id, somebody else's checkout, and a refunded one all
     * report nothing.
     *
     * The value is net of VAT on purpose. Gross would report a Bulgarian
     * buyer's €3 top-up as 20% more valuable than an American's identical one,
     * purely because VAT is collected on top — and the campaign would learn to
     * chase the EU. VAT is never famlove's money; reporting it as revenue
     * teaches the optimiser something false.
     *
     * The session id is the conversion id here, as it is for DataFast: one
     * checkout, one purchase, however many times /wallet?topped_up=1 is
     * reloaded or shared.
     */
    if (typeof netCents === "number") {
      trackXEvent(process.env.NEXT_PUBLIC_X_TOPUP_EVENT_ID, sessionId, {
        email: buyerEmail,
        value: netCents / 100,
        currency,
      });
    }
  }, [sessionId, netCents, currency, buyerEmail]);

  return null;
}

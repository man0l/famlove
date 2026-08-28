import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { SITE_URL, tierById, tierPriceId } from "@/lib/config";
import {
  creditWallet,
  liveConfigError,
  stripe,
  stripeConfigured,
  stripeIsLive,
} from "@/lib/payments";

/**
 * Buy a jar. One card charge; the cents inside it are then free to spend.
 * Never call this a tip or a donation, in code or in copy: famlove consumes
 * the cent in exchange for a feature, and that is what keeps this out of
 * money transmission, payouts, Connect and KYC entirely.
 */
export async function POST(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const form = await request.formData();
  const tier = tierById(String(form.get("tier") ?? ""));
  if (!tier) {
    return NextResponse.redirect(
      new URL("/wallet?error=bad_tier", request.nextUrl.origin),
      {
        status: 303,
      },
    );
  }

  const misconfigured = liveConfigError();
  if (misconfigured) {
    // Better a missed sale than a charge we cannot credit. See liveConfigError.
    console.error(`[checkout] refusing live checkout: ${misconfigured}`);
    return NextResponse.redirect(
      new URL("/wallet?error=payments_unavailable", request.nextUrl.origin),
      { status: 303 },
    );
  }

  if (!stripeConfigured()) {
    const devEnabled =
      process.env.ALLOW_DEV_LOGIN === "1" &&
      process.env.NODE_ENV !== "production";
    if (!devEnabled) {
      return NextResponse.redirect(
        new URL("/wallet?error=payments_unavailable", request.nextUrl.origin),
        { status: 303 },
      );
    }
    // Local runs get a jar without a card so the game is playable offline.
    await creditWallet({
      userId: user.id,
      provider: "dev",
      providerRef: `dev-${user.id}-${Date.now()}`,
      tier: tier.id,
      grossCents: tier.cents,
      grantedCents: tier.grantedCents,
      card: null,
    });
    return NextResponse.redirect(
      new URL("/wallet?topped_up=dev", request.nextUrl.origin),
      { status: 303 },
    );
  }

  // Tax is on by default on a live key: this sells digital credit to EU
  // consumers from an EU company, and "we'll turn VAT on later" is not a
  // position anyone wants to be in after the first hundred sales.
  const taxEnabled = process.env.STRIPE_TAX
    ? process.env.STRIPE_TAX === "1"
    : stripeIsLive();

  const priceId = tierPriceId(tier.id);

  /*
   * Asking for terms acceptance requires a Terms URL on the Stripe account,
   * and refusing the session outright when there is none. The live account has
   * one; the sandbox is a different account and does not, so sending this
   * unconditionally made checkout fail in test mode with "you cannot collect
   * consent to your terms of service unless a URL is set".
   *
   * Gating on live rather than on a second flag means going back to live
   * restores the tick-box automatically. A switch you have to remember is a
   * dispute defence you eventually ship without.
   */
  const collectTos = process.env.STRIPE_TOS_CONSENT === "1" && stripeIsLive();

  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    /*
     * A real catalogue Price when one is configured, the inline price_data
     * otherwise.
     *
     * The inline form creates no Product, so famlove's sales were
     * indistinguishable from the other businesses sharing this Stripe account
     * and could not be filtered by product anywhere downstream. The fallback
     * stays because price ids are mode-specific — a live id is "no such
     * price" against a test key — so an unconfigured environment still works.
     *
     * The Price carries tax_behavior=inclusive itself, which is why it is not
     * repeated here; automatic_tax below still applies to both paths.
     */
    line_items: [
      priceId
        ? { price: priceId, quantity: 1 }
        : {
            quantity: 1,
            price_data: {
              currency: process.env.CHECKOUT_CURRENCY ?? "usd",
              unit_amount: tier.cents,
              /*
               * Inclusive, not exclusive — this is load-bearing.
               *
               * The whole product is "$3 buys 300 cents". With exclusive tax an EU
               * buyer is asked for $3.63 at the till and the sentence stops being
               * true. Inclusive keeps the sticker price the price and takes VAT
               * out of the merchant's side, which is exactly how the margin in
               * README §money is modelled.
               */
              tax_behavior: taxEnabled ? "inclusive" : undefined,
              product_data: {
                name: `${tier.grantedCents} cents on famlove`,
                description:
                  "Credit for showing up. 1¢ per person, per project, per day. Non-transferable, refundable while unspent.",
                ...(process.env.STRIPE_TAX_CODE
                  ? { tax_code: process.env.STRIPE_TAX_CODE }
                  : {}),
              },
            },
          },
    ],
    // A statement descriptor people recognise is the cheapest dispute defence.
    payment_intent_data: {
      statement_descriptor_suffix:
        process.env.STATEMENT_DESCRIPTOR_SUFFIX ?? "FAMLOVE",
    },
    client_reference_id: String(user.id),
    metadata: {
      user_id: String(user.id),
      tier: tier.id,
      granted_cents: String(tier.grantedCents),
    },
    automatic_tax: { enabled: taxEnabled },
    /*
     * Terms §7 says the buyer agrees at checkout that supply begins
     * immediately and that they lose the statutory 14-day withdrawal right
     * over cents they then spend. That has to actually be asked, or the
     * sentence is decoration — so it is asked here, on the payment page,
     * where consent to immediate supply legally has to be given.
     *
     * The tick-box form needs a Terms URL set in the Stripe dashboard
     * (Settings → Checkout), hence the flag; the written notice below always
     * shows either way.
     */
    ...(collectTos
      ? { consent_collection: { terms_of_service: "required" as const } }
      : {}),
    custom_text: {
      submit: {
        message:
          "Your cents arrive immediately, so you agree supply starts now and " +
          "that you give up the 14-day right to withdraw from any cent you " +
          "spend. Unspent cents are refunded in full, anytime, no questions.",
      },
      ...(collectTos
        ? {
            terms_of_service_acceptance: {
              message: `I agree to the [Terms of Service](${SITE_URL}/legal/terms).`,
            },
          }
        : {}),
    },
    // Stripe Tax needs somewhere to tax; Checkout collects it for us.
    billing_address_collection: taxEnabled ? "required" : "auto",
    customer_creation: "if_required",
    // The session id comes back so /wallet can credit the jar even if the
    // webhook is late, blocked, or misconfigured. See reconcileCheckoutSession.
    success_url: `${SITE_URL}/wallet?topped_up=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE_URL}/wallet?cancelled=1`,
  });

  return NextResponse.redirect(session.url!, { status: 303 });
}

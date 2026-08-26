import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { SITE_URL, tierById } from "@/lib/config";
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
    return NextResponse.redirect(new URL("/wallet?error=bad_tier", request.nextUrl.origin), {
      status: 303,
    });
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
      process.env.ALLOW_DEV_LOGIN === "1" && process.env.NODE_ENV !== "production";
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

  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
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

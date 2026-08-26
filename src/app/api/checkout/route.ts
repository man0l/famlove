import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { SITE_URL, tierById } from "@/lib/config";
import { creditWallet, stripe, stripeConfigured } from "@/lib/payments";

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

  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: tier.cents,
          product_data: {
            name: `${tier.grantedCents} cents on famlove`,
            description:
              "Credit for showing up. 1¢ per person, per project, per day. Non-transferable, refundable while unspent.",
          },
        },
      },
    ],
    // A statement descriptor people recognise is the cheapest dispute defence.
    payment_intent_data: { statement_descriptor_suffix: "FAMLOVE" },
    client_reference_id: String(user.id),
    metadata: {
      user_id: String(user.id),
      tier: tier.id,
      granted_cents: String(tier.grantedCents),
    },
    automatic_tax: { enabled: process.env.STRIPE_TAX === "1" },
    success_url: `${SITE_URL}/wallet?topped_up=1`,
    cancel_url: `${SITE_URL}/wallet?cancelled=1`,
  });

  return NextResponse.redirect(session.url!, { status: 303 });
}

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { creditWallet, stripe, stripeConfigured } from "@/lib/payments";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Credit exactly once, and record the card fingerprint while we have it.
 *
 * The fingerprint is the sybil ledger: it is stable per card per account, so
 * storing it UNIQUE turns "make 100 sockpuppets" into "hold 100 distinct
 * cards", which is the difference between a $3 attack and a $300 one.
 */
export async function POST(request: NextRequest) {
  if (!stripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 501 });
  }

  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(
      payload,
      signature ?? "",
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return NextResponse.json({ ok: false, error: "bad_signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = Number(session.metadata?.user_id ?? session.client_reference_id);
    const granted = Number(session.metadata?.granted_cents ?? 0);
    const tier = String(session.metadata?.tier ?? "unknown");
    if (!userId || !granted) return NextResponse.json({ ok: true, skipped: true });

    let card: Parameters<typeof creditWallet>[0]["card"] = null;
    let feeCents = 0;

    if (session.payment_intent) {
      const intent = await stripe().paymentIntents.retrieve(
        String(session.payment_intent),
        { expand: ["latest_charge.balance_transaction"] },
      );
      const charge = intent.latest_charge as Stripe.Charge | null;
      const details = charge?.payment_method_details?.card;
      if (details?.fingerprint) {
        card = {
          fingerprint: details.fingerprint,
          brand: details.brand ?? null,
          last4: details.last4 ?? null,
          funding: details.funding ?? null,
          country: details.country ?? null,
        };
      }
      const balanceTx = charge?.balance_transaction;
      if (balanceTx && typeof balanceTx !== "string") feeCents = balanceTx.fee;
    }

    const result = await creditWallet({
      userId,
      provider: "stripe",
      providerRef: session.id,
      tier,
      grossCents: session.amount_total ?? 0,
      feeCents,
      taxCents: session.total_details?.amount_tax ?? 0,
      grantedCents: granted,
      card,
    });

    if (!result.ok) {
      // Same card, different account: don't credit, refund it, and say why
      // when they come back to /wallet.
      if (session.payment_intent) {
        await stripe().refunds.create({
          payment_intent: String(session.payment_intent),
        });
      }
      await sql`
        INSERT INTO topups (user_id, provider, provider_ref, tier, gross_cents,
                            granted_cents, status)
        VALUES (${userId}, 'stripe', ${session.id}, ${tier},
                ${session.amount_total ?? 0}, 0, ${result.error})
        ON CONFLICT (provider, provider_ref) DO NOTHING
      `;
      return NextResponse.json({ ok: true, rejected: result.error });
    }

    return NextResponse.json({ ok: true, credited: result.credited });
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    if (charge.payment_intent) {
      // The topup is keyed by checkout session id, so find it from the intent.
      const sessions = await stripe().checkout.sessions.list({
        payment_intent: String(charge.payment_intent),
        limit: 1,
      });
      const sessionId = sessions.data[0]?.id;
      if (sessionId) {
        const refundedCents = charge.amount_refunded ?? 0;
        await sql`
          UPDATE topups
          SET refunded_cents = LEAST(granted_cents, ${refundedCents}),
              refunded_at    = now(),
              status         = CASE WHEN ${refundedCents} >= gross_cents
                                    THEN 'refunded' ELSE status END
          WHERE provider = 'stripe' AND provider_ref = ${sessionId}
        `;
      }
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true, ignored: event.type });
}

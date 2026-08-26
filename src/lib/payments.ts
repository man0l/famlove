import Stripe from "stripe";
import { sql } from "./db";
import type { Tier } from "./config";

/**
 * Money in.
 *
 * The vote is never the transaction. Stripe's fixed component (€0.25 in the
 * EEA) makes a 1¢ charge cost 2,502% to process, so users buy a jar of cents
 * once and spending them afterwards is free. One card charge, N acts of
 * support, zero marginal cost.
 *
 * `provider` is a column, not an assumption: v1 ships a Stripe path and a
 * merchant-of-record path (Lemon Squeezy), because once VAT, FX, refunds and
 * disputes are counted the MoR is cheaper at every tier and deletes four
 * compliance jobs from the build. See README §money.
 */

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function lemonConfigured(): boolean {
  return Boolean(
    process.env.LEMONSQUEEZY_API_KEY && process.env.LEMONSQUEEZY_STORE_ID,
  );
}

let client: Stripe | null = null;
export function stripe(): Stripe {
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-10-29.clover",
    });
  }
  return client;
}

export type CreditResult =
  | { ok: true; credited: number; balance: number; duplicate: boolean }
  | { ok: false; error: "card_belongs_to_another_account" | "prepaid_blocked" };

/**
 * Credit a jar, exactly once.
 *
 * Idempotency is a unique index on (provider, provider_ref): webhooks are
 * delivered more than once and a duplicate must be a no-op, not a free jar.
 */
export async function creditWallet(args: {
  userId: number;
  provider: string;
  providerRef: string;
  tier: Tier["id"] | string;
  grossCents: number;
  feeCents?: number;
  taxCents?: number;
  grantedCents: number;
  card?: {
    fingerprint: string;
    brand?: string | null;
    last4?: string | null;
    funding?: string | null;
    country?: string | null;
  } | null;
}): Promise<CreditResult> {
  const {
    userId,
    provider,
    providerRef,
    tier,
    grossCents,
    grantedCents,
    card,
  } = args;

  if (card) {
    if (process.env.BLOCK_PREPAID_CARDS === "1" && card.funding === "prepaid") {
      return { ok: false, error: "prepaid_blocked" };
    }
    // The sybil ledger: one card fingerprint, one account, forever.
    const owner = (await sql`
      SELECT user_id FROM cards WHERE stripe_fingerprint = ${card.fingerprint}
    `) as { user_id: number }[];

    if (owner[0] && Number(owner[0].user_id) !== userId) {
      return { ok: false, error: "card_belongs_to_another_account" };
    }
    if (!owner[0]) {
      await sql`
        INSERT INTO cards (user_id, stripe_fingerprint, brand, last4, funding, country)
        VALUES (${userId}, ${card.fingerprint}, ${card.brand ?? null},
                ${card.last4 ?? null}, ${card.funding ?? null}, ${card.country ?? null})
        ON CONFLICT (stripe_fingerprint) DO NOTHING
      `;
    }
  }

  const inserted = (await sql`
    INSERT INTO topups (user_id, provider, provider_ref, tier, gross_cents,
                        fee_cents, tax_cents, granted_cents, card_fingerprint)
    VALUES (${userId}, ${provider}, ${providerRef}, ${tier}, ${grossCents},
            ${args.feeCents ?? 0}, ${args.taxCents ?? 0}, ${grantedCents},
            ${card?.fingerprint ?? null})
    ON CONFLICT (provider, provider_ref) DO NOTHING
    RETURNING id
  `) as { id: number }[];

  if (!inserted[0]) {
    const [w] = (await sql`
      SELECT cents_balance FROM wallets WHERE user_id = ${userId}
    `) as { cents_balance: number }[];
    return {
      ok: true,
      credited: 0,
      balance: Number(w?.cents_balance ?? 0),
      duplicate: true,
    };
  }

  const [wallet] = (await sql`
    INSERT INTO wallets (user_id, cents_balance, cents_topped_up)
    VALUES (${userId}, ${grantedCents}, ${grantedCents})
    ON CONFLICT (user_id) DO UPDATE
      SET cents_balance   = wallets.cents_balance + ${grantedCents},
          cents_topped_up = wallets.cents_topped_up + ${grantedCents},
          updated_at      = now()
    RETURNING cents_balance
  `) as { cents_balance: number }[];

  return {
    ok: true,
    credited: grantedCents,
    balance: Number(wallet.cents_balance),
    duplicate: false,
  };
}

/**
 * Refunds are a support macro, not a negotiation: unspent balance back in
 * full, no questions. Cents already given away are gone — they bought a pixel
 * on somebody's wall, and that wall is not being edited.
 */
export async function refundUnspent(
  userId: number,
): Promise<{ refundedCents: number; refunds: string[] }> {
  const [wallet] = (await sql`
    SELECT cents_balance FROM wallets WHERE user_id = ${userId}
  `) as { cents_balance: number }[];

  const unspent = Number(wallet?.cents_balance ?? 0);
  if (unspent <= 0) return { refundedCents: 0, refunds: [] };

  const topups = (await sql`
    SELECT id, provider, provider_ref, gross_cents, granted_cents, refunded_cents
    FROM topups
    WHERE user_id = ${userId} AND status = 'paid'
    ORDER BY created_at DESC
  `) as Record<string, unknown>[];

  let remaining = unspent;
  const refs: string[] = [];

  for (const t of topups) {
    if (remaining <= 0) break;
    const refundable =
      Number(t.granted_cents) - Number(t.refunded_cents ?? 0);
    if (refundable <= 0) continue;
    const amount = Math.min(remaining, refundable);

    if (t.provider === "stripe" && stripeConfigured()) {
      const session = await stripe().checkout.sessions.retrieve(
        String(t.provider_ref),
      );
      if (session.payment_intent) {
        const refund = await stripe().refunds.create({
          payment_intent: String(session.payment_intent),
          amount,
        });
        refs.push(refund.id);
      }
    } else {
      refs.push(`${t.provider}:${t.provider_ref}`);
    }

    await sql`
      UPDATE topups
      SET refunded_cents = refunded_cents + ${amount},
          refunded_at    = now(),
          status         = CASE WHEN refunded_cents + ${amount} >= granted_cents
                                THEN 'refunded' ELSE status END
      WHERE id = ${Number(t.id)}
    `;
    remaining -= amount;
  }

  const refunded = unspent - remaining;
  await sql`
    UPDATE wallets
    SET cents_balance = cents_balance - ${refunded}, updated_at = now()
    WHERE user_id = ${userId}
  `;

  return { refundedCents: refunded, refunds: refs };
}

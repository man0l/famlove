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

/**
 * Which of three worlds the top-up buttons are living in.
 *
 *   live  — a provider is configured; buying works and money moves.
 *   test  — a Stripe test key. Checkout opens, cards are never charged.
 *   local — no provider, but dev login is on, so jars are granted for free.
 *   off   — no provider on a real deployment. Buying must not be offered at
 *           all, because the checkout route will refuse it anyway and a
 *           button that goes nowhere is worse than no button.
 */
export function paymentsMode(): "live" | "test" | "local" | "off" {
  // famlove.lol is a public address. A test key behind buttons that look
  // exactly like real ones invites someone to think they bought something.
  if (stripeConfigured() && !stripeIsLive()) return "test";
  if (stripeConfigured() || lemonConfigured()) return "live";
  const devJars =
    process.env.ALLOW_DEV_LOGIN === "1" && process.env.NODE_ENV !== "production";
  return devJars ? "local" : "off";
}

export function stripeIsLive(): boolean {
  return /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? "");
}

/**
 * Refuse to sell what we cannot deliver.
 *
 * A jar is credited by the `checkout.session.completed` webhook. With a live
 * key and no webhook secret, a card is charged and the cents never arrive —
 * the buyer is simply out of pocket. A missed sale is recoverable; taking
 * someone's $3 and giving them nothing is not. So checkout refuses to open.
 */
export function liveConfigError(): string | null {
  if (!stripeIsLive()) return null;
  if (!process.env.STRIPE_WEBHOOK_SECRET) return "missing_webhook_secret";
  return null;
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


/**
 * Belt and braces on the return leg.
 *
 * The webhook is the primary credit path, but webhooks get misconfigured,
 * retried late, or blocked — and the failure mode is a buyer staring at an
 * empty jar they just paid for. So when someone lands back on /wallet with a
 * session id, verify it directly and credit it if nothing has yet.
 *
 * This cannot double-credit: both paths insert into `topups`, which is UNIQUE
 * on (provider, provider_ref), so whichever arrives second is a no-op.
 */
export async function reconcileCheckoutSession(
  sessionId: string,
  userId: number,
): Promise<{ credited: number; balance: number | null; note?: string }> {
  if (!stripeConfigured() || !sessionId.startsWith("cs_")) {
    return { credited: 0, balance: null };
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe().checkout.sessions.retrieve(sessionId);
  } catch {
    return { credited: 0, balance: null, note: "unknown_session" };
  }

  if (session.payment_status !== "paid") {
    return { credited: 0, balance: null, note: session.payment_status };
  }

  // Only ever credit the account that started the session.
  const owner = Number(session.metadata?.user_id ?? session.client_reference_id);
  if (!owner || owner !== userId) {
    return { credited: 0, balance: null, note: "not_yours" };
  }

  const granted = Number(session.metadata?.granted_cents ?? 0);
  if (!granted) return { credited: 0, balance: null, note: "no_grant" };

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
    tier: String(session.metadata?.tier ?? "unknown"),
    grossCents: session.amount_total ?? 0,
    feeCents,
    taxCents: session.total_details?.amount_tax ?? 0,
    grantedCents: granted,
    card,
  });

  if (!result.ok) return { credited: 0, balance: null, note: result.error };
  return { credited: result.credited, balance: result.balance };
}

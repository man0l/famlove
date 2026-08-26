import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { creditWallet } from "@/lib/payments";
import { tierById } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * The merchant-of-record path.
 *
 * Counted honestly — VAT, currency conversion, refunds and disputes, not just
 * the card fee — an MoR at ~5% + 50¢ nets more than raw Stripe at every jar
 * size, and it removes VAT registration, dispute handling and tax config from
 * the build. The trade-off it makes explicit: an MoR gives you no card
 * fingerprint, so sybil defence on this path leans on the X account gate and
 * the jar minimum alone.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 501 });
  }

  const payload = await request.text();
  const signature = request.headers.get("x-signature") ?? "";
  const expected = createHmac("sha256", secret).update(payload).digest("hex");

  const a = Buffer.from(signature, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ ok: false, error: "bad_signature" }, { status: 400 });
  }

  const event = JSON.parse(payload) as {
    meta?: { event_name?: string; custom_data?: Record<string, string> };
    data?: {
      id?: string;
      attributes?: {
        total?: number;
        tax?: number;
        status?: string;
        refunded?: boolean;
      };
    };
  };

  if (event.meta?.event_name !== "order_created") {
    return NextResponse.json({ ok: true, ignored: event.meta?.event_name });
  }

  const userId = Number(event.meta.custom_data?.user_id ?? 0);
  const tier = tierById(String(event.meta.custom_data?.tier ?? ""));
  const orderId = String(event.data?.id ?? "");
  if (!userId || !tier || !orderId) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const gross = Number(event.data?.attributes?.total ?? tier.cents);
  const tax = Number(event.data?.attributes?.tax ?? 0);

  const result = await creditWallet({
    userId,
    provider: "lemonsqueezy",
    providerRef: orderId,
    tier: tier.id,
    grossCents: gross,
    // The MoR's flat rate, recorded so /cents stays honest.
    feeCents: Math.round(gross * 0.05) + 50,
    taxCents: tax,
    grantedCents: tier.grantedCents,
    card: null,
  });

  return NextResponse.json({ ok: result.ok });
}

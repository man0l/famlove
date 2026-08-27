import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { givenToday } from "@/lib/queries";
import { sql } from "@/lib/db";
import { DAILY_GIVE_CEILING, TIERS } from "@/lib/config";
import { formatCents, isoDay } from "@/lib/time";
import { paymentsMode, reconcileCheckoutSession } from "@/lib/payments";
import { Sticker } from "@/components/Sticker";
import { TrustRow } from "@/components/TrustRow";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your jar" };

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  let user = await currentUser();
  if (!user) redirect("/join");
  const query = await searchParams;

  /*
   * If they just came back from Checkout, settle up before rendering. The
   * webhook is usually first, in which case this is a no-op — but when it
   * isn't, this is the difference between "your cents are here" and a buyer
   * staring at an empty jar they just paid for.
   */
  let lateCredit = 0;
  if (query.session_id) {
    const settled = await reconcileCheckoutSession(query.session_id, user.id);
    if (settled.credited > 0) {
      lateCredit = settled.credited;
      user = (await currentUser()) ?? user;
    }
  }

  const given = await givenToday(user.id);
  const [mine] = (await sql`
    SELECT slug FROM projects WHERE owner_id = ${user.id} AND removed_at IS NULL
  `) as { slug: string }[];
  const topups = (await sql`
    SELECT provider, tier, gross_cents, granted_cents, status, created_at
    FROM topups WHERE user_id = ${user.id}
    ORDER BY created_at DESC LIMIT 20
  `) as Record<string, unknown>[];

  const empty = user.centsBalance < 1;
  const payments = paymentsMode();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="display text-4xl">Your jar</h1>
          <p className="mt-2 max-w-md text-mute">
            Buy cents once. Spending them is free — every cent after that costs
            you nothing extra, forever.
          </p>
        </div>
        <Sticker name="penny" size={72} float="slow" className="shrink-0" />
      </div>

      {query.topped_up && (
        <Flash tone="love">
          {lateCredit > 0
            ? `${lateCredit} cents landed. Go put your face on somebody's wall.`
            : "Jar topped up. Go put your face on somebody's wall."}
        </Flash>
      )}
      {query.refunded && Number(query.refunded) > 0 && (
        <Flash tone="plain">
          Refunded {formatCents(Number(query.refunded))} — back on your card in
          a few days. No hard feelings.
        </Flash>
      )}
      {query.saved && <Flash tone="plain">Saved.</Flash>}
      {query.error === "payments_unavailable" && (
        <Flash tone="plain">
          Payments aren&apos;t configured on this deployment yet.
        </Flash>
      )}
      {query.cancelled && (
        <Flash tone="plain">
          No charge made. Come back whenever.
        </Flash>
      )}

      <section className="mt-8 grid grid-cols-3 gap-2">
        <Cell label="In the jar" value={`${user.centsBalance}¢`} tint="love" />
        <Cell label="Given, all time" value={`${user.centsGiven}`} tint="lime" />
        <Cell label="Today" value={`${given}/${DAILY_GIVE_CEILING}`} />
      </section>

      <section className="mt-10">
        <h2 className="display text-2xl">
          {empty ? "Fill it up" : "Top up"}
        </h2>
        <p className="mt-1.5 text-sm text-mute">
          Every tier is the same deal: one cent, one person, one wall. You&apos;re
          only choosing how many times you get to do it.
        </p>

        {payments === "test" && (
          <p className="mt-4 rounded-2xl border border-butter/40 bg-butter/10 px-4 py-3 text-sm text-butter">
            <strong>Sandbox.</strong> Checkout opens but no card is ever
            charged — use 4242 4242 4242 4242. Cents granted here are not
            bought and may be wiped.
          </p>
        )}

        {payments === "off" && (
          <p className="mt-4 rounded-2xl border border-line bg-ink-2 px-4 py-3 text-sm text-mute">
            Top-ups aren&apos;t switched on yet. Nothing here can take your
            money, and nothing is being charged.
          </p>
        )}

        <div
          className={`mt-4 grid gap-3 sm:grid-cols-3 ${
            payments === "off" ? "pointer-events-none opacity-40" : ""
          }`}
          aria-hidden={payments === "off"}
        >
          {TIERS.map((tier) => (
            <form key={tier.id} action="/api/checkout" method="post">
              <input type="hidden" name="tier" value={tier.id} />
              <button
                type="submit"
                disabled={payments === "off"}
                className={`card card-hover flex h-full w-full cursor-pointer flex-col p-5 text-left ${
                  tier.featured
                    ? "border-love/60 bg-love/8 hover:border-love"
                    : "hover:border-love/50"
                }`}
              >
                {/* A fixed-height slot so all three prices share a baseline,
                    badge or no badge. */}
                <span className="mb-2 flex h-5 items-center">
                  {tier.featured && (
                    <span className="rounded-full bg-love px-2.5 py-0.5 text-[11px] font-semibold text-white">
                      most people pick this
                    </span>
                  )}
                </span>
                <span className="tabular display block text-3xl">
                  {formatCents(tier.cents)}
                </span>
                {/*
                  The number that actually matters isn't the price, it's how
                  many humans you get to show up for. Dollars are the friction;
                  acts are the product.
                */}
                <span className="mt-1 block text-sm font-medium text-chalk">
                  {tier.grantedCents.toLocaleString()} people
                </span>
                <span className="mt-1 block text-xs text-mute">
                  1¢ each. No fee on any of them.
                </span>

                {/*
                  These cards were the buy buttons, and nothing said so — same
                  rounded panel as the balance tiles directly above, no verb,
                  no arrow. People read them as information and looked for a
                  button that did not exist. The action needs to look like one.
                */}
                <span
                  className={`mt-4 block w-full rounded-full px-4 py-2.5 text-center text-sm font-semibold transition ${
                    tier.featured
                      ? "bg-love text-white"
                      : "border border-line-2 text-chalk group-hover:border-love"
                  }`}
                >
                  Get {tier.grantedCents.toLocaleString()} cents →
                </span>
              </button>
            </form>
          ))}
        </div>

        <div className="mt-5">
          <TrustRow />
        </div>

        <p className="mt-4 text-xs text-mute">
          No bonus cents at any tier — $30 buys 3,000¢, not 3,600¢, because the
          moment a cent stops being a cent, &ldquo;one human, one cent&rdquo;
          stops being true.
          {payments === "local" &&
            " · Payments are in local mode — jars are granted without a card."}
        </p>
      </section>

      <section className="card mt-10 p-5">
        <div className="flex items-start gap-4">
          <Sticker name="sparkle" size={52} className="shrink-0" />
          <div>
            <h2 className="display text-xl">Get the good email</h2>
            <p className="mt-1 text-sm text-mute">
              One email, ever: &ldquo;N people showed up for you today&rdquo;,
              with their handles. Nothing else. X doesn&apos;t hand us your
              address, so this is opt-in.
            </p>
          </div>
        </div>
        <form action="/api/settings" method="post" className="mt-4 flex gap-2">
          <input
            type="email"
            name="email"
            defaultValue={user.email ?? ""}
            placeholder="you@example.com"
            className="min-w-0 flex-1 rounded-full border border-line bg-ink px-4 py-2.5 text-sm outline-none transition focus:border-love"
          />
          <button
            type="submit"
            className="shrink-0 rounded-full border border-line px-4 py-2.5 text-sm font-medium transition hover:border-love hover:text-love"
          >
            Save
          </button>
        </form>
      </section>

      {topups.length > 0 && (
        <section className="mt-10">
          <h2 className="display text-xl">Receipts</h2>
          <ul className="mt-3 space-y-1.5">
            {topups.map((t, i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-2xl border border-line/60 px-4 py-2.5 text-sm"
              >
                <span className="tabular text-mute">{isoDay(t.created_at)}</span>
                <span className="capitalize">{String(t.tier)}</span>
                <span className="tabular ml-auto">
                  {formatCents(Number(t.gross_cents))}
                </span>
                <span className="tabular w-20 text-right text-lime">
                  +{Number(t.granted_cents)}¢
                </span>
                <span className="w-20 text-right text-xs text-mute">
                  {String(t.status)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10 rounded-[26px] border border-dashed border-line p-5">
        <h2 className="display text-xl">Changed your mind?</h2>
        <p className="mt-1.5 text-sm text-mute">
          Take the unspent balance back, in full, right now. No form, no email,
          no &ldquo;can we ask why&rdquo;. Cents you already gave stay given —
          they bought a pixel on somebody&apos;s wall and that wall isn&apos;t
          being edited.
        </p>
        <form action="/api/refund" method="post" className="mt-3">
          <button
            type="submit"
            disabled={empty}
            className="rounded-full border border-line px-5 py-2.5 text-sm font-medium transition hover:border-love hover:text-love disabled:opacity-40"
          >
            Refund {user.centsBalance}¢
          </button>
        </form>
      </section>

      <div className="mt-10 flex items-center justify-between text-sm text-mute">
        <Link
          href={mine ? `/p/${mine.slug}` : "/new"}
          className="font-medium transition hover:text-chalk"
        >
          {mine ? "Your wall →" : "List your project →"}
        </Link>
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="transition hover:text-chalk">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

function Flash({
  tone,
  children,
}: {
  tone: "love" | "plain";
  children: React.ReactNode;
}) {
  return (
    <p
      className={`mt-6 rounded-2xl px-4 py-3 text-sm ${
        tone === "love"
          ? "border border-love/40 bg-love/10 text-love-soft"
          : "border border-line bg-ink-2 text-mute"
      }`}
    >
      {children}
    </p>
  );
}

const TINTS = { love: "text-love", lime: "text-lime", none: "text-chalk" } as const;

function Cell({
  label,
  value,
  tint = "none",
}: {
  label: string;
  value: string;
  tint?: keyof typeof TINTS;
}) {
  return (
    <div className="card px-4 py-4">
      <p className="text-xs font-medium text-mute">{label}</p>
      <p className={`tabular display mt-1 text-2xl ${TINTS[tint]}`}>{value}</p>
    </div>
  );
}

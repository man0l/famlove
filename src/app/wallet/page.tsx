import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { givenToday } from "@/lib/queries";
import { sql } from "@/lib/db";
import { DAILY_GIVE_CEILING, TIERS } from "@/lib/config";
import { formatCents, isoDay } from "@/lib/time";
import { stripeConfigured } from "@/lib/payments";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your jar" };

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const user = await currentUser();
  if (!user) redirect("/join");
  const query = await searchParams;

  const given = await givenToday(user.id);
  const topups = (await sql`
    SELECT provider, tier, gross_cents, granted_cents, status, created_at
    FROM topups WHERE user_id = ${user.id}
    ORDER BY created_at DESC LIMIT 20
  `) as Record<string, unknown>[];

  const live = stripeConfigured();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Your jar</h1>
      <p className="mt-2 text-mute">
        You buy cents once. Spending them is free — one card charge, as many
        acts of support as you have cents, and no fee on any of them. That is
        the only reason a 1¢ vote can exist at all.
      </p>

      {query.topped_up && (
        <p className="mt-5 rounded-xl border border-love/40 bg-love/5 px-4 py-3 font-mono text-sm text-love">
          Jar topped up. Go put your face on somebody&apos;s wall.
        </p>
      )}
      {query.refunded && Number(query.refunded) > 0 && (
        <p className="mt-5 rounded-xl border border-line px-4 py-3 font-mono text-sm">
          Refunded {formatCents(Number(query.refunded))}. It&apos;ll land back on
          your card in a few days.
        </p>
      )}
      {query.error === "payments_unavailable" && (
        <p className="mt-5 rounded-xl border border-line px-4 py-3 font-mono text-sm text-mute">
          Payments aren&apos;t configured on this deployment yet.
        </p>
      )}

      <section className="mt-8 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line">
        <Cell label="In the jar" value={`${user.centsBalance}¢`} accent />
        <Cell label="Given, all time" value={`${user.centsGiven}`} />
        <Cell label="Given today" value={`${given} / ${DAILY_GIVE_CEILING}`} />
      </section>

      <section className="mt-8">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-mute">
          Top up
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {TIERS.map((tier) => (
            <form key={tier.id} action="/api/checkout" method="post">
              <input type="hidden" name="tier" value={tier.id} />
              <button
                type="submit"
                className={`w-full rounded-xl border p-4 text-left transition ${
                  tier.featured
                    ? "border-love bg-love/5 hover:bg-love/10"
                    : "border-line hover:border-mute"
                }`}
              >
                <span className="tabular block font-mono text-2xl">
                  {formatCents(tier.cents)}
                </span>
                <span className="tabular block font-mono text-xs text-mute">
                  {tier.grantedCents.toLocaleString()} cents
                </span>
                <span className="mt-2 block text-xs text-mute">{tier.blurb}</span>
              </button>
            </form>
          ))}
        </div>
        <p className="mt-3 font-mono text-xs text-mute">
          No bonus cents at any tier — $30 buys 3,000¢, not 3,600¢. A cent is
          always a cent.
          {!live && " · Payments are in local mode on this deployment."}
        </p>
      </section>

      <section className="mt-10 rounded-xl border border-line p-5">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-mute">
          Get the email
        </h2>
        <p className="mt-1.5 text-sm text-mute">
          One email, ever: &ldquo;N people showed up for you today&rdquo;, with
          their handles. X doesn&apos;t give us your address, so this is opt-in.
        </p>
        <form action="/api/settings" method="post" className="mt-3 flex gap-2">
          <input
            type="email"
            name="email"
            defaultValue={user.email ?? ""}
            placeholder="you@example.com"
            className="flex-1 rounded-lg border border-line bg-ink px-3 py-2 font-mono text-sm outline-none focus:border-love"
          />
          <button
            type="submit"
            className="rounded-lg border border-line px-4 py-2 font-mono text-xs uppercase tracking-[0.14em] transition hover:border-love hover:text-love"
          >
            Save
          </button>
        </form>
      </section>

      {topups.length > 0 && (
        <section className="mt-8">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-mute">
            Receipts
          </h2>
          <table className="mt-3 w-full font-mono text-sm">
            <tbody>
              {topups.map((t, i) => (
                <tr key={i} className="border-b border-line/50">
                  <td className="py-2 pr-3 text-mute">
                    {isoDay(t.created_at)}
                  </td>
                  <td className="py-2 pr-3">{String(t.tier)}</td>
                  <td className="tabular py-2 pr-3">
                    {formatCents(Number(t.gross_cents))}
                  </td>
                  <td className="tabular py-2 pr-3 text-mute">
                    +{Number(t.granted_cents)}¢
                  </td>
                  <td className="py-2 text-right text-mute">{String(t.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="mt-10 rounded-xl border border-dashed border-line p-5">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-mute">
          Refund
        </h2>
        <p className="mt-1.5 text-sm text-mute">
          Unspent balance back in full, no questions. Cents you already gave
          away stay given — they bought a pixel on somebody&apos;s wall.
        </p>
        <form action="/api/refund" method="post" className="mt-3">
          <button
            type="submit"
            disabled={user.centsBalance < 1}
            className="rounded-lg border border-line px-4 py-2 font-mono text-xs uppercase tracking-[0.14em] transition hover:border-love hover:text-love disabled:opacity-40"
          >
            Refund {user.centsBalance}¢
          </button>
        </form>
      </section>

      <div className="mt-10 flex items-center justify-between font-mono text-xs text-mute">
        <Link href="/new" className="underline underline-offset-4 hover:text-chalk">
          List your project →
        </Link>
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="underline underline-offset-4 hover:text-chalk">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-ink px-4 py-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">
        {label}
      </p>
      <p className={`tabular mt-1 font-mono text-2xl ${accent ? "text-love" : ""}`}>
        {value}
      </p>
    </div>
  );
}

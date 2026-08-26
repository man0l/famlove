import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { xConfigured } from "@/lib/x-oauth";
import { MIN_X_ACCOUNT_AGE_DAYS, TIERS } from "@/lib/config";
import { formatCents } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Get cents" };

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const user = await currentUser();
  if (user) redirect("/wallet");

  const query = await searchParams;
  const devLogin =
    process.env.ALLOW_DEV_LOGIN === "1" && process.env.NODE_ENV !== "production";

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">
        Two proofs, both required
      </h1>
      <p className="mt-3 text-mute">
        An X account at least {MIN_X_ACCOUNT_AGE_DAYS} days old with at least
        one post, and a card. Neither is enough on its own — that&apos;s the
        defence. A hundred fake backers means a hundred aged accounts and a
        hundred distinct cards, which is $300 and a bad afternoon.
      </p>

      {query.reason && (
        <p className="mt-5 rounded-xl border border-love/40 bg-love/5 px-4 py-3 font-mono text-sm text-love">
          {query.reason}
        </p>
      )}
      {query.error === "x_not_configured" && (
        <p className="mt-5 rounded-xl border border-line px-4 py-3 font-mono text-sm text-mute">
          X sign-in isn&apos;t configured on this deployment.
        </p>
      )}
      {query.error === "banned" && (
        <p className="mt-5 rounded-xl border border-line px-4 py-3 font-mono text-sm text-mute">
          That account is suspended.
        </p>
      )}
      {(query.error === "bad_state" || query.error === "x_failed") && (
        <p className="mt-5 rounded-xl border border-line px-4 py-3 font-mono text-sm text-mute">
          That sign-in didn&apos;t complete. Try again.
        </p>
      )}

      {xConfigured() ? (
        <a
          href="/api/auth/x"
          className="mt-7 block rounded-xl bg-love px-5 py-3.5 text-center font-mono text-sm font-semibold text-white transition hover:brightness-110"
        >
          Sign in with X
        </a>
      ) : (
        <p className="mt-7 rounded-xl border border-dashed border-line px-5 py-3.5 text-center font-mono text-sm text-mute">
          X sign-in isn&apos;t wired up here yet.
        </p>
      )}

      {devLogin && (
        <form
          action="/api/auth/dev"
          method="post"
          className="mt-4 rounded-xl border border-dashed border-line p-4"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">
            Local mode
          </p>
          <p className="mt-1.5 text-sm text-mute">
            No X keys on this machine. Sign in as a seeded handle to play with
            the real rules against the real database.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              name="handle"
              placeholder="handle"
              className="flex-1 rounded-lg border border-line bg-ink px-3 py-2 font-mono text-sm outline-none focus:border-love"
            />
            <button
              type="submit"
              className="rounded-lg border border-line px-4 py-2 font-mono text-xs uppercase tracking-[0.14em] transition hover:border-love hover:text-love"
            >
              Enter
            </button>
          </div>
        </form>
      )}

      <div className="mt-10 rounded-xl border border-line p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">
          Then a jar
        </p>
        <ul className="mt-3 space-y-2 font-mono text-sm">
          {TIERS.map((tier) => (
            <li key={tier.id} className="flex items-baseline justify-between">
              <span className={tier.featured ? "text-love" : ""}>
                {formatCents(tier.cents)}
              </span>
              <span className="tabular text-mute">
                {tier.grantedCents.toLocaleString()} cents
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 font-mono text-xs text-mute">
          You cannot charge a card one cent — the fixed fee alone would be
          2,502% of the sale. So the vote is never the transaction: you buy
          cents once, and every cent you spend after that is free.
        </p>
      </div>
    </div>
  );
}

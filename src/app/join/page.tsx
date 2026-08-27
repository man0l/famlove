import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { xConfigured } from "@/lib/x-oauth";
import { MIN_X_ACCOUNT_AGE_DAYS, TIERS } from "@/lib/config";
import { formatCents } from "@/lib/time";
import { Sticker } from "@/components/Sticker";
import { TrustRow } from "@/components/TrustRow";

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
  const anchor = TIERS[1];
  const next =
    typeof query.next === "string" && /^\/[a-zA-Z0-9/_-]*$/.test(query.next)
      ? query.next
      : null;

  return (
    <div className="mx-auto max-w-lg px-4 py-14">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="display text-4xl">
            Two proofs.
            <br />
            Both cheap.
          </h1>
          <p className="mt-3 text-mute">
            An X account {MIN_X_ACCOUNT_AGE_DAYS}+ days old, and a card. Neither
            counts on its own — that&apos;s the whole defence. Faking a hundred
            backers means a hundred aged accounts and a hundred different cards.
          </p>
        </div>
        <Sticker name="hands" size={80} float="slow" className="shrink-0" />
      </div>

      {query.reason && (
        <p className="mt-6 rounded-2xl border border-love/40 bg-love/10 px-4 py-3 text-sm text-love-soft">
          {query.reason}
        </p>
      )}
      {["x_not_configured", "banned", "bad_state", "x_failed", "cancelled"].includes(
        query.error ?? "",
      ) && (
        <p className="mt-6 rounded-2xl border border-line bg-ink-2 px-4 py-3 text-sm text-mute">
          {query.error === "banned"
            ? "That account is suspended."
            : query.error === "x_not_configured"
              ? "X sign-in isn't configured on this deployment."
              : query.error === "cancelled"
                ? "No problem — nothing happened."
                : "That sign-in didn't complete. Try again."}
        </p>
      )}

      {xConfigured() ? (
        <a
          href={`/api/auth/x${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="btn-love mt-8 block px-5 py-4 text-center font-semibold"
        >
          {next === "/new" ? "Sign in with X to list it" : "Sign in with X"}
        </a>
      ) : (
        <p className="mt-8 rounded-2xl border border-dashed border-line px-5 py-4 text-center text-sm text-mute">
          X sign-in isn&apos;t wired up here yet.
        </p>
      )}

      {devLogin && (
        <form
          action="/api/auth/dev"
          method="post"
          className="mt-4 rounded-[26px] border border-dashed border-line p-4"
        >
          <p className="text-sm font-medium">Local mode</p>
          <p className="mt-1 text-sm text-mute">
            No X keys on this machine. Sign in as any handle to play with the
            real rules against the real database.
          </p>
          <div className="mt-3 flex gap-2">
            <input type="hidden" name="next" value={next ?? "/wallet"} />
            <input
              name="handle"
              placeholder="handle"
              className="min-w-0 flex-1 rounded-full border border-line bg-ink px-4 py-2.5 text-sm outline-none focus:border-love"
            />
            <button
              type="submit"
              className="shrink-0 rounded-full border border-line px-4 py-2.5 text-sm font-medium transition hover:border-love hover:text-love"
            >
              Enter
            </button>
          </div>
        </form>
      )}

      <section className="card mt-10 p-5">
        <div className="flex items-start gap-4">
          <Sticker name="penny" size={52} className="shrink-0" />
          <div className="min-w-0">
            <h2 className="display text-xl">Then a jar of cents</h2>
            <p className="mt-1 text-sm text-mute">
              You can&apos;t charge a card one cent — the fixed fee alone would
              be 2,502% of the sale. So the vote is never the transaction: you
              buy cents once, and every one you spend after that is free.
            </p>
          </div>
        </div>

        <ul className="mt-4 space-y-1.5">
          {TIERS.map((tier) => (
            <li
              key={tier.id}
              className={`flex items-baseline justify-between rounded-2xl px-4 py-2.5 text-sm ${
                tier.featured ? "bg-love/10 text-love-soft" : "text-mute"
              }`}
            >
              <span className="tabular font-semibold">
                {formatCents(tier.cents)}
              </span>
              <span className="tabular">
                {tier.grantedCents.toLocaleString()} people you can back
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-3 text-xs text-mute">
          Most people never spend a whole {formatCents(anchor.cents)} jar. The
          rest sits there until you want it back.
        </p>
      </section>

      <div className="mt-6">
        <TrustRow />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Face } from "@/components/Face";
import { giversBoard } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Givers" };

export default async function GiversPage() {
  const board = await giversBoard(50);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Givers</h1>
      <p className="mt-2 max-w-2xl text-mute">
        Loves given in the last 7 days. It costs about a dollar a week to be the
        most generous person here — which is the point. Every profile shows the
        ratio, so people who only receive look exactly like what they are.
      </p>

      <section className="mt-8 rounded-xl border border-line bg-ink-2/40">
        {board.length === 0 ? (
          <p className="px-4 py-16 text-center font-mono text-sm text-mute">
            Nobody has given anything this week.
          </p>
        ) : (
          <ol>
            {board.map((giver) => (
              <li
                key={giver.handle}
                className="border-b border-line/60 transition last:border-0 hover:bg-ink-2"
              >
                <Link
                  href={`/u/${giver.handle}`}
                  className="flex items-center gap-4 px-4 py-3"
                >
                  <span
                    className={`tabular w-10 shrink-0 font-mono text-lg ${
                      giver.rank <= 3 ? "text-gold" : "text-mute"
                    }`}
                  >
                    {giver.rank}
                  </span>
                  <Face
                    handle={giver.handle}
                    avatarUrl={giver.avatarUrl}
                    size={34}
                    linked={false}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {giver.displayName || `@${giver.handle}`}
                    </span>
                    <span className="block font-mono text-[11px] text-mute">
                      @{giver.handle}
                    </span>
                  </span>
                  <span className="tabular hidden w-32 shrink-0 text-right font-mono text-xs text-mute sm:block">
                    gave {giver.given} · got {giver.received}
                  </span>
                  <span className="w-16 shrink-0 text-right">
                    <span className="tabular block font-mono text-lg">
                      {giver.given}
                    </span>
                    <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-mute">
                      given
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

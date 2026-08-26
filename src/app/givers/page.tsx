import type { Metadata } from "next";
import Link from "next/link";
import { Face } from "@/components/Face";
import { giversBoard } from "@/lib/queries";
import { Sticker } from "@/components/Sticker";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Givers" };

export default async function GiversPage() {
  const board = await giversBoard(50);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex items-start justify-between gap-4">
        <h1 className="display text-4xl">Givers</h1>
        <Sticker name="hands" size={68} float="slower" className="shrink-0" />
      </div>
      <p className="mt-3 max-w-2xl text-mute">
        Loves given in the last 7 days. It costs about a dollar a week to be the
        most generous person here — which is the point. Every profile shows the
        ratio, so people who only receive look exactly like what they are.
      </p>

      <section className="card mt-8 overflow-hidden">
        {board.length === 0 ? (
          <p className="px-4 py-16 text-center text-mute">
            Nobody has given anything this week.
          </p>
        ) : (
          <ol>
            {board.map((giver) => (
              <li
                key={giver.handle}
                className="border-b border-line/50 transition last:border-0 hover:bg-ink-2/80"
              >
                <Link
                  href={`/u/${giver.handle}`}
                  className="flex items-center gap-3 px-3 py-3 sm:gap-4 sm:px-5"
                >
                  <span
                    className={`tabular display grid h-9 w-9 shrink-0 place-items-center rounded-full text-base ${
                      giver.rank <= 3
                        ? "bg-lime text-ink"
                        : "border border-line bg-ink-2 text-mute"
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
                    <span className="block truncate font-semibold">
                      {giver.displayName || `@${giver.handle}`}
                    </span>
                    <span className="block text-xs text-mute">
                      @{giver.handle}
                    </span>
                  </span>
                  <span className="tabular hidden w-32 shrink-0 text-right text-xs text-mute sm:block">
                    gave {giver.given} · got {giver.received}
                  </span>
                  <span className="w-16 shrink-0 text-right">
                    <span className="tabular display block text-xl text-lime">
                      {giver.given}
                    </span>
                    <span className="block text-[11px] text-mute">given</span>
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

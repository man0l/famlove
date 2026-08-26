import type { Metadata } from "next";
import { BoardRow } from "@/components/BoardRow";
import { risingBoard } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rising" };

export default async function RisingPage() {
  const board = await risingBoard(50);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Rising</h1>
      <p className="mt-2 max-w-2xl text-mute">
        Today&apos;s backers divided by this project&apos;s own 7-day average.
        This is the board that stops famlove decaying into a follower-count
        mirror: six people on a project that normally gets one beats forty on a
        project that always gets forty.
      </p>
      <p className="mt-2 font-mono text-xs text-mute">
        Resets 00:00 UTC · needs 3+ backers today to appear
      </p>

      <section className="mt-8 rounded-xl border border-line bg-ink-2/40">
        {board.length === 0 ? (
          <p className="px-4 py-16 text-center font-mono text-sm text-mute">
            Nothing has taken off yet today. Check back after a few walls fill.
          </p>
        ) : (
          <ol>
            {board.map((entry) => (
              <BoardRow
                key={entry.projectId}
                entry={entry}
                metric={`${entry.multiplier.toFixed(1)}×`}
                metricLabel={`${entry.backersToday} today`}
              />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import { BoardRow } from "@/components/BoardRow";
import { risingBoard } from "@/lib/queries";
import { Sticker } from "@/components/Sticker";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rising" };

export default async function RisingPage() {
  const board = await risingBoard(50);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex items-start justify-between gap-4">
        <h1 className="display text-4xl">Rising</h1>
        <Sticker name="sparkle" size={64} float="slow" className="shrink-0" />
      </div>
      <p className="mt-3 max-w-2xl text-mute">
        Today&apos;s backers divided by this project&apos;s own 7-day average.
        This is the board that stops famlove decaying into a follower-count
        mirror: six people on a project that normally gets one beats forty on a
        project that always gets forty.
      </p>
      <p className="mt-2 text-xs text-mute">
        Resets 00:00 UTC · needs 3+ people today to appear
      </p>

      <section className="card mt-8 overflow-hidden">
        {board.length === 0 ? (
          <p className="px-4 py-16 text-center text-mute">
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

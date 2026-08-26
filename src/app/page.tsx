import Link from "next/link";
import { BoardRow } from "@/components/BoardRow";
import { lovedBoard, siteStats } from "@/lib/queries";
import { currentUser } from "@/lib/session";
import { TIERS } from "@/lib/config";
import { formatCents } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [board, stats, user] = await Promise.all([
    lovedBoard(50),
    siteStats(),
    currentUser(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4">
      <section className="pt-14 pb-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-love">
          You can&apos;t buy the top
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl leading-[1.08] font-semibold tracking-tight sm:text-5xl">
          Rank is not dollars. It&apos;s how many separate humans spent one cent
          on you today.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-mute">
          One cent each. Hard capped at one per person, per project, per day.
          No stacking, no whales, no $17,000 slot. What you buy for your cent is
          a pixel with your face on it, on somebody else&apos;s wall.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          {user ? (
            <Link
              href="/wallet"
              className="rounded-full bg-love px-5 py-2.5 font-mono text-sm font-semibold text-white transition hover:brightness-110"
            >
              {user.centsBalance}¢ in your jar →
            </Link>
          ) : (
            <Link
              href="/join"
              className="rounded-full bg-love px-5 py-2.5 font-mono text-sm font-semibold text-white transition hover:brightness-110"
            >
              Get {TIERS[1].grantedCents} cents · {formatCents(TIERS[1].cents)}
            </Link>
          )}
          <Link
            href="/cents"
            className="rounded-full border border-line px-5 py-2.5 font-mono text-sm text-mute transition hover:border-mute hover:text-chalk"
          >
            Where every cent goes
          </Link>
        </div>

        <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
          <Stat label="Projects" value={stats.projects} />
          <Stat label="People" value={stats.people} />
          <Stat label="Cents today" value={stats.lovesToday} />
          <Stat label="Cents this week" value={stats.loves7d} />
        </dl>
      </section>

      <section className="rounded-xl border border-line bg-ink-2/40">
        <header className="flex items-baseline justify-between border-b border-line px-4 py-3.5">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em]">
            Loved <span className="text-mute">· distinct backers, 7 days</span>
          </h2>
          <p className="font-mono text-[11px] text-mute">
            ties break on the most recent cent
          </p>
        </header>

        {board.length === 0 ? (
          <Empty />
        ) : (
          <ol>
            {board.map((entry) => (
              <BoardRow key={entry.projectId} entry={entry} />
            ))}
          </ol>
        )}
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        <Rule
          title="The unit"
          body="1 cent = 1 love. Never bundles, never multipliers, never a bonus tier. A cent must always be a cent."
        />
        <Rule
          title="The cap"
          body="One love per wallet, per project, per UTC day — enforced by a unique index, not by app logic."
        />
        <Rule
          title="The ceiling"
          body="60 loves per wallet per day, so nobody can spray-bot their way to the top of Givers."
        />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-ink px-4 py-4">
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">
        {label}
      </dt>
      <dd className="tabular mt-1 font-mono text-2xl">{value.toLocaleString()}</dd>
    </div>
  );
}

function Rule({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-line p-4">
      <h3 className="font-mono text-xs uppercase tracking-[0.16em] text-love">
        {title}
      </h3>
      <p className="mt-2 text-sm text-mute">{body}</p>
    </div>
  );
}

function Empty() {
  return (
    <div className="px-4 py-16 text-center">
      <p className="font-mono text-sm text-mute">
        Nobody has shown up yet today.
      </p>
      <Link
        href="/new"
        className="mt-3 inline-block font-mono text-sm text-love underline underline-offset-4"
      >
        List a project →
      </Link>
    </div>
  );
}

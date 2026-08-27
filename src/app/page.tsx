import Link from "next/link";
import { BoardRow } from "@/components/BoardRow";
import { Sticker } from "@/components/Sticker";
import { lovedBoard, siteStats } from "@/lib/queries";
import { currentUser } from "@/lib/session";
import { sql } from "@/lib/db";
import { ENTRY_TIER } from "@/lib/config";
import { formatCents } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [board, stats, user] = await Promise.all([
    lovedBoard(50),
    siteStats(),
    currentUser(),
  ]);

  // The secondary CTA quotes the entry price, not the recommended one: it is
  // an aside next to "list your project", and $3 is a smaller thing to weigh
  // up mid-thought than $10.
  const anchor = ENTRY_TIER;

  // Does the visitor already have a wall of their own? Decides whether the
  // hero asks them to list, or shows them the thing they came back to see.
  const mine = user
    ? ((await sql`
        SELECT slug FROM projects
        WHERE owner_id = ${user.id} AND removed_at IS NULL ORDER BY id
      `) as { slug: string }[])
    : [];
  const listedSomething = mine.length > 0;

  /*
   * The card a builder gets to post — showing a real one beats describing it.
   *
   * It is pinned to one project rather than picked from the board. The hero's
   * whole job is "list your thing", and a card that changes identity between
   * visits reads as a screenshot of somebody else's product; the same card,
   * every time, reads as the thing you are about to get. The fallback keeps
   * the old behaviour — the liveliest wall, not simply rank #1, because the
   * top project can be having a quiet morning and an example card with one
   * face on it argues against listing rather than for it.
   */
  const SHOWCASE_SLUG = "slashloop-dev";
  /*
   * Pinned by a direct read, not by finding it in the board. The board holds
   * only the top 50 by 7-day backers, so `board.find` would quietly return
   * nothing the day slashloop slips to 51st — and the hero would swap to some
   * other project without anyone noticing. A direct lookup keeps the example
   * fixed regardless of where it ranks. The board fallbacks stay for the case
   * where the pinned project has been removed entirely.
   */
  const [pinned] = (await sql`
    SELECT p.slug, p.name,
           COUNT(DISTINCT l.from_user_id)::int AS backers
    FROM projects p
    LEFT JOIN loves l
      ON l.project_id = p.id
     AND l.day_utc >= (now() AT TIME ZONE 'utc')::date - 6
    WHERE p.slug = ${SHOWCASE_SLUG} AND p.removed_at IS NULL
    GROUP BY p.slug, p.name
  `) as { slug: string; name: string; backers: number }[];
  const showcase =
    pinned ??
    [...board].sort((a, b) => b.backersToday - a.backersToday)[0] ??
    board[0];

  return (
    <div className="mx-auto max-w-5xl px-4">
      <section className="pt-12 pb-12 sm:pt-16">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full border border-love/30 bg-love/10 px-3.5 py-1.5 text-sm font-medium text-love-soft">
              <Sticker name="heart" size={16} />
              Free to list · 30 seconds
            </p>

            {/*
              The original thesis line, restored. It earns the top of the page
              because it states the whole mechanic in one breath — and the
              mechanic *is* the pitch. Everything under it was doing the same
              job a second time, so it is gone.
            */}
            <h1 className="display mt-5 text-[2.6rem] sm:text-[3.4rem]">
              Rank isn&apos;t dollars. It&apos;s how many people spent a cent on
              you today.
            </h1>

            <p className="mt-5 max-w-lg text-lg leading-relaxed text-mute">
              List your SaaS or app and get a wall of everyone who showed up.
              One cent each, capped at one per person a day — so{" "}
              <span className="text-chalk">nobody can buy their way past you.</span>
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {mine.length > 0 ? (
                <Link
                  href={mine.length === 1 ? `/p/${mine[0].slug}` : `/u/${user!.handle}`}
                  className="btn-love px-6 py-3.5 font-semibold"
                >
                  {mine.length === 1 ? "See your wall →" : "See your walls →"}
                </Link>
              ) : (
                <Link href="/new" className="btn-love px-6 py-3.5 font-semibold">
                  List your project →
                </Link>
              )}
              <Link
                href={user ? "/wallet" : "/join?next=%2Fwallet"}
                className="rounded-full border border-line px-5 py-3.5 font-medium text-mute transition hover:border-line-2 hover:text-chalk"
              >
                {user
                  ? `${user.centsBalance}¢ in your jar`
                  : `Back someone else · ${formatCents(anchor.cents)}`}
              </Link>
            </div>

            {/* Having one project used to remove every route to listing a
                second — the primary button simply swapped meaning. Anyone
                still on zero is already looking at "List your project". */}
            {listedSomething && (
              <p className="mt-4 text-sm text-mute">
                Shipped something else?{" "}
                <Link href="/new" className="font-medium text-love">
                  List another →
                </Link>
              </p>
            )}
          </div>

          {/*
            The reason a builder lists is that they get something to post, so
            show the artifact rather than describing it. This is the permanent
            example endpoint, not the live share card: it draws slashloop from
            its all-time wall, so the faces never age out of a rolling window
            and the hero always has a full crowd on it. Pinned to one project
            so the example does not change identity between visits.
          */}
          {showcase && (
            <figure className="min-w-0">
              <div className="overflow-hidden rounded-[22px] border border-line bg-ink-2 shadow-[0_24px_70px_-30px_rgba(255,61,104,0.55)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/api/example-card"
                  alt={`The share card for ${showcase.name}: ${showcase.backers} people showed up`}
                  width={1200}
                  height={630}
                  className="block w-full"
                />
              </div>
              <figcaption className="mt-3 text-center text-sm text-mute">
                The card you post —{" "}
                <Link href={`/p/${showcase.slug}`} className="text-chalk hover:text-love">
                  {showcase.name}
                </Link>
                &apos;s.
              </figcaption>
            </figure>
          )}
        </div>

        <dl className="mt-10 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Projects" value={stats.projects} />
          <Stat label="People" value={stats.people} tint="sky" />
          <Stat label="Cents today" value={stats.lovesToday} tint="love" />
          <Stat label="This week" value={stats.loves7d} tint="lime" />
        </dl>
      </section>

      <section className="card overflow-hidden">
        <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line/70 px-5 py-4">
          <h2 className="display text-xl">
            Loved <span className="text-mute">· this week</span>
          </h2>
          <p className="text-xs text-mute">
            ranked by <span className="text-chalk">separate humans</span>, never
            by cents · ties break on the most recent one
          </p>
        </header>

        {board.length === 0 ? <Empty /> : (
          <ol>
            {board.map((entry) => (
              <BoardRow key={entry.projectId} entry={entry} />
            ))}
          </ol>
        )}
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <Rule
          sticker="penny"
          title="A cent is a cent"
          body="Never bundles, never multipliers, never a bonus tier. $30 buys 3,000¢, not 3,600¢."
        />
        <Rule
          sticker="heart"
          title="One each, per day"
          body="Enforced by a unique index in the database, not by a rule we promise to follow."
        />
        <Rule
          sticker="sparkle"
          title="60 a day, max"
          body="Nobody can spray-bot their way to the top of Givers. Not even you."
        />
      </section>
    </div>
  );
}

const TINTS = {
  love: "text-love",
  lime: "text-lime",
  sky: "text-sky",
  none: "text-chalk",
} as const;

function Stat({
  label,
  value,
  tint = "none",
}: {
  label: string;
  value: number;
  tint?: keyof typeof TINTS;
}) {
  return (
    <div className="card px-4 py-4">
      <dt className="text-xs font-medium text-mute">{label}</dt>
      <dd className={`tabular display mt-1 text-3xl ${TINTS[tint]}`}>
        {value.toLocaleString()}
      </dd>
    </div>
  );
}

function Rule({
  sticker,
  title,
  body,
}: {
  sticker: "penny" | "heart" | "sparkle";
  title: string;
  body: string;
}) {
  return (
    <div className="card card-hover p-5">
      <Sticker name={sticker} size={40} />
      <h3 className="display mt-3 text-lg">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-mute">{body}</p>
    </div>
  );
}

function Empty() {
  return (
    <div className="px-4 py-14 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/stickers/empty-wall.webp"
        alt=""
        aria-hidden="true"
        width={420}
        height={280}
        className="mx-auto w-full max-w-[420px] rounded-3xl"
      />
      <p className="display mt-5 text-2xl">Nobody has shown up yet</p>
      <p className="mt-1.5 text-mute">Every wall starts empty. Yours too.</p>
      <Link href="/new" className="btn-love mt-5 inline-block px-6 py-3 font-semibold">
        List a project
      </Link>
    </div>
  );
}

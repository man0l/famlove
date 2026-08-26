import Link from "next/link";
import { BoardRow } from "@/components/BoardRow";
import { Sticker } from "@/components/Sticker";
import { TrustRow } from "@/components/TrustRow";
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

  const anchor = TIERS[1];

  return (
    <div className="mx-auto max-w-5xl px-4">
      <section className="pt-12 pb-12 sm:pt-16">
        <div className="grid items-start gap-8 lg:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full border border-love/30 bg-love/10 px-3.5 py-1.5 text-sm font-medium text-love-soft">
              <Sticker name="heart" size={16} />
              You can&apos;t buy the top
            </p>

            <h1 className="display mt-5 text-[2.6rem] sm:text-6xl">
              Rank isn&apos;t dollars.
              <br />
              It&apos;s <span className="text-love">how many people</span> spent
              a cent on you today.
            </h1>

            <p className="mt-5 max-w-xl text-lg leading-relaxed text-mute">
              One cent each. Capped at one per person, per project, per day — so
              nobody can buy their way up, and{" "}
              <span className="text-chalk">nobody can outspend you.</span> What a
              cent buys is your face on somebody else&apos;s wall.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {user ? (
                <Link href="/wallet" className="btn-love px-6 py-3.5 font-semibold">
                  {user.centsBalance}¢ in your jar →
                </Link>
              ) : (
                <Link href="/join" className="btn-love px-6 py-3.5 font-semibold">
                  Get {anchor.grantedCents.toLocaleString()} cents ·{" "}
                  {formatCents(anchor.cents)}
                </Link>
              )}
              <Link
                href="/cents"
                className="rounded-full border border-line px-5 py-3.5 font-medium text-mute transition hover:border-line-2 hover:text-chalk"
              >
                Where every cent goes
              </Link>
            </div>

            {/*
              The reassurance sits with the button, not three screens down in a
              FAQ. The moment someone considers paying is the moment they need it.
            */}
            <div className="mt-4">
              <TrustRow compact />
            </div>
          </div>

          {/* Decoration only. Nothing here states a fact. */}
          <div
            aria-hidden="true"
            className="relative hidden h-64 w-56 shrink-0 lg:block"
          >
            <Sticker
              name="penny"
              size={132}
              float="slow"
              className="absolute right-4 top-2"
            />
            <Sticker
              name="sparkle"
              size={68}
              float="slower"
              className="absolute left-0 top-28"
            />
            <Sticker
              name="hands"
              size={92}
              float="slow"
              className="absolute bottom-2 right-10"
            />
          </div>
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

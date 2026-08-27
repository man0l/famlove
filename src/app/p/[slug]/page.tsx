import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Face } from "@/components/Face";
import { GiveButton } from "@/components/GiveButton";
import { RallyBar } from "@/components/RallyBar";
import { projectPage } from "@/lib/queries";
import { currentUser } from "@/lib/session";
import { RALLY_MIN_GOAL, SITE_URL } from "@/lib/config";
import { Sticker } from "@/components/Sticker";
import { XIcon } from "@/components/XIcon";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string>> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const page = await projectPage(slug, null);
  if (!page) return { title: "Not found" };

  const title = `${page.project.name} · ${page.backersToday} showed up today`;
  return {
    title: page.project.name,
    description: page.project.tagline,
    openGraph: {
      title,
      description: page.project.tagline,
      url: `${SITE_URL}/p/${slug}`,
    },
    twitter: { card: "summary_large_image", title, description: page.project.tagline },
  };
}

export default async function ProjectPage({ params, searchParams }: Params) {
  const { slug } = await params;
  const query = await searchParams;
  const user = await currentUser();
  const page = await projectPage(slug, user?.id ?? null);
  if (!page) notFound();

  const { project, rally } = page;
  const isOwner = user?.id === project.ownerId;
  const shareText = encodeURIComponent(
    `${page.backersToday} people spent a cent on ${project.name} today. Not one of them could spend two.\n\n${SITE_URL}/p/${slug}`,
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="flex items-start gap-4">
            <span
              className={`tabular display grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-xl ${
                page.rank && page.rank <= 3
                  ? "bg-love text-white"
                  : "border border-line bg-ink-2 text-mute"
              }`}
            >
              {page.rank ? `#${page.rank}` : "—"}
            </span>
            <div className="min-w-0">
              <h1 className="display text-4xl">{project.name}</h1>
              <p className="mt-1.5 text-mute">{project.tagline}</p>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-mute">
                <Link href={`/u/${project.ownerHandle}`} className="hover:text-chalk">
                  @{project.ownerHandle}
                </Link>
                <span className="text-line">·</span>
                <a
                  href={project.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="truncate hover:text-chalk"
                >
                  {new URL(project.url).hostname}
                </a>
              </p>
            </div>
          </div>

          <section className="card mt-8 p-5">
            <header className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="display text-2xl">Showed up today</h2>
              <p className="tabular text-sm text-mute">
                {page.backersToday} {page.backersToday === 1 ? "person" : "people"}
                {" · "}
                {page.backersToday}¢
                {page.streakDays > 0 && ` · streak ${page.streakDays}d`}
              </p>
            </header>

            {page.wallToday.length === 0 ? (
              <div className="py-10 text-center">
                <Sticker name="hands" size={72} className="mx-auto" />
                <p className="mt-3 text-mute">
                  Nobody yet today. Be the first face on this wall.
                </p>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                {page.wallToday.map((face) => (
                  <Face
                    key={face.handle}
                    handle={face.handle}
                    avatarUrl={face.avatarUrl}
                    size={44}
                    landing
                  />
                ))}
              </div>
            )}

            <p className="mt-5 text-xs leading-relaxed text-mute">
              Every avatar is a real X account that spent a cent on this project
              today.{" "}
              <span className="text-chalk">Not one of them could spend two.</span>
            </p>
          </section>

          {page.wall7d.length > page.wallToday.length && (
            <section className="card mt-4 p-5">
              <h2 className="text-sm font-medium text-mute">
                This week · {page.backers7d} people
              </h2>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {page.wall7d.map((face) => (
                  <Face
                    key={face.handle}
                    handle={face.handle}
                    avatarUrl={face.avatarUrl}
                    size={28}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <GiveButton
            slug={slug}
            projectName={project.name}
            ownerHandle={project.ownerHandle}
            viewerHandle={user?.handle ?? null}
            viewerBalance={user?.centsBalance ?? 0}
            lovedToday={page.viewerLovedToday}
            isOwner={Boolean(isOwner)}
            signedIn={Boolean(user)}
            rank={page.rank}
            projectUrl={`${SITE_URL}/p/${slug}`}
          />

          {rally && (
            <RallyBar goal={rally.goal} progress={rally.progress} endsAt={rally.endsAt} />
          )}

          {isOwner && !rally && (
            <form
              action="/api/rally"
              method="post"
              className="rounded-[26px] border border-dashed border-line p-4"
            >
              <p className="display text-lg">Start a rally</p>
              <p className="mt-1.5 text-sm text-mute">
                24 hours, one stated goal, a live counter. One per project per
                week — it&apos;s the only escalation this design allows.
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  type="number"
                  name="goal"
                  min={RALLY_MIN_GOAL}
                  max={500}
                  defaultValue={50}
                  className="tabular w-20 rounded-full border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-love"
                />
                <button
                  type="submit"
                  className="flex-1 rounded-full border border-line px-3 py-2 text-sm font-medium transition hover:border-love hover:text-love"
                >
                  Start
                </button>
              </div>
              {query.rally_error && (
                <p className="mt-2 text-xs text-love">{query.rally_error}</p>
              )}
            </form>
          )}

          <dl className="grid grid-cols-3 gap-2">
            <Cell label="Today" value={page.backersToday} />
            <Cell label="7 days" value={page.backers7d} />
            <Cell label="All time" value={page.backersAllTime} />
          </dl>

          {/*
            The one question a first-time buyer actually has, answered where
            they are about to answer it — not in a FAQ two clicks away.
          */}
          <div className="card p-5">
            <div className="flex items-start gap-3">
              <Sticker name="penny" size={44} className="shrink-0" />
              <div className="min-w-0">
                <h2 className="display text-lg">What a cent buys</h2>
                <p className="mt-1 text-sm leading-relaxed text-mute">
                  Your avatar on this wall, dated today. The cent stays with
                  famlove — it never reaches{" "}
                  <span className="text-chalk">@{project.ownerHandle}</span>,
                  which is exactly why this isn&apos;t a tip.
                </p>
              </div>
            </div>
            <ul className="mt-4 space-y-1.5 text-sm text-mute">
              <li>· One a day here. You cannot spend two.</li>
              <li>· No subscription, nothing renews.</li>
              <li>· Unspent cents refundable in one click.</li>
            </ul>
          </div>

          <a
            href={`https://x.com/intent/post?text=${shareText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-full border border-line px-4 py-3 text-sm font-medium text-mute transition hover:border-line-2 hover:text-chalk"
          >
            <XIcon size={13} />
            Post the wall
          </a>
        </aside>
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: number }) {
  return (
    <div className="card px-3 py-3 text-center">
      <dt className="text-[11px] text-mute">{label}</dt>
      <dd className="tabular display mt-0.5 text-xl">{value}</dd>
    </div>
  );
}

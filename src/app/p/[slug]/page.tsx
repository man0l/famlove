import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Face } from "@/components/Face";
import { GiveButton } from "@/components/GiveButton";
import { RallyBar } from "@/components/RallyBar";
import { projectPage } from "@/lib/queries";
import { currentUser } from "@/lib/session";
import { sql } from "@/lib/db";
import { RALLY_MIN_GOAL, SITE_URL } from "@/lib/config";
import { Sticker } from "@/components/Sticker";
import { XIcon } from "@/components/XIcon";
import { ProjectMark } from "@/components/ProjectMark";
import { plural } from "@/lib/time";
import { ownerMention, possessive } from "@/lib/mention";
import { ListedBanner } from "@/components/ListedBanner";
import { EmailPrompt } from "@/components/EmailPrompt";

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
  // Tagging the owner is what closes the loop — a post that names them but
  // doesn't notify them reaches everyone except the one person it's about.
  // `ownerTag` is whether this owner can be tagged at all; `mention` is
  // whether *this* viewer's post should, since owners don't tag themselves.
  const ownerTag = ownerMention(project.ownerHandle, {
    isSeed: project.ownerIsSeed,
    viewerIsOwner: false,
  });
  const mention = isOwner ? null : ownerTag;
  const subject = possessive(mention, project.name);
  const shareText = encodeURIComponent(
    // An empty wall has nothing to boast about, and tagging someone into
    // "0 people showed up for you today" is worse than not posting at all.
    // So a bare wall shares as an ask instead of a count.
    (page.backersToday === 0
      ? `${subject} is on famlove.lol and nobody has shown up today. It costs a cent, capped at one per person a day — you can't buy your way up there, you can only be shown up for.`
      : `${plural(page.backersToday, "person", "people")} spent a cent on ${subject} today. Not one of them could spend two.`) +
      `\n\n${SITE_URL}/p/${slug}`,
  );

  const justListed = query.listed === "1" && isOwner;

  // What else this owner has here. Listing is uncapped, so the sidebar shows
  // a window and sends them to their profile for the rest — a card that grows
  // without limit is a card that eventually eats the page.
  const owned = isOwner
    ? ((await sql`
        SELECT slug, name FROM projects
        WHERE owner_id = ${user!.id} AND removed_at IS NULL ORDER BY id
      `) as { slug: string; name: string }[])
    : [];
  const OWNED_SHOWN = 6;
  // Always keep the one being viewed in the window, even if it sorts past it.
  const ownedShown = owned
    .slice(0, OWNED_SHOWN)
    .concat(
      owned.findIndex((o) => o.slug === slug) >= OWNED_SHOWN
        ? [owned.find((o) => o.slug === slug)!]
        : [],
    );

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {query.saved === "1" && (
        <p className="mb-6 rounded-2xl border border-lime/40 bg-lime/10 px-4 py-3 text-sm text-lime">
          Saved. You&apos;ll hear the next time somebody shows up.
        </p>
      )}

      {justListed && (
        <ListedBanner
          projectName={project.name}
          projectUrl={`${SITE_URL}/p/${slug}`}
        />
      )}

      {/*
        Explicit placement rather than source order, because the two differ.
        On a phone this stacks header → the button → the wall → everything
        else, so the thing you came to do is above the fold. On a wide screen
        the same four blocks form two columns, and the aside content rejoins
        under the button where it belongs.
      */}
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="lg:col-start-1 lg:row-start-1">
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
              <h1 className="display flex items-center gap-3 text-4xl">
                <ProjectMark
                  favicon={project.faviconUrl}
                  name={project.name}
                  size={38}
                />
                <span className="min-w-0 truncate">{project.name}</span>
              </h1>
              <p className="mt-1.5 text-mute">{project.tagline}</p>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-mute">
                <Link href={`/u/${project.ownerHandle}`} className="hover:text-chalk">
                  @{project.ownerHandle}
                </Link>
                <span className="text-line">·</span>
                {/* Through /go so the visit is counted — the counter cannot
                    see a link that points straight at somebody else's domain. */}
                <a
                  href={`/go/${slug}`}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="truncate hover:text-chalk"
                >
                  {new URL(project.url).hostname}
                </a>
                {project.clicks > 0 && (
                  <>
                    <span className="text-line">·</span>
                    <span className="tabular">
                      {plural(project.clicks, "click")}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {/*
          Not sticky, deliberately.

          This block used to carry `lg:sticky lg:top-20`. A sticky grid item is
          only held inside its own grid area in theory; in practice it pinned
          at the top of the viewport and kept floating there while the sidebar
          in row 2 scrolled underneath, so the give button drew straight on top
          of the rally box — 74px of overlapping text, reproduced at scrollY
          200. Two paragraphs printed over each other is a far worse trade than
          a button that scrolls away like everything else.
        */}
        <div className="lg:col-start-2 lg:row-start-1 lg:self-start">
          <GiveButton
            slug={slug}
            projectName={project.name}
            ownerHandle={project.ownerHandle}
            ownerTag={ownerTag}
            viewerHandle={user?.handle ?? null}
            viewerBalance={user?.centsBalance ?? 0}
            lovedToday={page.viewerLovedToday}
            isOwner={Boolean(isOwner)}
            signedIn={Boolean(user)}
            rank={page.rank}
            projectUrl={`${SITE_URL}/p/${slug}`}
            autoLoves={page.viewerAutoLoves}
          />

          {/* Owners with no address never learn the digest exists. */}
          {isOwner && !user?.email && (
            <div className="mt-4">
              <EmailPrompt next={`/p/${slug}`} projectName={project.name} />
            </div>
          )}

          {rally && (
            <div className="mt-4">
              <RallyBar
                goal={rally.goal}
                progress={rally.progress}
                endsAt={rally.endsAt}
              />
            </div>
          )}
        </div>

        <div className="lg:col-start-1 lg:row-start-2">
          <section className="card p-5">
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
                {/* The owner cannot be the first face — they are barred from
                    their own wall — so telling them to be it is useless. */}
                <p className="mt-3 text-mute">
                  {isOwner
                    ? "Nobody yet today. Send someone the link — you can't fill this one yourself."
                    : "Nobody yet today. Be the first face on this wall."}
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

        <aside className="space-y-4 lg:col-start-2 lg:row-start-2">

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

          {isOwner && (
            <div className="card p-5">
              <p className="text-xs font-medium text-mute">
                {owned.length === 1 ? "Your project" : "Your projects"}
              </p>
              <ul className="mt-2 space-y-1">
                {ownedShown.map((other) => (
                  <li key={other.slug}>
                    <Link
                      href={`/p/${other.slug}`}
                      className={`block truncate text-sm transition hover:text-love ${
                        other.slug === slug ? "font-semibold text-chalk" : "text-mute"
                      }`}
                    >
                      {other.slug === slug ? "› " : "  "}
                      {other.name}
                    </Link>
                  </li>
                ))}
              </ul>
              {owned.length > ownedShown.length && (
                <Link
                  href={`/u/${user!.handle}`}
                  className="mt-2 block text-sm text-mute transition hover:text-love"
                >
                  All {owned.length} →
                </Link>
              )}
              <Link
                href="/new"
                className="mt-3 block rounded-full border border-dashed border-line-2 px-4 py-2 text-center text-sm font-medium text-mute transition hover:border-love hover:text-love"
              >
                List another
              </Link>
            </div>
          )}

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

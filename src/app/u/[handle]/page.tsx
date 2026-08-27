import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Face } from "@/components/Face";
import { profilePage } from "@/lib/queries";
import { currentUser } from "@/lib/session";
import { ProjectMark } from "@/components/ProjectMark";
import { Sticker } from "@/components/Sticker";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle } = await params;
  return { title: `@${handle}` };
}

export default async function ProfilePage({ params }: Params) {
  const { handle } = await params;
  const viewer = await currentUser();
  const page = await profilePage(handle, viewer?.id ?? null);
  if (!page) notFound();

  const isMe = viewer?.handle.toLowerCase() === page.handle.toLowerCase();

  const ratio =
    page.received === 0 ? page.gave : Math.round((page.gave / page.received) * 10) / 10;
  const generous = page.gave >= page.received;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <header className="flex items-start gap-4">
        <Face handle={page.handle} avatarUrl={page.avatarUrl} size={72} />
        <div className="min-w-0">
          <h1 className="display text-3xl">
            {page.displayName || `@${page.handle}`}
          </h1>
          <p className="text-sm text-mute">@{page.handle}</p>
          {page.giveStreak > 0 && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-love/40 bg-love/10 px-3 py-1 text-sm font-medium text-love">
              <Sticker name="heart" size={14} />
              {page.giveStreak}-day giving streak
            </p>
          )}
        </div>
      </header>

      {/*
        The public ledger is the substitute for outbid's sunk-cost defence.
        Nobody writes an ROI thread about a cent — but people do defend a
        41-day streak and a ratio that says they give more than they take.
      */}
      <section className="card mt-8 p-5">
        <p className="text-xs font-medium text-mute">Public ledger</p>
        <p className="display mt-2 text-3xl">
          <span className="tabular text-lime">gave {page.gave}</span>
          <span className="mx-3 text-line-2">·</span>
          <span className="tabular text-chalk">got {page.received}</span>
        </p>
        <p className="mt-2 text-sm text-mute">
          {generous
            ? `Gives ${ratio}× what they take. That's the whole status game here.`
            : "Receives more than they give. Everyone can see that."}
        </p>
      </section>

      {page.projects.length > 0 && (
        <section className="card mt-4 p-5">
          <p className="text-xs font-medium text-mute">
            {isMe
              ? page.projects.length === 1
                ? "Your project"
                : "Your projects"
              : page.projects.length === 1
                ? "Their project"
                : "Their projects"}
          </p>
          <ul className="mt-2 space-y-3">
            {page.projects.map((project) => (
              <li key={project.slug}>
                <Link
                  href={`/p/${project.slug}`}
                  className="flex items-center justify-between gap-4 transition hover:text-love"
                >
                  <ProjectMark
                    favicon={project.faviconUrl}
                    name={project.name}
                    size={34}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="display block text-xl">{project.name}</span>
                    <span className="block truncate text-sm text-mute">
                      {project.tagline}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-sm text-mute">
                    {project.backers7d} this week
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {isMe && (
            <Link
              href="/new"
              className="mt-4 block rounded-full border border-dashed border-line-2 px-4 py-2.5 text-center text-sm font-medium text-mute transition hover:border-love hover:text-love"
            >
              List another
            </Link>
          )}
        </section>
      )}

      {isMe && page.projects.length === 0 && (
        <section className="card mt-4 p-5 text-center">
          <p className="text-sm text-mute">You haven&apos;t listed anything yet.</p>
          <Link href="/new" className="btn-love mt-3 inline-block px-5 py-2.5 text-sm font-semibold">
            List your project →
          </Link>
        </section>
      )}

      <section className="card mt-4 p-5">
        <p className="text-xs font-medium text-mute">
          Walls they&apos;re on this week
        </p>
        {page.wallsThisWeek.length === 0 ? (
          <p className="mt-3 text-sm text-mute">None yet. A cent fixes that.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {page.wallsThisWeek.map((wall) => (
              <li key={wall.slug}>
                <Link
                  href={`/p/${wall.slug}`}
                  className="block rounded-full border border-line px-3.5 py-1.5 text-sm text-mute transition hover:border-love hover:text-love"
                >
                  {wall.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {page.balance !== null && (
        <p className="mt-6 text-center text-xs text-mute">
          Only you can see this:{" "}
          <Link href="/wallet" className="text-chalk underline underline-offset-4">
            {page.balance}¢ left in your jar
          </Link>
        </p>
      )}
    </div>
  );
}

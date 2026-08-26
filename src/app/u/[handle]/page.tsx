import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Face } from "@/components/Face";
import { profilePage } from "@/lib/queries";
import { currentUser } from "@/lib/session";

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

  const ratio =
    page.received === 0 ? page.gave : Math.round((page.gave / page.received) * 10) / 10;
  const generous = page.gave >= page.received;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <header className="flex items-start gap-4">
        <Face handle={page.handle} avatarUrl={page.avatarUrl} size={72} />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            {page.displayName || `@${page.handle}`}
          </h1>
          <p className="font-mono text-sm text-mute">@{page.handle}</p>
          {page.giveStreak > 0 && (
            <p className="mt-2 inline-block rounded-full border border-love/40 bg-love/5 px-3 py-1 font-mono text-xs text-love">
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
      <section className="mt-8 rounded-xl border border-line bg-ink-2/40 p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">
          Public ledger
        </p>
        <p className="mt-3 font-mono text-3xl">
          <span className="tabular text-love">gave {page.gave}</span>
          <span className="mx-3 text-line">·</span>
          <span className="tabular text-chalk">received {page.received}</span>
        </p>
        <p className="mt-2 font-mono text-xs text-mute">
          {generous
            ? `Gives ${ratio}× what they take. That's the whole status game here.`
            : "Receives more than they give. Everyone can see that."}
        </p>
      </section>

      {page.project && (
        <section className="mt-5 rounded-xl border border-line p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">
            Their project
          </p>
          <Link
            href={`/p/${page.project.slug}`}
            className="mt-2 block transition hover:text-love"
          >
            <span className="text-lg font-medium">{page.project.name}</span>
            <span className="block text-sm text-mute">{page.project.tagline}</span>
          </Link>
          <p className="tabular mt-2 font-mono text-xs text-mute">
            {page.project.backers7d} backers this week
          </p>
        </section>
      )}

      <section className="mt-5 rounded-xl border border-line p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">
          Walls they&apos;re on this week
        </p>
        {page.wallsThisWeek.length === 0 ? (
          <p className="mt-3 font-mono text-sm text-mute">
            None yet. A cent fixes that.
          </p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {page.wallsThisWeek.map((wall) => (
              <li key={wall.slug}>
                <Link
                  href={`/p/${wall.slug}`}
                  className="block rounded-full border border-line px-3 py-1.5 font-mono text-xs text-mute transition hover:border-love hover:text-love"
                >
                  {wall.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {page.balance !== null && (
        <p className="mt-6 text-center font-mono text-xs text-mute">
          Only you can see this:{" "}
          <Link href="/wallet" className="text-chalk underline underline-offset-4">
            {page.balance}¢ left in your jar
          </Link>
        </p>
      )}
    </div>
  );
}

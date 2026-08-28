import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { Face } from "@/components/Face";
import { Sticker } from "@/components/Sticker";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "One thing" };

/**
 * The one screen between signing in and getting on with it.
 *
 * Reached only when X did not hand over an address — the app asks for it,
 * but not every account has a confirmed one. This is then the only moment
 * the question gets asked while somebody is already mid-flow and paying
 * attention. It is
 * deliberately not a gate — "Skip" is a real button that records the answer
 * so nobody is asked twice — because the person on the other side may have
 * arrived to spend a cent on a friend, and standing between them and that
 * would be indefensible.
 */
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const user = await currentUser();
  if (!user) redirect("/join");

  const query = await searchParams;
  const next =
    typeof query.next === "string" && /^\/[a-zA-Z0-9/_-]*$/.test(query.next)
      ? query.next
      : "/wallet";

  // Nothing to ask: they already told us, either way.
  if (user.email) redirect(next);

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="flex items-center gap-3">
        <Face handle={user.handle} avatarUrl={user.avatarUrl} size={44} linked={false} />
        <div>
          <p className="text-sm text-mute">Signed in as</p>
          <p className="font-semibold">@{user.handle}</p>
        </div>
        <Sticker name="sparkle" size={52} float="slow" className="ml-auto" />
      </div>

      <h1 className="display mt-8 text-4xl">
        Where should we tell you who showed up?
      </h1>

      <p className="mt-4 text-mute">
        X doesn&apos;t give us your email, so this is the only way we can reach
        you. Add one and you&apos;ll get a note the moment somebody backs your
        project, and a nightly line on how the projects you back are doing.
      </p>

      <form action="/api/settings" method="post" className="mt-7">
        <input type="hidden" name="next" value={next} />
        <input
          type="email"
          name="email"
          required
          autoFocus
          placeholder="you@example.com"
          className="w-full rounded-full border border-line bg-ink px-5 py-3.5 outline-none transition focus:border-love"
        />
        <button
          type="submit"
          className="btn-love mt-3 w-full px-5 py-3.5 font-semibold"
        >
          Keep me posted →
        </button>
      </form>

      <form action="/api/settings/decline" method="post" className="mt-3">
        <input type="hidden" name="next" value={next} />
        <button
          type="submit"
          className="w-full py-2 text-center text-sm text-mute transition hover:text-chalk"
        >
          Skip — don&apos;t ask again
        </button>
      </form>

      <ul className="mt-8 space-y-1.5 text-sm text-mute">
        <li>· Two kinds of email, and no others.</li>
        <li>· Never shown on your profile or anywhere public.</li>
        <li>· Clear the field on your wallet to stop, any time.</li>
      </ul>

      <p className="mt-6 text-xs text-mute">
        What we do with it is in the{" "}
        <Link href="/legal/privacy" className="text-love">
          privacy policy
        </Link>
        .
      </p>
    </div>
  );
}

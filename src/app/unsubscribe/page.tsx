import type { Metadata } from "next";
import Link from "next/link";
import { Sticker } from "@/components/Sticker";
import { validUnsubscribe } from "@/lib/unsubscribe";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

/**
 * One button, no sign-in.
 *
 * The confirm step is not friction for its own sake: mail clients and
 * security scanners fetch every link in a message, so an unsubscribe that
 * happened on page load would cancel people's mail without them touching
 * anything. A single POST button is the smallest thing that cannot be
 * triggered by a robot reading the inbox.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const query = await searchParams;
  const userId = Number(query.u ?? 0);
  const token = String(query.t ?? "");
  const signed =
    Number.isInteger(userId) && userId > 0 && (await validUnsubscribe(userId, token));

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <Sticker name="heart" size={64} className="mx-auto" />

      {query.done ? (
        <>
          <h1 className="display mt-6 text-3xl">Unsubscribed.</h1>
          <p className="mt-3 text-mute">
            No more email from famlove. Your cents, your wall and your projects
            are all untouched — this only stopped the mail.
          </p>
          <Link href="/" className="btn-love mt-8 inline-block px-6 py-3.5 font-semibold">
            Back to the board
          </Link>
        </>
      ) : signed ? (
        <>
          <h1 className="display mt-6 text-3xl">Stop the email?</h1>
          <p className="mt-3 text-mute">
            This turns off every email famlove sends — the daily digests and
            the note when somebody shows up for you. Nothing else changes.
          </p>
          <form action="/api/email/unsubscribe" method="post" className="mt-8">
            <input type="hidden" name="u" value={userId} />
            <input type="hidden" name="t" value={token} />
            <button type="submit" className="btn-love w-full px-6 py-4 font-semibold">
              Unsubscribe
            </button>
          </form>
          <p className="mt-4 text-sm text-mute">
            Changed your mind?{" "}
            <Link href="/wallet" className="text-chalk underline underline-offset-4">
              Keep it on
            </Link>
          </p>
        </>
      ) : (
        <>
          <h1 className="display mt-6 text-3xl">That link has expired.</h1>
          <p className="mt-3 text-mute">
            We could not verify it. You can turn the email off yourself by
            clearing the address on your wallet.
          </p>
          <Link href="/wallet" className="btn-love mt-8 inline-block px-6 py-3.5 font-semibold">
            Go to your wallet
          </Link>
        </>
      )}
    </div>
  );
}

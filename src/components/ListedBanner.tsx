"use client";

import { useEffect, useState } from "react";
import { Confetti } from "./Confetti";
import { Sticker } from "./Sticker";
import { XIcon } from "./XIcon";
import { trackXEvent } from "./ConsentBanner";

/**
 * The thirty seconds after a builder lists.
 *
 * They have just created a page with an empty wall, which is the single worst
 * state this product has — a project showing nobody actively signals failure.
 * The only fix is the owner asking people, immediately, while they are still
 * here and still pleased with themselves.
 *
 * So this is not a "success!" toast. It is a launcher: the post, the link for
 * the group chat, and the one sentence explaining why asking is not begging —
 * nobody can buy their way onto their wall, so the only way it fills is if
 * they ask.
 */
export function ListedBanner({
  projectName,
  projectUrl,
  slug,
  viewerEmail,
}: {
  projectName: string;
  projectUrl: string;
  slug: string;
  /** Only ever the signed-in owner's own address, and only if they have one. */
  viewerEmail?: string | null;
}) {
  const [copied, setCopied] = useState(false);

  /*
   * The X conversion, reported from here and nowhere else.
   *
   * This component renders if and only if a listing actually happened *and*
   * the viewer owns it, which makes it the truest signal of a listing in the
   * codebase. The POST handler would count rows the database went on to
   * reject; NewProjectForm would count submissions rather than projects.
   *
   * The slug is the conversion id, not just the dedupe key, so that a server
   * report of the same listing collapses onto this one rather than doubling
   * it — both sides can derive it without coordinating.
   */
  useEffect(() => {
    trackXEvent(process.env.NEXT_PUBLIC_X_LISTED_EVENT_ID, slug, {
      email: viewerEmail,
    });
  }, [slug, viewerEmail]);

  const post = encodeURIComponent(
    // No bare domain in the prose: X links it and unfurls that first link
    // instead of the project below.
    `I just listed ${projectName} on famlove 🩷\n\n` +
      `It ranks by how many people show up, not how much they spend — ` +
      `1¢ each, capped at one per person a day. You can't buy your way up, ` +
      `you can only be shown up for.\n\n` +
      `Spare a cent?\n${projectUrl}`,
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(projectUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="relative mb-8 overflow-hidden rounded-[26px] border border-love/40 bg-love/10 p-6">
      <Confetti pieces={120} />

      <div className="relative flex items-start gap-4">
        <Sticker name="hands" size={54} className="hidden shrink-0 sm:block" />
        <div className="min-w-0">
          <h2 className="display text-2xl">
            {projectName} is live. Now go get your first cent.
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-mute">
            Your wall is empty, and an empty wall says more than no wall at all.
            Nobody can buy their way onto it —{" "}
            <span className="text-chalk">
              the only way it fills up is if you ask.
            </span>{" "}
            Send this to five people who&apos;d spend a cent on you.
          </p>

          <div className="mt-5 flex flex-wrap gap-2.5">
            <a
              href={`https://x.com/intent/post?text=${post}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-love flex items-center gap-2 px-5 py-3 text-sm font-semibold"
            >
              <XIcon size={14} />
              Post it to your fam
            </a>
            <button
              type="button"
              onClick={copy}
              className="rounded-full border border-line-2 px-5 py-3 text-sm font-medium text-chalk transition hover:border-love hover:text-love"
            >
              {copied ? "Copied ✓" : "Copy link for the group chat"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

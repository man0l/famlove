import { ImageResponse } from "next/og";
import { projectPage } from "@/lib/queries";
import { renderCard, CARD_SIZE, CARD_CACHE } from "@/lib/og-card";

export const alt = "The wall of everyone who showed up";
export const size = CARD_SIZE;
export const contentType = "image/png";

/**
 * The share artifact is the wall, not the rank — a grid of tagged humans, each
 * with a reason to look at the post. Everything is designed backwards from
 * this image; the drawing itself lives in renderCard so the homepage example
 * cannot drift from the card people actually post.
 */
export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await projectPage(slug, null);

  if (!page) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0a0a0b",
            color: "#ededf0",
            fontSize: 48,
          }}
        >
          famlove.lol
        </div>
      ),
      { ...size, headers: CARD_CACHE },
    );
  }

  /*
   * Pick a window and label it honestly. This used to draw the week's faces
   * whenever today was thin while still captioning them "today", so picture
   * and sentence disagreed — worst right after 00:00 UTC, when the cap resets
   * and today's wall is empty, which is exactly when a builder posts it.
   */
  const useToday = page.backersToday >= 3 || page.backers7d === 0;

  return renderCard({
    name: page.project.name,
    tagline: page.project.tagline,
    rank: page.rank,
    ownerHandle: page.project.ownerHandle,
    ownerAvatar: page.project.ownerAvatar,
    count: useToday ? page.backersToday : page.backers7d,
    windowLabel: useToday ? "showed up today" : "showed up this week",
    showCents: useToday,
    streakDays: page.streakDays,
    dateLabel: new Date().toISOString().slice(0, 10),
    faces: useToday ? page.wallToday : page.wall7d,
  });
}

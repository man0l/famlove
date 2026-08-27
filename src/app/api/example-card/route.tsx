import { ImageResponse } from "next/og";
import { showcaseCard } from "@/lib/queries";
import { renderCard, CARD_SIZE, CARD_CACHE } from "@/lib/og-card";

export const dynamic = "force-dynamic";

/*
 * The permanent homepage example. Same drawing as the real share card, but
 * fed the all-time wall so its faces never age out — a fixed snapshot of the
 * format, on the page whose job is to sell the format. Pinned to one project
 * on purpose: a hero card that changes identity between visits reads as a
 * screenshot of someone else's product.
 */
const SHOWCASE_SLUG = "slashloop-dev";

export async function GET() {
  const card = await showcaseCard(SHOWCASE_SLUG);

  if (!card) {
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
      { ...CARD_SIZE, headers: CARD_CACHE },
    );
  }

  return renderCard({
    name: card.name,
    tagline: card.tagline,
    rank: card.rank,
    ownerHandle: card.ownerHandle,
    ownerAvatar: card.ownerAvatar,
    count: card.backers,
    // All-time, so no "today" and no cents figure — the count is people, not a
    // day's spend, and saying "today" of an evergreen card would be a lie.
    windowLabel: "have shown up",
    showCents: false,
    streakDays: 0,
    dateLabel: "an example",
    faces: card.faces,
  });
}

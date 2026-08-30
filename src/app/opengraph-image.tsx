import { exampleCard } from "@/lib/example-card";
import { CARD_SIZE } from "@/lib/og-card";

export const alt = "The card you post — everyone who showed up";
export const size = CARD_SIZE;
export const contentType = "image/png";

/**
 * The card for famlove.lol itself, and for every page that doesn't draw its
 * own — /rising, /wallet, the legal pages.
 *
 * It was missing, which is how a post linking the homepage unfurled as a grey
 * box: twitter:card said summary_large_image and no image was ever named.
 * Project pages override this with their own wall.
 */
export default async function Image() {
  return exampleCard();
}

import { ImageResponse } from "next/og";
import { initials } from "@/components/Face";
import type { Face } from "@/lib/queries";
import { SITE_URL } from "@/lib/config";
import { inlineImages } from "@/lib/og-images";

export const CARD_SIZE = { width: 1200, height: 630 };

/*
 * A minute of staleness is invisible on a wall that only changes when somebody
 * spends a cent, and it collapses a burst of social-scraper fetches onto the
 * edge instead of the database.
 */
export const CARD_CACHE = {
  "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
};

export type CardData = {
  name: string;
  tagline: string;
  rank: number | null;
  ownerHandle: string;
  ownerAvatar: string | null;
  /** The headline number and the words after it — the caller decides what it counts. */
  count: number;
  windowLabel: string;
  /** One cent per person per day means today's count *is* the cents; a week's is not. */
  showCents: boolean;
  streakDays: number;
  dateLabel: string;
  faces: Face[];
  /** The project's own og:image, when its site publishes one. */
  projectImage: string | null;
};

/*
 * satori's own image loader does not work on workerd — it fetches, fails
 * silently, and draws an empty grid (proved in production, for our own /faces
 * and for pbs.twimg.com alike). So every avatar is fetched here and handed
 * over as bytes. The extension swap matters too: satori has no WebP decoder,
 * so generated faces ship a .card.png beside the .webp the site uses.
 */
/*
 * satori decodes PNG, JPEG and GIF. Anything else — WebP, AVIF, SVG — draws
 * as an empty box, and a lot of sites now serve exactly those from og:image.
 * Better no thumbnail than a hole where one should be.
 */
const DRAWABLE = /^data:image\/(png|jpeg|jpg|gif)/i;

/** A stranger's hero image is whatever they uploaded; ours are not. */
const MAX_PROJECT_IMAGE = 3_000_000;

/** 1.91:1 is the OpenGraph aspect nearly every one of these is authored at,
 *  and this height is the text block's, so the thumbnail costs no rows. */
const THUMB = { width: 273, height: 143 };

function forCard(url: string | null): string | null {
  if (!url) return null;
  const swapped = url.replace(/^(\/faces\/[^/]+)\.webp$/, "$1.card.png");
  return swapped.startsWith("/") ? `${SITE_URL}${swapped}` : swapped;
}

/** The one place the share card is drawn — the live OG route and the homepage
 *  example both render through here, so they can never drift apart. */
export async function renderCard(data: CardData): Promise<ImageResponse> {
  const shown = data.faces.slice(0, 40);

  const wanted = [
    ...shown.map((face) => forCard(face.avatarUrl)),
    forCard(data.ownerAvatar),
  ].filter((url): url is string => Boolean(url));

  // Fetched apart from the faces so one slow or enormous third-party host
  // cannot hold up, or size-cap, the wall that is the point of the card.
  const [inlined, heroes] = await Promise.all([
    inlineImages(wanted),
    data.projectImage
      ? inlineImages([data.projectImage], undefined, MAX_PROJECT_IMAGE)
      : Promise.resolve(new Map<string, string>()),
  ]);
  const absolute = (url: string | null): string | null => {
    const target = forCard(url);
    return target ? (inlined.get(target) ?? null) : null;
  };

  const heroRaw = data.projectImage ? (heroes.get(data.projectImage) ?? null) : null;
  const hero = heroRaw && DRAWABLE.test(heroRaw) ? heroRaw : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0a0a0b",
          color: "#ededf0",
          padding: 56,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 22, letterSpacing: 4, color: "#ff3d68" }}>
            FAMLOVE.LOL
          </div>
          <div style={{ fontSize: 22, letterSpacing: 4, color: "#565660" }}>
            {`· ${data.dateLabel}`}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 28, marginTop: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 20,
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
            }}
          >
          <div style={{ fontSize: 78, color: "#ff3d68", lineHeight: 1 }}>
            {data.rank ? `#${data.rank}` : "—"}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 56, lineHeight: 1.05 }}>{data.name}</div>
            <div style={{ fontSize: 26, color: "#8b8b96", marginTop: 8 }}>
              {/* The thumbnail takes the right quarter of the row, so the
                  tagline has to give it back or the two collide. */}
              {data.tagline.slice(0, hero ? 50 : 74)}
            </div>
            {/* The builder's own face, as the builder. Nobody shows up for
                themselves, so this is attribution, set apart from the wall. */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginTop: 12,
                fontSize: 24,
                color: "#8b8b96",
              }}
            >
              {absolute(data.ownerAvatar) && (
                <img
                  src={absolute(data.ownerAvatar)!}
                  width={38}
                  height={38}
                  style={{ borderRadius: 999 }}
                />
              )}
              <span>{`by @${data.ownerHandle}`}</span>
            </div>
          </div>
          </div>

          {/* What the project actually looks like, from its own og:image.
              Secondary by design: the wall below is the thing being posted,
              this is only the thing being posted about. */}
          {hero && (
            <img
              src={hero}
              width={THUMB.width}
              height={THUMB.height}
              style={{
                flexShrink: 0,
                borderRadius: 14,
                objectFit: "cover",
                border: "1px solid #23232c",
              }}
            />
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 16,
            marginTop: 34,
            fontSize: 28,
            color: "#8b8b96",
          }}
        >
          <span style={{ color: "#ededf0" }}>{`${data.count} ${data.windowLabel}`}</span>
          {data.showCents && <span>{`· ${data.count}¢`}</span>}
          {data.streakDays > 0 && <span>{`· streak ${data.streakDays}d`}</span>}
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            marginTop: 22,
            maxHeight: 230,
            overflow: "hidden",
          }}
        >
          {shown.map((face) =>
            absolute(face.avatarUrl) ? (
              <img
                key={face.handle}
                src={absolute(face.avatarUrl)!}
                width={68}
                height={68}
                style={{ borderRadius: 999 }}
              />
            ) : (
              <div
                key={face.handle}
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: 999,
                  background: "#23232c",
                  color: "#b9b9c4",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                }}
              >
                {initials(face.handle)}
              </div>
            ),
          )}
        </div>

        <div style={{ marginTop: "auto", fontSize: 24, color: "#565660", display: "flex" }}>
          1¢ each · one per person, per project, per day · you cannot buy this
        </div>
      </div>
    ),
    { ...CARD_SIZE, headers: CARD_CACHE },
  );
}

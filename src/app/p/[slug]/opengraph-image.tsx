import { ImageResponse } from "next/og";
import { projectPage } from "@/lib/queries";
import { initials } from "@/components/Face";

export const alt = "The wall of everyone who showed up";

/*
 * The homepage embeds one of these, and social scrapers fetch them in bursts,
 * so every view would otherwise cost a database round-trip and a satori
 * render. A minute of staleness is invisible on a wall that changes when
 * somebody spends a cent, and it collapses the load onto the edge.
 */
const CACHE = {
  "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
};
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The share artifact is the wall, not the rank.
 *
 * outbid's artifact was a number; this one is a grid of tagged humans, each of
 * whom now has a reason to look at the post. The card carries its own
 * distribution list — design everything backwards from this image.
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
      { ...size, headers: CACHE },
    );
  }

  /*
   * Pick a window and label it honestly.
   *
   * This used to draw the week's faces whenever today was thin while still
   * captioning them "N showed up today" — so the picture and the sentence
   * disagreed, and the sentence was the weaker of the two. It was worst in
   * the hours right after 00:00 UTC, when the cap resets and today's wall is
   * empty, which is precisely when a builder is most likely to post it.
   */
  const useToday = page.backersToday >= 3 || page.backers7d === 0;
  const faces = useToday ? page.wallToday : page.wall7d;
  const count = useToday ? page.backersToday : page.backers7d;
  const window = useToday ? "showed up today" : "showed up this week";
  const shown = faces.slice(0, 40);
  const today = new Date().toISOString().slice(0, 10);

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
            {`\u00b7 ${today}`}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 20, marginTop: 18 }}>
          <div style={{ fontSize: 78, color: "#ff3d68", lineHeight: 1 }}>
            {page.rank ? `#${page.rank}` : "—"}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 56, lineHeight: 1.05 }}>{page.project.name}</div>
            <div style={{ fontSize: 26, color: "#8b8b96", marginTop: 8 }}>
              {page.project.tagline.slice(0, 74)}
            </div>
          </div>
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
          <span style={{ color: "#ededf0" }}>{`${count} ${window}`}</span>
          {/* One cent per person per day, so today's count *is* the cents.
              Over a week it is not, so the figure is simply omitted. */}
          {useToday && <span>{`\u00b7 ${count}\u00a2`}</span>}
          {page.streakDays > 0 && (
            <span>{`\u00b7 streak ${page.streakDays}d`}</span>
          )}
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
            face.avatarUrl ? (
              <img
                key={face.handle}
                src={face.avatarUrl}
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

        <div
          style={{
            marginTop: "auto",
            fontSize: 24,
            color: "#565660",
            display: "flex",
          }}
        >
          1¢ each · one per person, per project, per day · you cannot buy this
        </div>
      </div>
    ),
    { ...size, headers: CACHE },
  );
}

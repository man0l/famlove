import { ImageResponse } from "next/og";
import { projectPage } from "@/lib/queries";
import { initials } from "@/components/Face";

export const alt = "The wall of everyone who showed up today";
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
      size,
    );
  }

  const faces = page.wallToday.length ? page.wallToday : page.wall7d;
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
          <span style={{ color: "#ededf0" }}>
            {`${page.backersToday} showed up today`}
          </span>
          <span>{`\u00b7 ${page.backersToday}\u00a2`}</span>
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
    size,
  );
}

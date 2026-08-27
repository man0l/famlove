import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { fetchSiteMeta } from "@/lib/metadata";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Re-read the sites behind real listings.
 *
 * Listings capture their icon and description once, at list time. Sites get
 * redesigned and favicons 404, so a board built on a one-time read slowly
 * fills with broken images. This re-reads them.
 *
 * It deliberately only touches projects owned by real accounts. The fixture
 * rows carry plausible-sounding domains — northpass.com, coldbrew.com — and
 * several of those are real companies with nothing to do with this board.
 * Fetching them would paste a real business's logo and marketing copy onto a
 * made-up leaderboard row, which is a considerably worse failure than a row
 * with no icon.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 25), 100);
  const slug = request.nextUrl.searchParams.get("slug");

  const targets = (await sql`
    SELECT p.id, p.slug, p.url
    FROM projects p
    JOIN users u ON u.id = p.owner_id
    WHERE p.removed_at IS NULL
      AND u.is_seed = false
      AND (${slug}::text IS NULL OR p.slug = ${slug})
    ORDER BY p.id
    LIMIT ${limit}::int
  `) as { id: number; slug: string; url: string }[];

  const results: Record<string, string> = {};
  for (const project of targets) {
    const meta = await fetchSiteMeta(project.url);
    if (!meta) {
      results[project.slug] = "unreadable";
      continue;
    }
    /*
     * COALESCE, not assignment. A re-read that finds nothing must not wipe an
     * icon somebody typed in by hand on the listing form — the human's answer
     * outranks the crawler's, and this job runs unattended.
     */
    await sql`
      UPDATE projects
      SET favicon_url = COALESCE(${meta.favicon}, favicon_url),
          image_url   = COALESCE(${meta.image}, image_url)
      WHERE id = ${project.id}
    `;
    results[project.slug] = meta.favicon ? "icon + image" : "no icon published";
  }

  return NextResponse.json({ ok: true, checked: targets.length, results });
}

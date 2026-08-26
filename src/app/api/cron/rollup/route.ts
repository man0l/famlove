import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { sendShowedUpEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The 00:00 UTC rollup (Vercel cron fires it at 00:05).
 *
 * It writes yesterday's per-project counts and streaks into daily_rollups so
 * the badges and RISING averages are cheap to read, then sends the one email
 * famlove has: "N people showed up for you today", with the handles.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = request.headers.get("authorization");
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  const day =
    request.nextUrl.searchParams.get("day") ??
    new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  const written = (await sql`
    WITH counts AS (
      SELECT project_id, COUNT(DISTINCT from_user_id) AS backers
      FROM loves WHERE day_utc = ${day}::date
      GROUP BY project_id
    ),
    islands AS (
      SELECT project_id, day_utc,
             day_utc - (ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY day_utc))::int AS grp
      FROM (SELECT DISTINCT project_id, day_utc FROM loves WHERE day_utc <= ${day}::date) d
    ),
    last_island AS (
      SELECT DISTINCT ON (project_id) project_id, grp
      FROM islands ORDER BY project_id, day_utc DESC
    ),
    streaks AS (
      SELECT i.project_id, COUNT(*) AS streak_days
      FROM islands i
      JOIN last_island li ON li.project_id = i.project_id AND li.grp = i.grp
      GROUP BY i.project_id
    )
    INSERT INTO daily_rollups (project_id, day_utc, backers, streak_days)
    SELECT c.project_id, ${day}::date, c.backers, COALESCE(s.streak_days, 1)
    FROM counts c
    LEFT JOIN streaks s ON s.project_id = c.project_id
    ON CONFLICT (project_id, day_utc) DO UPDATE
      SET backers = EXCLUDED.backers, streak_days = EXCLUDED.streak_days
    RETURNING project_id, backers, streak_days
  `) as Record<string, unknown>[];

  const pending = (await sql`
    SELECT r.project_id, r.backers, r.streak_days, p.name, p.slug, u.email,
           (SELECT COALESCE(json_agg(h.handle), '[]'::json) FROM (
              SELECT DISTINCT u2.handle
              FROM loves l JOIN users u2 ON u2.id = l.from_user_id
              WHERE l.project_id = r.project_id AND l.day_utc = ${day}::date
              LIMIT 40
           ) h) AS handles
    FROM daily_rollups r
    JOIN projects p ON p.id = r.project_id
    JOIN users u ON u.id = p.owner_id
    WHERE r.day_utc = ${day}::date
      AND r.emailed_at IS NULL
      AND u.email IS NOT NULL
      AND r.backers > 0
  `) as Record<string, unknown>[];

  let sent = 0;
  for (const row of pending) {
    const ok = await sendShowedUpEmail({
      to: String(row.email),
      projectName: String(row.name),
      slug: String(row.slug),
      count: Number(row.backers),
      handles: (row.handles as string[]) ?? [],
      streakDays: Number(row.streak_days),
    });
    if (ok) {
      sent += 1;
      await sql`
        UPDATE daily_rollups SET emailed_at = now()
        WHERE project_id = ${Number(row.project_id)} AND day_utc = ${day}::date
      `;
    }
  }

  return NextResponse.json({
    ok: true,
    day,
    projects: written.length,
    emailsSent: sent,
  });
}

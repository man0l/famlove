import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  sendOwnerDigest,
  sendSupporterDigest,
  type SupporterLine,
} from "@/lib/email";
import { DAILY_GIVE_CEILING, RALLY_HOURS, RALLY_MIN_GOAL } from "@/lib/config";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Everything that happens at 00:00 UTC, in one job.
 *
 * Order matters. The digests describe the day that just ended, so they run
 * before anything writes to the new one. Then today's rallies open, and only
 * then do standing orders fire — so an automatic cent counts toward the
 * rally it was meant for rather than yesterday's.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const url = request.nextUrl.searchParams;
  const yesterday =
    url.get("day") ?? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const only = url.get("only");
  const run = (step: string) => !only || only === step;

  const result: Record<string, unknown> = { day: yesterday, today };

  /* ------------------------------------------------------------- rollups */
  if (run("rollup")) {
    const written = (await sql`
      WITH counts AS (
        SELECT project_id, COUNT(DISTINCT from_user_id) AS backers
        FROM loves WHERE day_utc = ${yesterday}::date
        GROUP BY project_id
      ),
      islands AS (
        SELECT project_id, day_utc,
               day_utc - (ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY day_utc))::int AS grp
        FROM (SELECT DISTINCT project_id, day_utc FROM loves WHERE day_utc <= ${yesterday}::date) d
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
      SELECT c.project_id, ${yesterday}::date, c.backers, COALESCE(s.streak_days, 1)
      FROM counts c
      LEFT JOIN streaks s ON s.project_id = c.project_id
      ON CONFLICT (project_id, day_utc) DO UPDATE
        SET backers = EXCLUDED.backers, streak_days = EXCLUDED.streak_days
      RETURNING project_id
    `) as unknown[];
    result.rollups = written.length;
  }

  /* ------------------------------------------------------ owner digests */
  if (run("owner")) {
    const pending = (await sql`
      SELECT r.project_id, r.backers, r.streak_days, p.name, p.slug,
             u.id AS owner_id, u.email,
             (SELECT COALESCE(json_agg(h.handle), '[]'::json) FROM (
                SELECT DISTINCT u2.handle
                FROM loves l JOIN users u2 ON u2.id = l.from_user_id
                WHERE l.project_id = r.project_id AND l.day_utc = ${yesterday}::date
                LIMIT 40
             ) h) AS people
      FROM daily_rollups r
      JOIN projects p ON p.id = r.project_id AND p.removed_at IS NULL
      JOIN users u ON u.id = p.owner_id
      WHERE r.day_utc = ${yesterday}::date AND r.backers > 0 AND u.email IS NOT NULL
    `) as Record<string, unknown>[];

    let sent = 0;
    for (const row of pending) {
      const [rank] = (await sql`
        WITH ranked AS (
          SELECT p.id, ROW_NUMBER() OVER (
            ORDER BY COUNT(DISTINCT l.from_user_id) DESC,
                     MAX(l.created_at) DESC NULLS LAST, p.id ASC) AS rank
          FROM projects p
          LEFT JOIN loves l ON l.project_id = p.id
            AND l.day_utc >= (now() AT TIME ZONE 'utc')::date - 6
          WHERE p.removed_at IS NULL GROUP BY p.id
        ) SELECT rank FROM ranked WHERE id = ${Number(row.project_id)}
      `) as { rank: number }[];

      const ok = await sendOwnerDigest({
        ownerId: Number(row.owner_id),
        to: String(row.email),
        projectName: String(row.name),
        slug: String(row.slug),
        count: Number(row.backers),
        people: (row.people as string[]) ?? [],
        streakDays: Number(row.streak_days),
        rank: rank ? Number(rank.rank) : null,
        day: yesterday,
      });
      if (ok) sent += 1;
    }
    result.ownerEmails = sent;
  }

  /* -------------------------------------------------- supporter digests */
  if (run("supporter")) {
    const supporters = (await sql`
      SELECT u.id, u.handle, u.email, COALESCE(w.cents_balance, 0) AS cents_left,
             (SELECT COUNT(*) FROM auto_loves a WHERE a.user_id = u.id) AS auto_count
      FROM users u
      LEFT JOIN wallets w ON w.user_id = u.id
      WHERE u.email IS NOT NULL AND u.banned_at IS NULL
        AND EXISTS (
          SELECT 1 FROM loves l
          WHERE l.from_user_id = u.id
            AND l.day_utc >= ${yesterday}::date - 6
        )
    `) as Record<string, unknown>[];

    let sent = 0;
    for (const s of supporters) {
      const lines = (await sql`
        SELECT DISTINCT ON (p.id) p.name, p.slug,
               (SELECT COUNT(DISTINCT l2.from_user_id) FROM loves l2
                 WHERE l2.project_id = p.id AND l2.day_utc = ${yesterday}::date
               ) AS backers_today
        FROM loves l
        JOIN projects p ON p.id = l.project_id AND p.removed_at IS NULL
        WHERE l.from_user_id = ${Number(s.id)}
          AND l.day_utc >= ${yesterday}::date - 6
        ORDER BY p.id, l.created_at DESC
      `) as Record<string, unknown>[];

      const projects: SupporterLine[] = lines
        .map((x) => ({
          name: String(x.name),
          slug: String(x.slug),
          backersToday: Number(x.backers_today ?? 0),
          rank: null,
        }))
        .sort((a, b) => b.backersToday - a.backersToday)
        .slice(0, 12);

      const ok = await sendSupporterDigest({
        userId: Number(s.id),
        to: String(s.email),
        handle: String(s.handle),
        projects,
        centsLeft: Number(s.cents_left),
        autoCount: Number(s.auto_count),
        day: yesterday,
      });
      if (ok) sent += 1;
    }
    result.supporterEmails = sent;
  }

  /* ------------------------------------------------------ today's rallies */
  if (run("rally")) {
    /*
     * A rally a day, opened for the project rather than by it. Only for
     * projects with a pulse in the last week — sixty rallies reading 0/50
     * would make the board look abandoned rather than busy. The goal is the
     * project's own best day plus a fifth, so it is always a stretch and
     * never an insult.
     */
    const opened = (await sql`
      WITH active AS (
        SELECT l.project_id,
               MAX(d.backers) AS best
        FROM loves l
        JOIN daily_rollups d ON d.project_id = l.project_id
          AND d.day_utc >= (now() AT TIME ZONE 'utc')::date - 7
        WHERE l.day_utc >= (now() AT TIME ZONE 'utc')::date - 7
        GROUP BY l.project_id
      )
      INSERT INTO rallies (project_id, starts_at, ends_at, goal)
      SELECT a.project_id,
             date_trunc('day', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc',
             (date_trunc('day', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc')
               + ${`${RALLY_HOURS} hours`}::interval,
             GREATEST(${RALLY_MIN_GOAL}::int, CEIL(COALESCE(a.best, 0) * 1.2)::int)
      FROM active a
      JOIN projects p ON p.id = a.project_id AND p.removed_at IS NULL
      ON CONFLICT DO NOTHING
      RETURNING project_id
    `) as unknown[];
    result.ralliesOpened = opened.length;
  }

  /* ------------------------------------------------------ standing orders */
  if (run("auto")) {
    /*
     * Every rule a person is held to still applies here: one cent per
     * project per UTC day, the 60-a-day ceiling, and a balance that must
     * cover it. The unique index does the last word — a standing order that
     * would break the cap simply inserts nothing.
     */
    const placed = (await sql`
      WITH candidates AS (
        SELECT a.user_id, a.project_id,
               ROW_NUMBER() OVER (PARTITION BY a.user_id ORDER BY a.created_at) AS n,
               w.cents_balance,
               (SELECT COUNT(*) FROM loves l
                 WHERE l.from_user_id = a.user_id
                   AND l.day_utc = (now() AT TIME ZONE 'utc')::date) AS given_today
        FROM auto_loves a
        JOIN wallets w ON w.user_id = a.user_id
        JOIN projects p ON p.id = a.project_id AND p.removed_at IS NULL
        JOIN users u ON u.id = a.user_id AND u.banned_at IS NULL
        WHERE w.cents_balance > 0 AND p.owner_id <> a.user_id
      ),
      eligible AS (
        SELECT * FROM candidates
        WHERE n <= cents_balance
          AND given_today + n <= ${DAILY_GIVE_CEILING}::int
      ),
      ins AS (
        INSERT INTO loves (from_user_id, project_id, day_utc, auto)
        SELECT user_id, project_id, (now() AT TIME ZONE 'utc')::date, TRUE
        FROM eligible
        ON CONFLICT DO NOTHING
        RETURNING from_user_id
      ),
      spend AS (
        SELECT from_user_id, COUNT(*) AS n FROM ins GROUP BY from_user_id
      ),
      upd AS (
        UPDATE wallets w
        SET cents_balance = w.cents_balance - s.n,
            cents_given   = w.cents_given + s.n,
            updated_at    = now()
        FROM spend s WHERE s.from_user_id = w.user_id
        RETURNING w.user_id
      )
      SELECT (SELECT COUNT(*) FROM ins) AS placed,
             (SELECT COUNT(*) FROM upd) AS wallets
    `) as Record<string, unknown>[];
    result.autoLoves = Number(placed[0]?.placed ?? 0);
    result.autoWallets = Number(placed[0]?.wallets ?? 0);
  }

  return NextResponse.json({ ok: true, ...result });
}

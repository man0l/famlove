import { sql } from "./db";
import { isoDay, isoTime } from "./time";
import {
  BOARD_WINDOW_DAYS,
  DAILY_GIVE_CEILING,
  RALLY_HOURS,
} from "./config";

/*
 * All the SQL in the product lives here. The boards are three SELECTs, the
 * game is one INSERT, and the anti-gaming system is a unique index. That is
 * deliberate: there is no framework to argue with when the rules need to hold.
 *
 * Every date comparison uses `(now() AT TIME ZONE 'utc')::date` rather than
 * CURRENT_DATE, so the cap resets at 00:00 UTC no matter how the database
 * session's timezone is configured.
 */

export type Face = { handle: string; avatarUrl: string | null };

export type BoardEntry = {
  rank: number;
  projectId: number;
  slug: string;
  name: string;
  tagline: string;
  url: string;
  /** The site's own icon, read from its meta tags when it was listed. */
  faviconUrl: string | null;
  ownerHandle: string;
  backers: number;
  backersToday: number;
  lastLoveAt: string | null;
  faces: Face[];
};

/* ------------------------------------------------------------------ LOVED */

/**
 * The main board. Ranked by *distinct backers* in the rolling 7-day window —
 * cents given are irrelevant, which is the entire point. Ties break on the
 * most recent love, so momentum beats a stale pile.
 */
export async function lovedBoard(limit = 50): Promise<BoardEntry[]> {
  const rows = (await sql`
    WITH ranked AS (
      SELECT p.id, p.slug, p.name, p.tagline, p.url, p.favicon_url, u.handle AS owner_handle,
             COUNT(DISTINCT l.from_user_id) AS backers,
             COUNT(DISTINCT l.from_user_id) FILTER (
               WHERE l.day_utc = (now() AT TIME ZONE 'utc')::date
             ) AS backers_today,
             MAX(l.created_at) AS last_love_at
      FROM projects p
      JOIN users u ON u.id = p.owner_id
      LEFT JOIN loves l
        ON l.project_id = p.id
       AND l.day_utc >= (now() AT TIME ZONE 'utc')::date - ${BOARD_WINDOW_DAYS - 1}::int
      WHERE p.removed_at IS NULL
      GROUP BY p.id, u.handle
    )
    SELECT r.*, f.faces
    FROM ranked r
    LEFT JOIN LATERAL (
      SELECT COALESCE(json_agg(t.j), '[]'::json) AS faces FROM (
        SELECT x.j FROM (
          SELECT DISTINCT ON (l.from_user_id)
                 json_build_object('handle', u2.handle, 'avatarUrl', u2.avatar_url) AS j,
                 l.created_at
          FROM loves l
          JOIN users u2 ON u2.id = l.from_user_id
          WHERE l.project_id = r.id
            AND l.day_utc >= (now() AT TIME ZONE 'utc')::date - ${BOARD_WINDOW_DAYS - 1}::int
          ORDER BY l.from_user_id, l.created_at DESC
        ) x
        ORDER BY x.created_at DESC
        LIMIT 14
      ) t
    ) f ON TRUE
    ORDER BY r.backers DESC, r.last_love_at DESC NULLS LAST, r.id ASC
    LIMIT ${limit}
  `) as Record<string, unknown>[];

  return rows.map(toBoardEntry);
}

function toBoardEntry(row: Record<string, unknown>, i: number): BoardEntry {
  return {
    rank: i + 1,
    projectId: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
    tagline: String(row.tagline ?? ""),
    url: String(row.url),
    faviconUrl: (row.favicon_url as string | null) ?? null,
    ownerHandle: String(row.owner_handle),
    backers: Number(row.backers ?? 0),
    backersToday: Number(row.backers_today ?? 0),
    lastLoveAt: row.last_love_at ? isoTime(row.last_love_at) : null,
    faces: (row.faces as Face[] | null) ?? [],
  };
}

/** The position a single project holds on LOVED right now. */
export async function lovedRank(projectId: number): Promise<number | null> {
  const rows = (await sql`
    WITH ranked AS (
      SELECT p.id,
             COUNT(DISTINCT l.from_user_id) AS backers,
             MAX(l.created_at) AS last_love_at,
             ROW_NUMBER() OVER (
               ORDER BY COUNT(DISTINCT l.from_user_id) DESC,
                        MAX(l.created_at) DESC NULLS LAST,
                        p.id ASC
             ) AS rank
      FROM projects p
      LEFT JOIN loves l
        ON l.project_id = p.id
       AND l.day_utc >= (now() AT TIME ZONE 'utc')::date - ${BOARD_WINDOW_DAYS - 1}::int
      WHERE p.removed_at IS NULL
      GROUP BY p.id
    )
    SELECT rank FROM ranked WHERE id = ${projectId}
  `) as { rank: number }[];
  return rows[0] ? Number(rows[0].rank) : null;
}

/* ----------------------------------------------------------------- RISING */

export type RisingEntry = BoardEntry & { multiplier: number; average: number };

/**
 * Today's backers divided by the project's own 7-day daily average. This is
 * the board that stops famlove decaying into a follower-count mirror: a
 * project with 6 backers on a normal day of 1 outranks a big account at 40.
 */
export async function risingBoard(limit = 50): Promise<RisingEntry[]> {
  const rows = (await sql`
    WITH today AS (
      SELECT project_id, COUNT(DISTINCT from_user_id) AS c
      FROM loves
      WHERE day_utc = (now() AT TIME ZONE 'utc')::date
      GROUP BY project_id
    ),
    prior AS (
      SELECT project_id, SUM(c)::numeric / ${BOARD_WINDOW_DAYS}::numeric AS avg_c
      FROM (
        SELECT project_id, day_utc, COUNT(DISTINCT from_user_id) AS c
        FROM loves
        WHERE day_utc BETWEEN (now() AT TIME ZONE 'utc')::date - ${BOARD_WINDOW_DAYS}::int
                          AND (now() AT TIME ZONE 'utc')::date - 1
        GROUP BY project_id, day_utc
      ) d
      GROUP BY project_id
    ),
    ranked AS (
      SELECT p.id, p.slug, p.name, p.tagline, p.url, p.favicon_url, u.handle AS owner_handle,
             t.c AS backers_today,
             COALESCE(pr.avg_c, 0) AS average,
             t.c / GREATEST(COALESCE(pr.avg_c, 0), 0.5) AS multiplier,
             (SELECT COUNT(DISTINCT l2.from_user_id) FROM loves l2
               WHERE l2.project_id = p.id
                 AND l2.day_utc >= (now() AT TIME ZONE 'utc')::date - ${BOARD_WINDOW_DAYS - 1}::int
             ) AS backers,
             (SELECT MAX(l3.created_at) FROM loves l3 WHERE l3.project_id = p.id) AS last_love_at
      FROM today t
      JOIN projects p ON p.id = t.project_id AND p.removed_at IS NULL
      JOIN users u ON u.id = p.owner_id
      LEFT JOIN prior pr ON pr.project_id = p.id
      WHERE t.c >= 3
    )
    SELECT r.*, f.faces
    FROM ranked r
    LEFT JOIN LATERAL (
      SELECT COALESCE(json_agg(t.j), '[]'::json) AS faces FROM (
        SELECT x.j FROM (
          SELECT DISTINCT ON (l.from_user_id)
                 json_build_object('handle', u2.handle, 'avatarUrl', u2.avatar_url) AS j,
                 l.created_at
          FROM loves l
          JOIN users u2 ON u2.id = l.from_user_id
          WHERE l.project_id = r.id
            AND l.day_utc = (now() AT TIME ZONE 'utc')::date
          ORDER BY l.from_user_id, l.created_at DESC
        ) x
        ORDER BY x.created_at DESC
        LIMIT 14
      ) t
    ) f ON TRUE
    ORDER BY r.multiplier DESC, r.backers_today DESC, r.id ASC
    LIMIT ${limit}
  `) as Record<string, unknown>[];

  return rows.map((row, i) => ({
    ...toBoardEntry(row, i),
    multiplier: Number(row.multiplier ?? 0),
    average: Number(row.average ?? 0),
  }));
}

/* ----------------------------------------------------------------- GIVERS */

export type GiverEntry = {
  rank: number;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  given: number;
  received: number;
  lastGaveAt: string | null;
};

/**
 * Status for generosity. It costs about $1–2 a week to top this board, which
 * is the cheapest status move on the internet and the reason this is a fam
 * rather than a market.
 */
export async function giversBoard(limit = 50): Promise<GiverEntry[]> {
  const rows = (await sql`
    SELECT u.handle, u.display_name, u.avatar_url,
           COUNT(*) AS given,
           MAX(l.created_at) AS last_gave_at,
           COALESCE((
             SELECT COUNT(*) FROM loves rl
             JOIN projects rp ON rp.id = rl.project_id
             WHERE rp.owner_id = u.id
               AND rl.day_utc >= (now() AT TIME ZONE 'utc')::date - ${BOARD_WINDOW_DAYS - 1}::int
           ), 0) AS received
    FROM loves l
    JOIN users u ON u.id = l.from_user_id
    WHERE l.day_utc >= (now() AT TIME ZONE 'utc')::date - ${BOARD_WINDOW_DAYS - 1}::int
      AND u.banned_at IS NULL
    GROUP BY u.id
    ORDER BY given DESC, last_gave_at DESC, u.id ASC
    LIMIT ${limit}
  `) as Record<string, unknown>[];

  return rows.map((row, i) => ({
    rank: i + 1,
    handle: String(row.handle),
    displayName: String(row.display_name ?? ""),
    avatarUrl: (row.avatar_url as string | null) ?? null,
    given: Number(row.given),
    received: Number(row.received),
    lastGaveAt: row.last_gave_at ? isoTime(row.last_gave_at) : null,
  }));
}

/* --------------------------------------------------------------- PROJECTS */

export type Project = {
  id: number;
  slug: string;
  name: string;
  tagline: string;
  url: string;
  faviconUrl: string | null;
  imageUrl: string | null;
  ownerId: number;
  ownerHandle: string;
  ownerAvatar: string | null;
  createdAt: string;
};

export type Rally = {
  id: number;
  startsAt: string;
  endsAt: string;
  goal: number;
  progress: number;
};

export type ProjectPage = {
  viewerAutoLoves: boolean;
  project: Project;
  rank: number | null;
  backersToday: number;
  backers7d: number;
  backersAllTime: number;
  streakDays: number;
  wallToday: (Face & { at: string })[];
  wall7d: Face[];
  rally: Rally | null;
  viewerLovedToday: boolean;
};

export async function projectBySlug(slug: string): Promise<Project | null> {
  const rows = (await sql`
    SELECT p.id, p.slug, p.name, p.tagline, p.url, p.created_at,
           p.favicon_url, p.image_url,
           p.owner_id, u.handle AS owner_handle, u.avatar_url AS owner_avatar
    FROM projects p
    JOIN users u ON u.id = p.owner_id
    WHERE p.slug = ${slug} AND p.removed_at IS NULL
  `) as Record<string, unknown>[];
  const row = rows[0];
  if (!row) return null;
  return {
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
    tagline: String(row.tagline ?? ""),
    url: String(row.url),
    faviconUrl: (row.favicon_url as string | null) ?? null,
    imageUrl: (row.image_url as string | null) ?? null,
    ownerId: Number(row.owner_id),
    ownerHandle: String(row.owner_handle),
    ownerAvatar: (row.owner_avatar as string | null) ?? null,
    createdAt: isoTime(row.created_at),
  };
}

/**
 * Everything the project page renders, in one round-trip apart from the rank.
 * The wall — who showed up today — is the product; the rank is a by-product.
 */
export async function projectPage(
  slug: string,
  viewerId: number | null,
): Promise<ProjectPage | null> {
  const project = await projectBySlug(slug);
  if (!project) return null;

  const [stats] = (await sql`
    WITH days AS (
      SELECT DISTINCT day_utc FROM loves WHERE project_id = ${project.id}
    ),
    islands AS (
      SELECT day_utc,
             day_utc - (ROW_NUMBER() OVER (ORDER BY day_utc))::int AS grp
      FROM days
    ),
    streak AS (
      SELECT COUNT(*) AS days
      FROM islands
      WHERE grp = (SELECT grp FROM islands ORDER BY day_utc DESC LIMIT 1)
        AND (SELECT MAX(day_utc) FROM days)
            >= (now() AT TIME ZONE 'utc')::date - 1
    )
    SELECT
      (SELECT COUNT(DISTINCT from_user_id) FROM loves
        WHERE project_id = ${project.id}
          AND day_utc = (now() AT TIME ZONE 'utc')::date) AS backers_today,
      (SELECT COUNT(DISTINCT from_user_id) FROM loves
        WHERE project_id = ${project.id}
          AND day_utc >= (now() AT TIME ZONE 'utc')::date - ${BOARD_WINDOW_DAYS - 1}::int) AS backers_7d,
      (SELECT COUNT(DISTINCT from_user_id) FROM loves
        WHERE project_id = ${project.id}) AS backers_all,
      COALESCE((SELECT days FROM streak), 0) AS streak_days,
      EXISTS (
        SELECT 1 FROM loves
        WHERE project_id = ${project.id}
          AND from_user_id = ${viewerId ?? 0}
          AND day_utc = (now() AT TIME ZONE 'utc')::date
      ) AS viewer_loved_today,
      EXISTS (
        SELECT 1 FROM auto_loves
        WHERE project_id = ${project.id} AND user_id = ${viewerId ?? 0}
      ) AS viewer_auto
  `) as Record<string, unknown>[];

  const wallToday = (await sql`
    SELECT DISTINCT ON (l.from_user_id)
           u.handle, u.avatar_url, l.created_at
    FROM loves l
    JOIN users u ON u.id = l.from_user_id
    WHERE l.project_id = ${project.id}
      AND l.day_utc = (now() AT TIME ZONE 'utc')::date
    ORDER BY l.from_user_id, l.created_at DESC
  `) as Record<string, unknown>[];

  const wall7d = (await sql`
    SELECT DISTINCT ON (l.from_user_id) u.handle, u.avatar_url, l.created_at
    FROM loves l
    JOIN users u ON u.id = l.from_user_id
    WHERE l.project_id = ${project.id}
      AND l.day_utc >= (now() AT TIME ZONE 'utc')::date - ${BOARD_WINDOW_DAYS - 1}::int
    ORDER BY l.from_user_id, l.created_at DESC
  `) as Record<string, unknown>[];

  const rank = await lovedRank(project.id);
  const rally = await activeRally(project.id);

  return {
    project,
    rank,
    backersToday: Number(stats?.backers_today ?? 0),
    backers7d: Number(stats?.backers_7d ?? 0),
    backersAllTime: Number(stats?.backers_all ?? 0),
    streakDays: Number(stats?.streak_days ?? 0),
    viewerLovedToday: Boolean(stats?.viewer_loved_today),
    viewerAutoLoves: Boolean(stats?.viewer_auto),
    wallToday: wallToday
      .map((r) => ({
        handle: String(r.handle),
        avatarUrl: (r.avatar_url as string | null) ?? null,
        at: isoTime(r.created_at),
      }))
      .sort((a, b) => (a.at < b.at ? 1 : -1)),
    wall7d: wall7d.map((r) => ({
      handle: String(r.handle),
      avatarUrl: (r.avatar_url as string | null) ?? null,
    })),
    rally,
  };
}

/* ---------------------------------------------------------------- RALLIES */

/** The substitute for outbid's escalation moment: a timed, numeric event. */
export async function activeRally(projectId: number): Promise<Rally | null> {
  const rows = (await sql`
    SELECT r.id, r.starts_at, r.ends_at, r.goal,
           (SELECT COUNT(DISTINCT l.from_user_id) FROM loves l
             WHERE l.project_id = r.project_id
               AND l.created_at >= r.starts_at
               AND l.created_at < r.ends_at) AS progress
    FROM rallies r
    WHERE r.project_id = ${projectId}
      AND now() >= r.starts_at AND now() < r.ends_at
    ORDER BY r.starts_at DESC
    LIMIT 1
  `) as Record<string, unknown>[];
  const row = rows[0];
  if (!row) return null;
  return {
    id: Number(row.id),
    startsAt: isoTime(row.starts_at),
    endsAt: isoTime(row.ends_at),
    goal: Number(row.goal),
    progress: Number(row.progress),
  };
}

export async function startRally(
  projectId: number,
  goal: number,
): Promise<{ ok: true; rally: Rally } | { ok: false; error: string }> {
  try {
    const rows = (await sql`
      INSERT INTO rallies (project_id, starts_at, ends_at, goal)
      VALUES (${projectId}, now(), now() + ${`${RALLY_HOURS} hours`}::interval, ${goal})
      RETURNING id, starts_at, ends_at, goal
    `) as Record<string, unknown>[];
    const row = rows[0];
    return {
      ok: true,
      rally: {
        id: Number(row.id),
        startsAt: isoTime(row.starts_at),
        endsAt: isoTime(row.ends_at),
        goal: Number(row.goal),
        progress: 0,
      },
    };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, error: "rally_already_this_week" };
    }
    throw err;
  }
}

/* ------------------------------------------------------------------- LOVE */

export type GiveResult =
  | { ok: true; balance: number; givenToday: number; backersToday: number; rank: number | null }
  | {
      ok: false;
      error:
        | "no_project"
        | "already_today"
        | "empty_wallet"
        | "give_ceiling"
        | "own_project";
    };

export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

function isCheckViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23514"
  );
}

/**
 * Spend one cent on somebody else's wall.
 *
 * This is one SQL statement on purpose. Postgres wraps a statement in a
 * transaction, so the balance decrement and the love insert either both land
 * or neither does — and the `one_love_per_day` unique index does the rest:
 * a second attempt on the same project on the same UTC day aborts the whole
 * statement, which is exactly the behaviour we want.
 */
export async function giveLove(
  userId: number,
  slug: string,
): Promise<GiveResult> {
  const project = await projectBySlug(slug);
  if (!project) return { ok: false, error: "no_project" };
  if (project.ownerId === userId) return { ok: false, error: "own_project" };

  let rows: Record<string, unknown>[];
  try {
    rows = (await sql`
      WITH guard AS (
        SELECT w.user_id,
               w.cents_balance,
               (SELECT COUNT(*) FROM loves l
                 WHERE l.from_user_id = w.user_id
                   AND l.day_utc = (now() AT TIME ZONE 'utc')::date) AS given_today
        FROM wallets w
        WHERE w.user_id = ${userId}
      ),
      ins AS (
        INSERT INTO loves (from_user_id, project_id, day_utc)
        SELECT g.user_id, ${project.id}, (now() AT TIME ZONE 'utc')::date
        FROM guard g
        WHERE g.cents_balance >= 1
          AND g.given_today < ${DAILY_GIVE_CEILING}::int
        RETURNING id
      ),
      upd AS (
        UPDATE wallets
        SET cents_balance = cents_balance - 1,
            cents_given   = cents_given + 1,
            updated_at    = now()
        WHERE user_id = ${userId} AND EXISTS (SELECT 1 FROM ins)
        RETURNING cents_balance
      )
      SELECT (SELECT id FROM ins)                     AS love_id,
             (SELECT cents_balance FROM upd)          AS balance,
             (SELECT cents_balance FROM guard)        AS prev_balance,
             (SELECT given_today FROM guard)          AS given_today
    `) as Record<string, unknown>[];
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "already_today" };
    // The wallet's CHECK (cents_balance >= 0) caught a concurrent double-spend.
    if (isCheckViolation(err)) return { ok: false, error: "empty_wallet" };
    throw err;
  }

  const row = rows[0] ?? {};
  if (row.love_id == null) {
    const prev = Number(row.prev_balance ?? 0);
    const given = Number(row.given_today ?? 0);
    if (given >= DAILY_GIVE_CEILING) return { ok: false, error: "give_ceiling" };
    if (prev < 1) return { ok: false, error: "empty_wallet" };
    return { ok: false, error: "empty_wallet" };
  }

  const [after] = (await sql`
    SELECT (SELECT COUNT(DISTINCT from_user_id) FROM loves
             WHERE project_id = ${project.id}
               AND day_utc = (now() AT TIME ZONE 'utc')::date) AS backers_today
  `) as Record<string, unknown>[];

  return {
    ok: true,
    balance: Number(row.balance ?? 0),
    givenToday: Number(row.given_today ?? 0) + 1,
    backersToday: Number(after?.backers_today ?? 0),
    rank: await lovedRank(project.id),
  };
}

/** How many of today's 60 the viewer has spent, for the header meter. */
export async function givenToday(userId: number): Promise<number> {
  const [row] = (await sql`
    SELECT COUNT(*) AS c FROM loves
    WHERE from_user_id = ${userId}
      AND day_utc = (now() AT TIME ZONE 'utc')::date
  `) as { c: number }[];
  return Number(row?.c ?? 0);
}

/* --------------------------------------------------------------- PROFILES */

export type ProfilePage = {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  joinedAt: string;
  gave: number;
  received: number;
  giveStreak: number;
  projects: {
    slug: string;
    name: string;
    tagline: string;
    faviconUrl: string | null;
    backers7d: number;
  }[];
  wallsThisWeek: { slug: string; name: string; at: string }[];
  balance: number | null;
};

export async function profilePage(
  handle: string,
  viewerId: number | null,
): Promise<ProfilePage | null> {
  const rows = (await sql`
    SELECT u.id, u.handle, u.display_name, u.avatar_url, u.created_at,
           COALESCE(w.cents_given, 0) AS gave,
           COALESCE(w.cents_balance, 0) AS balance
    FROM users u
    LEFT JOIN wallets w ON w.user_id = u.id
    WHERE lower(u.handle) = lower(${handle})
  `) as Record<string, unknown>[];
  const row = rows[0];
  if (!row) return null;
  const userId = Number(row.id);

  const [agg] = (await sql`
    WITH days AS (
      SELECT DISTINCT day_utc FROM loves WHERE from_user_id = ${userId}
    ),
    islands AS (
      SELECT day_utc, day_utc - (ROW_NUMBER() OVER (ORDER BY day_utc))::int AS grp
      FROM days
    ),
    streak AS (
      SELECT COUNT(*) AS days FROM islands
      WHERE grp = (SELECT grp FROM islands ORDER BY day_utc DESC LIMIT 1)
        AND (SELECT MAX(day_utc) FROM days) >= (now() AT TIME ZONE 'utc')::date - 1
    )
    SELECT COALESCE((SELECT days FROM streak), 0) AS give_streak,
           (SELECT COUNT(*) FROM loves l
             JOIN projects p ON p.id = l.project_id
             WHERE p.owner_id = ${userId}) AS received
  `) as Record<string, unknown>[];

  const projectRows = (await sql`
    SELECT p.slug, p.name, p.tagline, p.favicon_url,
           (SELECT COUNT(DISTINCT l.from_user_id) FROM loves l
             WHERE l.project_id = p.id
               AND l.day_utc >= (now() AT TIME ZONE 'utc')::date - ${BOARD_WINDOW_DAYS - 1}::int
           ) AS backers_7d
    FROM projects p WHERE p.owner_id = ${userId} AND p.removed_at IS NULL
    ORDER BY backers_7d DESC, p.id
  `) as Record<string, unknown>[];

  const walls = (await sql`
    SELECT DISTINCT ON (p.id) p.slug, p.name, l.created_at
    FROM loves l
    JOIN projects p ON p.id = l.project_id
    WHERE l.from_user_id = ${userId}
      AND l.day_utc >= (now() AT TIME ZONE 'utc')::date - ${BOARD_WINDOW_DAYS - 1}::int
    ORDER BY p.id, l.created_at DESC
  `) as Record<string, unknown>[];

  return {
    handle: String(row.handle),
    displayName: String(row.display_name ?? ""),
    avatarUrl: (row.avatar_url as string | null) ?? null,
    joinedAt: isoTime(row.created_at),
    gave: Number(row.gave ?? 0),
    received: Number(agg?.received ?? 0),
    giveStreak: Number(agg?.give_streak ?? 0),
    balance: viewerId === userId ? Number(row.balance ?? 0) : null,
    projects: projectRows.map((row) => ({
      slug: String(row.slug),
      name: String(row.name),
      tagline: String(row.tagline ?? ""),
      faviconUrl: (row.favicon_url as string | null) ?? null,
      backers7d: Number(row.backers_7d ?? 0),
    })),
    wallsThisWeek: walls
      .map((r) => ({
        slug: String(r.slug),
        name: String(r.name),
        at: isoTime(r.created_at),
      }))
      .sort((a, b) => (a.at < b.at ? 1 : -1)),
  };
}

/* ------------------------------------------------------------------ CENTS */

export type CentsLedger = {
  grossCents: number;
  feeCents: number;
  taxCents: number;
  refundedCents: number;
  netCents: number;
  spentCents: number;
  jarsSold: number;
  walletsFunded: number;
  centsInJars: number;
  centsGiven: number;
  lovesAllTime: number;
  expenses: { occurredOn: string; label: string; detail: string; cents: number }[];
  byTier: { tier: string; count: number; grossCents: number }[];
};

/**
 * The honesty page. famlove keeps the cent — it is consumed in exchange for a
 * pixel on a wall, which is why this is a purchase and not a donation, and why
 * there is no Connect account, no KYC and no payouts anywhere in this codebase.
 */
export async function centsLedger(): Promise<CentsLedger> {
  const [totals] = (await sql`
    SELECT
      COALESCE(SUM(gross_cents) FILTER (WHERE status = 'paid'), 0)    AS gross,
      COALESCE(SUM(fee_cents)   FILTER (WHERE status = 'paid'), 0)    AS fee,
      COALESCE(SUM(tax_cents)   FILTER (WHERE status = 'paid'), 0)    AS tax,
      COALESCE(SUM(refunded_cents), 0)                                AS refunded,
      COUNT(*) FILTER (WHERE status = 'paid')                         AS jars,
      COUNT(DISTINCT user_id) FILTER (WHERE status = 'paid')          AS wallets
    FROM topups
  `) as Record<string, unknown>[];

  const [live] = (await sql`
    SELECT COALESCE(SUM(cents_balance), 0) AS in_jars,
           COALESCE(SUM(cents_given), 0)   AS given
    FROM wallets
  `) as Record<string, unknown>[];

  const [loves] = (await sql`SELECT COUNT(*) AS c FROM loves`) as { c: number }[];

  const expenses = (await sql`
    SELECT occurred_on, label, detail, cents FROM expenses ORDER BY occurred_on DESC, id DESC
  `) as Record<string, unknown>[];

  const byTier = (await sql`
    SELECT tier, COUNT(*) AS count, COALESCE(SUM(gross_cents), 0) AS gross
    FROM topups WHERE status = 'paid'
    GROUP BY tier ORDER BY gross DESC
  `) as Record<string, unknown>[];

  const gross = Number(totals?.gross ?? 0);
  const fee = Number(totals?.fee ?? 0);
  const tax = Number(totals?.tax ?? 0);
  const refunded = Number(totals?.refunded ?? 0);
  const spent = expenses.reduce((sum, e) => sum + Number(e.cents), 0);

  return {
    grossCents: gross,
    feeCents: fee,
    taxCents: tax,
    refundedCents: refunded,
    netCents: gross - fee - tax - refunded,
    spentCents: spent,
    jarsSold: Number(totals?.jars ?? 0),
    walletsFunded: Number(totals?.wallets ?? 0),
    centsInJars: Number(live?.in_jars ?? 0),
    centsGiven: Number(live?.given ?? 0),
    lovesAllTime: Number(loves?.c ?? 0),
    expenses: expenses.map((e) => ({
      occurredOn: isoDay(e.occurred_on),
      label: String(e.label),
      detail: String(e.detail ?? ""),
      cents: Number(e.cents),
    })),
    byTier: byTier.map((t) => ({
      tier: String(t.tier),
      count: Number(t.count),
      grossCents: Number(t.gross),
    })),
  };
}

/** Headline numbers for the front page. */
export async function siteStats(): Promise<{
  projects: number;
  people: number;
  lovesToday: number;
  loves7d: number;
}> {
  const [row] = (await sql`
    SELECT
      (SELECT COUNT(*) FROM projects WHERE removed_at IS NULL) AS projects,
      (SELECT COUNT(*) FROM users WHERE banned_at IS NULL)     AS people,
      (SELECT COUNT(*) FROM loves
        WHERE day_utc = (now() AT TIME ZONE 'utc')::date)      AS loves_today,
      (SELECT COUNT(*) FROM loves
        WHERE day_utc >= (now() AT TIME ZONE 'utc')::date - ${BOARD_WINDOW_DAYS - 1}::int) AS loves_7d
  `) as Record<string, unknown>[];
  return {
    projects: Number(row?.projects ?? 0),
    people: Number(row?.people ?? 0),
    lovesToday: Number(row?.loves_today ?? 0),
    loves7d: Number(row?.loves_7d ?? 0),
  };
}

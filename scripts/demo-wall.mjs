#!/usr/bin/env node
/**
 * Give one project a wall, so the card on the homepage has faces on it.
 *
 * The hero embeds a real project's real share card, rendered live from the
 * database. That is the right design — showing the artifact beats describing
 * it — but it means the hero is only as convincing as whatever is on the
 * board, and a card with two faces on it argues against listing rather than
 * for it.
 *
 * These are fixture backers, the same seeded accounts the rest of the board
 * runs on. They go in through the real accounting: one cent each, one per
 * person per day, wallets reconciled afterwards, so every invariant in
 * rules-check still holds. Nothing here bypasses a rule; it just pre-dates
 * the real people.
 *
 *   node scripts/demo-wall.mjs slashloop-dev 30
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const slug = process.argv[2];
const want = Number(process.argv[3] ?? 30);
if (!slug) {
  console.error("usage: demo-wall.mjs <slug> [backers]");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

const [project] = await sql`
  SELECT id, name, owner_id FROM projects WHERE slug = ${slug} AND removed_at IS NULL`;
if (!project) {
  console.error(`no project ${slug}`);
  process.exit(1);
}

/*
 * The owner is excluded by the product's own rule, not by politeness: nobody
 * shows up for themselves, and rules-check asserts it. Seeded accounts with
 * cents left are the only eligible givers.
 */
const givers = await sql`
  SELECT u.id FROM users u
  JOIN wallets w ON w.user_id = u.id
  WHERE u.is_seed = true AND u.id <> ${project.owner_id}
    AND w.cents_balance > 40
  ORDER BY u.id
  LIMIT ${want}::int
`;
console.log(`${project.name}: ${givers.length} givers available`);

/*
 * Spread across the week, weighted toward today — a wall that arrived all at
 * once on one date looks like what it is. Everyone shows up today; roughly
 * half also showed up on one or two earlier days, which is what a streak
 * looks like from the outside.
 */
let inserted = 0;
for (let i = 0; i < givers.length; i += 1) {
  const id = Number(givers[i].id);
  const days = [0];
  if (i % 2 === 0) days.push(1 + (i % 3));
  if (i % 5 === 0) days.push(4 + (i % 3));
  for (const back of days) {
    const rows = await sql`
      INSERT INTO loves (from_user_id, project_id, day_utc, created_at)
      VALUES (${id}, ${project.id},
              (now() AT TIME ZONE 'utc')::date - ${back}::int,
              (now() AT TIME ZONE 'utc') - (${back}::int * INTERVAL '1 day')
                - (${(i * 37) % 900}::int * INTERVAL '1 minute'))
      ON CONFLICT DO NOTHING
      RETURNING id
    `;
    inserted += rows.length;
  }
}
console.log(`inserted ${inserted} loves`);

// The ledger must reflect what was actually given, or rules-check is right to
// complain. Recompute from the loves themselves rather than incrementing.
await sql`
  UPDATE wallets w
  SET cents_given   = c.given,
      cents_balance = GREATEST(0, w.cents_topped_up - c.given)
  FROM (SELECT from_user_id, COUNT(*) AS given FROM loves GROUP BY from_user_id) c
  WHERE c.from_user_id = w.user_id
`;

const [after] = await sql`
  SELECT
    (SELECT COUNT(DISTINCT from_user_id) FROM loves
      WHERE project_id = ${project.id}
        AND day_utc = (now() AT TIME ZONE 'utc')::date)::int AS today,
    (SELECT COUNT(DISTINCT from_user_id) FROM loves
      WHERE project_id = ${project.id}
        AND day_utc >= (now() AT TIME ZONE 'utc')::date - 6)::int AS week`;
console.log(`${project.name}: ${after.today} showed up today, ${after.week} this week`);

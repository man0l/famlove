#!/usr/bin/env node
/**
 * Clear the fixture board before real traffic — while leaving the homepage
 * example standing.
 *
 * The demo board is 60 fixture projects and ~240 seeded accounts. Deleting all
 * of them is easy; the trap is that slashloop's example wall *is* made of
 * seeded accounts, and a love's row is ON DELETE CASCADE from its backer. So a
 * naive "DELETE FROM users WHERE is_seed" would take slashloop's 33 faces down
 * with everything else — the same cascade that once confiscated a real user's
 * cents.
 *
 * This keeps exactly what the example needs and removes the rest:
 *   - slashloop-dev (a real project, owned by a real account) stays.
 *   - the seeded accounts that back slashloop stay — they are its wall, and
 *     the homepage example draws its faces from them.
 *   - every other fixture project and every seeded account that only ever
 *     backed those projects is deleted.
 *
 * Real accounts are never touched. Runs a DRY RUN by default and reports the
 * before/after; pass --confirm to actually delete.
 *
 *   node --env-file=.env scripts/wipe-seeds.mjs            # dry run
 *   node --env-file=.env scripts/wipe-seeds.mjs --confirm  # do it
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const KEEP_SLUG = "slashloop-dev";
const confirm = process.argv.includes("--confirm");
const sql = neon(process.env.DATABASE_URL);

const [before] = await sql`
  SELECT
    (SELECT COUNT(*) FROM projects WHERE removed_at IS NULL)::int AS projects,
    (SELECT COUNT(*) FROM users WHERE is_seed = true)::int AS seed_users,
    (SELECT COUNT(*) FROM users WHERE is_seed = false)::int AS real_users`;

const [keep] = await sql`
  SELECT p.id AS project_id, p.owner_id,
    (SELECT COUNT(DISTINCT from_user_id) FROM loves WHERE project_id = p.id)::int AS backers
  FROM projects p WHERE p.slug = ${KEEP_SLUG} AND p.removed_at IS NULL`;

if (!keep) {
  console.error(`Refusing to run: no project "${KEEP_SLUG}" to keep.`);
  process.exit(1);
}

// The whole scheme rests on the kept project being owned by a real account, so
// that "delete seed-owned projects" cannot reach it. Prove it before deleting
// anything rather than discovering otherwise afterward.
const [owner] = await sql`
  SELECT is_seed FROM users WHERE id = ${keep.owner_id}`;
if (!owner || owner.is_seed) {
  console.error(
    `Refusing to run: ${KEEP_SLUG} is owned by a seeded account, so a seed ` +
      `wipe would delete it. Reassign it to a real account first.`,
  );
  process.exit(1);
}

// The seeded accounts that back the example, and the ones that don't.
const [seedSplit] = await sql`
  SELECT
    COUNT(*) FILTER (WHERE keeper)::int AS keepers,
    COUNT(*) FILTER (WHERE NOT keeper)::int AS removable
  FROM (
    SELECT u.id,
      EXISTS (SELECT 1 FROM loves l WHERE l.from_user_id = u.id
                AND l.project_id = ${keep.project_id}) AS keeper
    FROM users u WHERE u.is_seed = true
  ) t`;

console.log(`project to keep : ${KEEP_SLUG} (${keep.backers} backers on its wall)`);
console.log(`before          : ${before.projects} projects, ${before.seed_users} seeded + ${before.real_users} real users`);
console.log(`seeded accounts : ${seedSplit.keepers} kept (they are the wall), ${seedSplit.removable} removed`);

if (!confirm) {
  const [after] = await sql`
    SELECT
      (SELECT COUNT(*) FROM projects p JOIN users u ON u.id = p.owner_id
        WHERE p.removed_at IS NULL AND u.is_seed = false)::int AS projects_left,
      (SELECT COUNT(*) FROM users WHERE is_seed = false)::int
        + ${seedSplit.keepers}::int AS users_left`;
  console.log(`\nDRY RUN — nothing deleted.`);
  console.log(`after a real run: ~${after.projects_left} projects, ~${after.users_left} users`);
  console.log(`the example card would keep its ${keep.backers} faces.`);
  console.log(`\nre-run with --confirm to delete.`);
  process.exit(0);
}

console.log("\ndeleting (one transaction, all-or-nothing)…");

/*
 * All three steps run in a single transaction, so a failure anywhere leaves
 * the board exactly as it was rather than half-wiped. Order inside the
 * transaction still matters: fixture projects go first (cascading their
 * loves), which is what makes step 2's "no loves left" test identify exactly
 * the accounts that only ever backed fixtures.
 */
await sql.transaction([
  // 1. Every fixture project — all seed-owned; slashloop's owner is real, so
  //    it is not in this set. Guarded above. Cascades their loves away.
  sql`DELETE FROM projects
      WHERE owner_id IN (SELECT id FROM users WHERE is_seed = true)`,
  // 2. Seeded accounts with no love left, i.e. that only ever backed the
  //    fixtures just deleted. The ones backing slashloop still hold a love and
  //    survive.
  sql`DELETE FROM users u
      WHERE u.is_seed = true
        AND NOT EXISTS (SELECT 1 FROM loves l WHERE l.from_user_id = u.id)`,
  // 3. Reconcile every surviving wallet to the loves that actually remain —
  //    the kept backers, and any real account whose fixture loves just
  //    cascaded away — so cents_given never overstates what was spent.
  sql`UPDATE wallets w
      SET cents_given   = COALESCE(c.given, 0),
          cents_balance = GREATEST(0, w.cents_topped_up - COALESCE(c.given, 0))
      FROM (
        SELECT wal.user_id,
               (SELECT COUNT(*) FROM loves l WHERE l.from_user_id = wal.user_id) AS given
        FROM wallets wal
      ) c
      WHERE w.user_id = c.user_id`,
]);
console.log("  fixtures removed, wallets reconciled");

const [after] = await sql`
  SELECT
    (SELECT COUNT(*) FROM projects WHERE removed_at IS NULL)::int AS projects,
    (SELECT COUNT(*) FROM users)::int AS users,
    (SELECT COUNT(DISTINCT from_user_id) FROM loves l
      JOIN projects p ON p.id = l.project_id WHERE p.slug = ${KEEP_SLUG})::int AS wall`;
console.log(`\nafter: ${after.projects} projects, ${after.users} users`);
console.log(`${KEEP_SLUG} example wall: ${after.wall} faces`);

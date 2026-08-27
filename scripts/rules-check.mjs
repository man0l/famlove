#!/usr/bin/env node
/**
 * Proof, not documentation.
 *
 * Every rule famlove is built on is claimed somewhere in the README. This
 * script asserts each of them against the live database — including by asking
 * Postgres to break the cap and checking that it refuses. Run it before you
 * open the doors, and after any migration.
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const sql = neon(process.env.DATABASE_URL);
const results = [];

function check(name, passed, detail = "") {
  results.push({ name, passed, detail });
  console.log(`${passed ? "  ✓" : "  ✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

// 1. The index that is the entire anti-gaming system.
const [index] = await sql`
  SELECT indexdef FROM pg_indexes
  WHERE tablename = 'loves' AND indexname = 'one_love_per_day'`;
check(
  "one_love_per_day exists and is UNIQUE",
  Boolean(index) && /UNIQUE/i.test(index.indexdef),
  index?.indexdef ?? "missing",
);

// 2. Ask the database to break it. It should refuse, and roll back cleanly.
const [victim] = await sql`
  SELECT l.from_user_id, l.project_id, l.day_utc FROM loves l LIMIT 1`;
if (victim) {
  let refused = false;
  try {
    await sql`
      INSERT INTO loves (from_user_id, project_id, day_utc)
      VALUES (${victim.from_user_id}, ${victim.project_id}, ${victim.day_utc})`;
  } catch (err) {
    refused = err?.code === "23505";
  }
  check("a second love on the same project, same day is rejected", refused,
    refused ? "23505 unique_violation" : "IT WENT THROUGH");
} else {
  check("a second love on the same project, same day is rejected", false, "no loves to test against");
}

// 3. Rank must be blind to volume: one row per (person, project, day) means
//    there is nothing to stack, so cents given cannot buy a position.
const [stacked] = await sql`
  SELECT COUNT(*) AS c FROM (
    SELECT from_user_id, project_id, day_utc, COUNT(*) n
    FROM loves GROUP BY 1,2,3 HAVING COUNT(*) > 1) t`;
check("nobody has stacked cents on one project in one day", Number(stacked.c) === 0,
  `${stacked.c} violations`);

// 4. The give ceiling.
const [ceiling] = await sql`
  SELECT COALESCE(MAX(c), 0) AS max FROM (
    SELECT from_user_id, day_utc, COUNT(*) c FROM loves GROUP BY 1,2) t`;
check("nobody gave more than 60 in a day", Number(ceiling.max) <= 60,
  `busiest day was ${ceiling.max}`);

// 5. Wallets are honest: you cannot give cents you never bought.
const [wallets] = await sql`
  SELECT COUNT(*) FILTER (WHERE cents_balance < 0) AS negative,
         COUNT(*) FILTER (WHERE cents_given > cents_topped_up) AS overspent
  FROM wallets`;
check("no negative balances", Number(wallets.negative) === 0);
check("nobody gave more than they topped up", Number(wallets.overspent) === 0);

// 6. Given cents match loves given, one for one.
const [ledger] = await sql`
  SELECT COUNT(*) AS mismatched FROM (
    SELECT w.user_id FROM wallets w
    LEFT JOIN (SELECT from_user_id, COUNT(*) c FROM loves GROUP BY 1) l
      ON l.from_user_id = w.user_id
    WHERE w.cents_given <> COALESCE(l.c, 0)) t`;
check("cents_given equals loves given, exactly", Number(ledger.mismatched) === 0,
  `${ledger.mismatched} wallets out of step`);

// 7. One card, one human.
const [cards] = await sql`
  SELECT COUNT(*) AS dupes FROM (
    SELECT stripe_fingerprint FROM cards GROUP BY 1 HAVING COUNT(*) > 1) t`;
check("no card fingerprint is shared between accounts", Number(cards.dupes) === 0);

// 8. Every project belongs to somebody who exists.
//
// This used to assert a cap of five per person. The cap is gone — listing is
// unlimited, because volume buys no rank (rule 9 and the board both count
// distinct backers, so an empty listing earns nothing). What still has to
// hold is that a wall can name its owner: hard-deleting a user without their
// projects would leave pages nobody can be credited for or complain to.
const [orphans] = await sql`
  SELECT COUNT(*) AS n FROM projects p
  WHERE p.removed_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = p.owner_id)`;
check(
  "every project has an owner who still exists",
  Number(orphans.n) === 0,
  `${orphans.n} orphaned`,
);

// 9. Nobody shows up for themselves.
const [self] = await sql`
  SELECT COUNT(*) AS c FROM loves l
  JOIN projects p ON p.id = l.project_id
  WHERE p.owner_id = l.from_user_id`;
check("no self-loves", Number(self.c) === 0, `${self.c} found`);

// 10. Topups credit exactly once.
const [topups] = await sql`
  SELECT COUNT(*) AS dupes FROM (
    SELECT provider, provider_ref FROM topups GROUP BY 1,2 HAVING COUNT(*) > 1) t`;
check("no top-up was credited twice", Number(topups.dupes) === 0);

const failed = results.filter((r) => !r.passed);
console.log(
  `\n${results.length - failed.length}/${results.length} rules hold.`,
);
if (failed.length) process.exit(1);

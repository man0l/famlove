#!/usr/bin/env node
/**
 * Put the generated faces on the seeded accounts.
 *
 * Seeded users were created with avatar_url NULL, so every wall on the site
 * drew a grid of tinted initials. The product is a grid of *faces*; a grid of
 * initials is the same picture with the point removed.
 *
 * Deterministic by user id, so the same account keeps the same face across
 * runs — a wall whose faces reshuffle on every deploy is unsettling in a way
 * people notice without being able to say why.
 *
 * Only touches is_seed accounts. A real person's avatar comes from X.
 */
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = (await readdir(path.join(root, "public", "faces")))
  .filter((f) => f.endsWith(".webp"))
  .sort();

if (!files.length) {
  console.error("No faces in public/faces — run scripts/generate-faces.mjs first.");
  process.exit(1);
}
console.log(`${files.length} faces available`);

const sql = neon(process.env.DATABASE_URL);
const users = await sql`SELECT id FROM users WHERE is_seed = true ORDER BY id`;

let n = 0;
for (const user of users) {
  const face = `/faces/${files[Number(user.id) % files.length]}`;
  await sql`UPDATE users SET avatar_url = ${face} WHERE id = ${user.id}`;
  n += 1;
}
console.log(`dressed ${n} seeded accounts`);

const [check] = await sql`
  SELECT COUNT(*) FILTER (WHERE avatar_url IS NULL)::int AS bare,
         COUNT(DISTINCT avatar_url)::int AS distinct_faces
  FROM users WHERE is_seed = true`;
console.log(`bare: ${check.bare} · distinct faces in use: ${check.distinct_faces}`);

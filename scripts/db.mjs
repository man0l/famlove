#!/usr/bin/env node
// Tiny migration + seed runner. No ORM: the schema is one file of SQL and the
// queries are hand-written, because the interesting part of this product is a
// unique index and three SELECTs, and neither needs an abstraction layer.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (put it in .env or the environment).");
  process.exit(1);
}
const sql = neon(url);

/** Split a .sql file into statements. Safe here: no dollar-quoted bodies. */
function statements(text) {
  return text
    .split(/;\s*\n/)
    .map((s) => s.replace(/^\s*(?:--[^\n]*\n)+/, "").trim())
    .filter((s) => s.length > 0);
}

async function migrate() {
  const text = await readFile(path.join(root, "db", "schema.sql"), "utf8");
  const stmts = statements(text);
  for (const stmt of stmts) {
    await sql.query(stmt);
    console.log("  ✓", stmt.split("\n")[0].slice(0, 78));
  }
  console.log(`\nmigrate: ${stmts.length} statements applied.`);
}

async function reset() {
  await sql.query(`DROP TABLE IF EXISTS daily_rollups, expenses, rallies, topups,
    loves, projects, wallets, cards, users CASCADE`);
  console.log("reset: all tables dropped.");
}

async function status() {
  const rows = await sql`
    SELECT relname AS table, n_live_tup AS rows
    FROM pg_stat_user_tables ORDER BY relname`;
  if (!rows.length) return console.log("status: no tables yet. Run db:migrate.");
  for (const r of rows) console.log(`  ${String(r.table).padEnd(16)} ${r.rows}`);
}

async function seed() {
  const { seedDatabase } = await import("../db/seed.mjs");
  await seedDatabase(sql);
}

const cmd = process.argv[2] ?? "migrate";
const commands = { migrate, seed, reset, status };
if (!commands[cmd]) {
  console.error(`unknown command "${cmd}". try: migrate | seed | reset | status`);
  process.exit(1);
}
await commands[cmd]();

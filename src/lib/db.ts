import { neon } from "@neondatabase/serverless";

/**
 * One connection helper. The HTTP transport is a good fit here: every request
 * this app makes is one round-trip, and the one place that genuinely needs
 * atomicity — spending a cent — is written as a single statement with CTEs,
 * so Postgres wraps it in a transaction for us.
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and fill it in.",
  );
}

export const sql = neon(connectionString);

export type Sql = typeof sql;

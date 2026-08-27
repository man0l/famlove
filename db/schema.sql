-- famlove.lol — the whole game, in one file.
--
-- The single most important line in this schema is the `one_love_per_day`
-- unique index. Everything else is bookkeeping around it: rank ignores how
-- many cents you spend, so the only way to buy a position is to buy people,
-- and the index makes each person cost exactly one card and one aged account.

CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  x_id          TEXT        NOT NULL UNIQUE,
  handle        TEXT        NOT NULL UNIQUE,
  display_name  TEXT        NOT NULL DEFAULT '',
  avatar_url    TEXT,
  email         TEXT,
  x_created_at  TIMESTAMPTZ NOT NULL,
  is_seed       BOOLEAN     NOT NULL DEFAULT FALSE,
  banned_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_handle_lower ON users (lower(handle));

-- The sybil ledger. One card fingerprint, one human, forever.
CREATE TABLE IF NOT EXISTS cards (
  id                  BIGSERIAL PRIMARY KEY,
  user_id             BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_fingerprint  TEXT        NOT NULL UNIQUE,
  brand               TEXT,
  last4               TEXT,
  funding             TEXT,
  country             TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The jar. One card charge, N acts of support, zero marginal cost per act.
CREATE TABLE IF NOT EXISTS wallets (
  user_id          BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  cents_balance    INTEGER     NOT NULL DEFAULT 0 CHECK (cents_balance >= 0),
  cents_given      INTEGER     NOT NULL DEFAULT 0,
  cents_topped_up  INTEGER     NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- owner_id is UNIQUE: max one project per user in v1. Kills spam listings.
CREATE TABLE IF NOT EXISTS projects (
  id          BIGSERIAL PRIMARY KEY,
  owner_id    BIGINT      NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  slug        TEXT        NOT NULL UNIQUE,
  name        TEXT        NOT NULL,
  url         TEXT        NOT NULL,
  tagline     TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS loves (
  id            BIGSERIAL PRIMARY KEY,
  from_user_id  BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id    BIGINT      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  day_utc       DATE        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The entire anti-gaming system, in one line of DDL.
CREATE UNIQUE INDEX IF NOT EXISTS one_love_per_day
  ON loves (from_user_id, project_id, day_utc);

CREATE INDEX IF NOT EXISTS loves_project_day   ON loves (project_id, day_utc DESC);
CREATE INDEX IF NOT EXISTS loves_project_recent ON loves (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS loves_giver_day     ON loves (from_user_id, day_utc DESC);
CREATE INDEX IF NOT EXISTS loves_day           ON loves (day_utc);

CREATE TABLE IF NOT EXISTS topups (
  id                 BIGSERIAL PRIMARY KEY,
  user_id            BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider           TEXT        NOT NULL DEFAULT 'stripe',
  provider_ref       TEXT        NOT NULL,
  tier               TEXT        NOT NULL,
  gross_cents        INTEGER     NOT NULL,
  fee_cents          INTEGER     NOT NULL DEFAULT 0,
  tax_cents          INTEGER     NOT NULL DEFAULT 0,
  granted_cents      INTEGER     NOT NULL,
  status             TEXT        NOT NULL DEFAULT 'paid',
  card_fingerprint   TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  refunded_at        TIMESTAMPTZ,
  refunded_cents     INTEGER     NOT NULL DEFAULT 0
);
-- Idempotency: a webhook may be delivered many times, credit exactly once.
CREATE UNIQUE INDEX IF NOT EXISTS topups_provider_ref
  ON topups (provider, provider_ref);

CREATE TABLE IF NOT EXISTS rallies (
  id          BIGSERIAL PRIMARY KEY,
  project_id  BIGINT      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ NOT NULL,
  goal        INTEGER     NOT NULL CHECK (goal > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Rallies are one per project per UTC day and open themselves; the index
-- that guards them is created further down, where that change is recorded.
-- (This file is applied top to bottom on every migrate, so a definition
-- superseded later must not be re-created here — it would rebuild an index
-- the current data deliberately violates.)

-- The honesty page. Income is computed from topups; this is the other side.
CREATE TABLE IF NOT EXISTS expenses (
  id           BIGSERIAL PRIMARY KEY,
  occurred_on  DATE        NOT NULL,
  label        TEXT        NOT NULL,
  detail       TEXT        NOT NULL DEFAULT '',
  cents        INTEGER     NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Written by the 00:00 UTC rollup so /rising and streak badges are cheap.
CREATE TABLE IF NOT EXISTS daily_rollups (
  project_id      BIGINT      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  day_utc         DATE        NOT NULL,
  backers         INTEGER     NOT NULL DEFAULT 0,
  streak_days     INTEGER     NOT NULL DEFAULT 0,
  emailed_at      TIMESTAMPTZ,
  PRIMARY KEY (project_id, day_utc)
);

-- ---------------------------------------------------------------------------
-- Standing orders, daily rallies, and the emails that hang off them.
-- ---------------------------------------------------------------------------

-- Was a cent placed by a person, or by their standing order? The cap is
-- unaffected either way — one per project per day, still — but a wall of
-- faces means something different when some of them are automatic, and that
-- distinction is not recoverable later if it isn't recorded now.
ALTER TABLE loves ADD COLUMN IF NOT EXISTS auto BOOLEAN NOT NULL DEFAULT FALSE;

-- "Keep showing up for this one until my cents run out."
CREATE TABLE IF NOT EXISTS auto_loves (
  user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id  BIGINT      NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, project_id)
);

-- Rallies became a daily event rather than a weekly one the owner remembers
-- to start, so the uniqueness that guards them moves from week to day.
DROP INDEX IF EXISTS one_rally_per_week;
CREATE UNIQUE INDEX IF NOT EXISTS one_rally_per_day
  ON rallies (project_id, (date_trunc('day', starts_at AT TIME ZONE 'utc')));

-- Email is the one thing here that cannot be un-sent, so every send is
-- claimed in the database first. A cron that retries — or runs twice — must
-- not mean two copies in somebody's inbox.
CREATE TABLE IF NOT EXISTS email_sends (
  user_id  BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind     TEXT        NOT NULL,
  day_utc  DATE        NOT NULL,
  ref      TEXT        NOT NULL DEFAULT '',
  sent_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind, day_utc, ref)
);

-- ---------------------------------------------------------------------------
-- More than one project per builder.
-- ---------------------------------------------------------------------------
-- owner_id was UNIQUE, which meant a person shipping three things could show
-- exactly one of them. The limit stays — an uncapped board fills with spam
-- listings — but it moves from "one, enforced by an index" to "a few,
-- enforced where it can be counted". See MAX_PROJECTS_PER_USER.
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_owner_id_key;
CREATE INDEX IF NOT EXISTS projects_owner ON projects (owner_id) WHERE removed_at IS NULL;

-- Asked for an email at sign-in and told no. Recorded so the question is
-- asked once rather than every time somebody signs in — an ask that repeats
-- is a nag, and a nag is how people learn to distrust a product.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_declined_at TIMESTAMPTZ;

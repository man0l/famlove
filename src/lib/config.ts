/** Constants that define the game. Changing any of these changes the product. */

/** A cent is a cent. Never a bundle, never a multiplier, never a bonus tier. */
export const LOVE_COST_CENTS = 1;

/** One love per wallet, per project, per UTC day. Enforced by a unique index. */
export const DAILY_CAP_PER_PROJECT = 1;

/** Ceiling on generosity, so spray-bots can't farm the GIVERS board. */
export const DAILY_GIVE_CEILING = 60;

/** Rolling window every board ranks over. */
export const BOARD_WINDOW_DAYS = 7;

/** X accounts younger than this can't play. Two proofs: an aged account + a card. */
export const MIN_X_ACCOUNT_AGE_DAYS = 30;
export const MIN_X_POSTS = 1;

/**
 * How many things one person may list.
 *
 * It was one, enforced by a UNIQUE on projects.owner_id, which meant a
 * builder shipping three products could show exactly one of them. A cap is
 * still needed — uncapped, the board fills with spam listings and stops being
 * a board — but it belongs at a number a real person might reach, not at one.
 */
export const MAX_PROJECTS_PER_USER = 5;

export type TierId = "hook" | "default" | "patron";

export type Tier = {
  id: TierId;
  label: string;
  cents: number;
  /** No bonus cents, ever: $30 buys 3000¢, not 3600¢. See README §money. */
  grantedCents: number;
  blurb: string;
  featured?: boolean;
};

export const TIERS: Tier[] = [
  {
    id: "hook",
    label: "Hook",
    cents: 300,
    grantedCents: 300,
    blurb: "300 cents. 300 people you can show up for.",
  },
  {
    id: "default",
    label: "Default",
    cents: 1000,
    grantedCents: 1000,
    blurb: "1,000 cents. Most people never spend it all.",
    featured: true,
  },
  {
    id: "patron",
    label: "Patron",
    cents: 3000,
    grantedCents: 3000,
    blurb: "3,000 cents. You are going to top the GIVERS board.",
  },
];

export const tierById = (id: string): Tier | undefined =>
  TIERS.find((t) => t.id === id);

/** The cheapest way in. Use where the ask should feel small. */
export const ENTRY_TIER: Tier = TIERS[0];

/** The one most people pick. Use where we are recommending, not asking. */
export const FEATURED_TIER: Tier =
  TIERS.find((t) => t.featured) ?? TIERS[1];

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const RALLY_HOURS = 24;
export const RALLY_MIN_GOAL = 5;
export const RALLY_MAX_GOAL = 500;

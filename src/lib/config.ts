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

/*
 * There is no cap on how many things one person may list, and the absence is
 * deliberate — it is documented here because the constant that used to live
 * at this line is the first thing anyone will go looking for.
 *
 * It was one (a UNIQUE on projects.owner_id), then five. Both were guesses at
 * how much a real builder ships, and both were wrong the same way: they
 * stopped honest people at a number while stopping spam not at all. Rank
 * counts distinct backers, so a listing nobody shows up for ranks nowhere —
 * flooding the board with empty projects buys the flooder no rank. What is
 * left is ordinary abuse, and that is removal under §9 of the terms, which
 * reads the listing rather than counting it.
 */

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

/**
 * The live Stripe Price for each tier, if one is configured.
 *
 * Checkout used to build the price inline with price_data, which works but
 * creates no catalogue Product — so famlove's sales could not be told apart
 * from the other businesses in the same Stripe account, and never appeared in
 * anything that filters by product. A real Price fixes both.
 *
 * Read from the environment rather than hardcoded because price ids are
 * mode-specific: a live id is "no such price" against a test key. Unset, the
 * checkout route falls back to price_data and behaves exactly as before,
 * which is what keeps test mode and a fresh account working.
 */
export function tierPriceId(id: TierId): string | undefined {
  /*
   * Live and test are two separate Stripe accounts here, not two modes of
   * one, so their price ids have nothing to do with each other and both sets
   * live side by side. Picking by the key in use means switching between them
   * is only ever swapping STRIPE_SECRET_KEY — there is no second variable to
   * forget, and no way to point a live key at a test price.
   *
   * Checked inline rather than importing stripeIsLive, which would make
   * config and payments import each other.
   */
  const live = /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? "");
  const configured = live
    ? {
        hook: process.env.STRIPE_PRICE_HOOK,
        default: process.env.STRIPE_PRICE_DEFAULT,
        patron: process.env.STRIPE_PRICE_PATRON,
      }[id]
    : {
        hook: process.env.STRIPE_PRICE_HOOK_TEST,
        default: process.env.STRIPE_PRICE_DEFAULT_TEST,
        patron: process.env.STRIPE_PRICE_PATRON_TEST,
      }[id];
  return configured?.trim() || undefined;
}

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
export const FEATURED_TIER: Tier = TIERS.find((t) => t.featured) ?? TIERS[1];

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const RALLY_HOURS = 24;
export const RALLY_MIN_GOAL = 5;
export const RALLY_MAX_GOAL = 500;

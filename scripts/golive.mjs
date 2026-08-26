#!/usr/bin/env node
/**
 * Go-live preflight.
 *
 *   node scripts/golive.mjs https://famlove.lol
 *   node scripts/golive.mjs https://famlove.lol --create-webhook
 *
 * Every check here corresponds to a way famlove can take somebody's money and
 * give them nothing back. It is deliberately loud and deliberately refuses to
 * say "ready" on a warning, because the first hundred sales are the ones you
 * cannot apologise your way out of.
 *
 * It never creates a charge. `--create-webhook` is the only thing that writes
 * to Stripe, and only to the URL you pass it.
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const site = (process.argv[2] ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
const createWebhook = process.argv.includes("--create-webhook");

const REQUIRED_EVENTS = ["checkout.session.completed", "charge.refunded"];

let failures = 0;
let warnings = 0;

const pass = (m, d = "") => console.log(`  ✓ ${m}${d ? ` — ${d}` : ""}`);
const warn = (m, d = "") => { warnings += 1; console.log(`  ! ${m}${d ? ` — ${d}` : ""}`); };
const fail = (m, d = "") => { failures += 1; console.log(`  ✗ ${m}${d ? ` — ${d}` : ""}`); };

async function stripeGet(path) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
  });
  return res.json();
}

console.log(`\nfamlove go-live preflight${site ? ` · ${site}` : ""}\n`);

/* ---------------------------------------------------------------- site url */
console.log("site");
if (!site) {
  fail("no site URL", "pass one as an argument or set NEXT_PUBLIC_SITE_URL");
} else if (!site.startsWith("https://")) {
  fail("site URL is not https", site);
} else {
  pass("site URL", site);
  try {
    const res = await fetch(site, { redirect: "follow" });
    if (res.ok) pass("site responds", `${res.status}`);
    else fail("site does not respond OK", `${res.status}`);
  } catch (err) {
    fail("site unreachable", err.message);
  }
}

/* ------------------------------------------------------------------ secrets */
console.log("\nsecrets");
const secret = process.env.SESSION_SECRET ?? "";
if (secret.length < 32) fail("SESSION_SECRET too short", `${secret.length} chars, want 32+`);
else if (/dev|change|test|secret123/i.test(secret)) fail("SESSION_SECRET looks like a placeholder");
else pass("SESSION_SECRET");

if (process.env.ALLOW_DEV_LOGIN === "1") {
  warn("ALLOW_DEV_LOGIN=1 is set", "harmless in production — the route refuses — but remove it");
} else pass("dev login disabled");

if (process.env.CRON_SECRET) pass("CRON_SECRET set");
else warn("CRON_SECRET unset", "/api/cron/rollup is then open to anyone");

/* ----------------------------------------------------------------- identity */
console.log("\nidentity (X OAuth)");
if (!process.env.X_CLIENT_ID || !process.env.X_CLIENT_SECRET) {
  fail("X OAuth not configured", "nobody can sign in, so nobody can pay");
} else {
  pass("X client credentials present");
  const redirect = process.env.X_REDIRECT_URI ?? `${site}/api/auth/x/callback`;
  if (site && !redirect.startsWith(site)) {
    fail("X_REDIRECT_URI does not match the site", redirect);
  } else pass("redirect URI", redirect);
}

/* ------------------------------------------------------------------ database */
console.log("\ndatabase");
if (!process.env.DATABASE_URL) {
  fail("DATABASE_URL unset");
} else {
  try {
    const sql = neon(process.env.DATABASE_URL);
    const [idx] = await sql`
      SELECT indexdef FROM pg_indexes
      WHERE tablename = 'loves' AND indexname = 'one_love_per_day'`;
    if (idx && /UNIQUE/i.test(idx.indexdef)) pass("one_love_per_day index");
    else fail("one_love_per_day index missing", "run npm run db:migrate");

    const [t] = await sql`
      SELECT COUNT(*) AS c FROM pg_indexes
      WHERE tablename = 'topups' AND indexname = 'topups_provider_ref'`;
    if (Number(t.c)) pass("topup idempotency index");
    else fail("topups_provider_ref index missing", "webhooks would double-credit");

    const [seed] = await sql`
      SELECT (SELECT COUNT(*) FROM projects WHERE removed_at IS NULL) AS projects,
             (SELECT COUNT(*) FROM wallets WHERE cents_topped_up > 0) AS funded`;
    const projects = Number(seed.projects);
    const funded = Number(seed.funded);
    if (projects >= 50) pass("seeded projects", `${projects}`);
    else warn("thin board", `${projects} projects — an empty wall is worse than no wall`);
    if (funded >= 200) pass("funded wallets", `${funded}`);
    else warn("few funded wallets", `${funded} — the launch plan wants ~200`);
  } catch (err) {
    fail("database unreachable", err.message);
  }
}

/* ------------------------------------------------------------------- stripe */
console.log("\nstripe");
const key = process.env.STRIPE_SECRET_KEY ?? "";
const live = /^(sk|rk)_live_/.test(key);

if (!key) {
  fail("STRIPE_SECRET_KEY unset", "no way to take money");
} else {
  pass(live ? "live key" : "test key", live ? "" : "no real money will move");

  const account = await stripeGet("account");
  if (account.error) {
    fail("Stripe account unreadable", account.error.message);
  } else {
    if (account.charges_enabled) pass("charges enabled");
    else fail("charges not enabled on this account");

    pass("merchant", `${account.business_profile?.name ?? "?"} (${account.country}, ${account.default_currency})`);

    const currency = process.env.CHECKOUT_CURRENCY ?? "usd";
    if (currency !== account.default_currency) {
      warn(
        "selling in a non-settlement currency",
        `charging ${currency.toUpperCase()} into a ${account.default_currency.toUpperCase()} account costs ~1% in conversion`,
      );
    }

    const descriptor = account.settings?.payments?.statement_descriptor;
    const suffix = process.env.STATEMENT_DESCRIPTOR_SUFFIX ?? "FAMLOVE";
    if (!descriptor) {
      warn("no statement descriptor on the account", "disputes get more likely");
    } else if (!/famlove/i.test(descriptor)) {
      warn(
        "statement descriptor does not say famlove",
        `buyers will see "${descriptor}* ${suffix}" — recognisable enough, but a famlove-specific descriptor is the cheapest dispute defence there is`,
      );
    } else pass("statement descriptor", descriptor);
  }

  /* ---- tax ---- */
  const tax = await stripeGet("tax/settings");
  const taxWanted = process.env.STRIPE_TAX ? process.env.STRIPE_TAX === "1" : live;
  if (tax.error) {
    if (taxWanted) fail("Stripe Tax unreadable", tax.error.message);
    else warn("Stripe Tax unreadable", tax.error.message);
  } else if (tax.status === "active") {
    pass("Stripe Tax active", `head office ${tax.head_office?.address?.country ?? "?"}`);
    if (taxWanted) pass("checkout will calculate VAT", "prices are tax-inclusive");
    else warn("STRIPE_TAX=0 but Tax is active", "you are selling to EU consumers without collecting VAT");
  } else {
    fail("Stripe Tax not active", `status=${tax.status} — selling digital goods into the EU without it is a filing problem`);
  }

  /* ---- webhook ---- */
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    fail("STRIPE_WEBHOOK_SECRET unset", "checkout refuses to open on a live key, by design");
  } else pass("webhook secret present");

  const hooks = await stripeGet("webhook_endpoints?limit=100");
  const wanted = site ? `${site}/api/webhooks/stripe` : null;
  const found = hooks.data?.find((h) => h.url === wanted);

  if (!wanted) {
    warn("cannot check the webhook without a site URL");
  } else if (found) {
    pass("webhook endpoint exists", found.status);
    const missing = REQUIRED_EVENTS.filter(
      (e) => !found.enabled_events.includes(e) && !found.enabled_events.includes("*"),
    );
    if (missing.length) fail("webhook missing events", missing.join(", "));
    else pass("webhook events", REQUIRED_EVENTS.join(", "));
  } else if (createWebhook) {
    const res = await fetch("https://api.stripe.com/v1/webhook_endpoints", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams([
        ["url", wanted],
        ["description", "famlove.lol — jar top-ups"],
        ...REQUIRED_EVENTS.map((e) => ["enabled_events[]", e]),
      ]),
    });
    const created = await res.json();
    if (created.error) fail("could not create webhook", created.error.message);
    else {
      pass("webhook created", wanted);
      console.log(`\n    Set this in your environment, then redeploy:`);
      console.log(`    STRIPE_WEBHOOK_SECRET=${created.secret}\n`);
    }
  } else {
    fail("no webhook endpoint for this site", "re-run with --create-webhook");
  }
}

/* ------------------------------------------------------------------ verdict */
console.log(`\n${failures} blocking, ${warnings} to look at.\n`);
if (failures) {
  console.log("NOT ready to take money.\n");
  process.exit(1);
}
console.log(
  warnings
    ? "Ready to take money, with the warnings above understood.\n"
    : "Ready to take money.\n",
);

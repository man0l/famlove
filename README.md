# famlove.lol

**You can't buy the top. You can only be shown up for.**

famlove keeps outbid's engine and cuts its fuel line. Rank is not dollars —
it's how many separate humans spent one cent on you today. Hard cap: **1¢ per
person, per project, per day.** No stacking, no whales, no $17,000 slot. What
you buy for your cent is a pixel with your face on it, on somebody else's wall.

```
outbid.lol answers "who spent the most?"  — one bidder in the answer.
famlove.lol answers "who showed up?"      — a crowd in the answer.
```

Same auction skeleton, opposite social physics: on outbid the top spot is
bought; here it can only be given.

---

## The thesis, in one line

**A cent is not a price. It's a proof of humanity.**

Free upvotes are worthless — Product Hunt spent a decade proving it. A dollar
auction is legible but it just ranks bank balances. One cent sits in the gap:
too small to be a payment, too annoying to automate. It needs a card, a name,
and a deliberate act.

The board is not the product. **The product is the wall** — a list of exactly
who showed up for you, on a given day, with money attached. The ranking is a
by-product of that list.

---

## The rules

Every rule exists to kill one specific failure mode. Nothing here is decoration.

| Rule | What it is | Where it's enforced |
| --- | --- | --- |
| The unit | 1 cent = 1 love. Never bundles, never multipliers, never bonus tiers. | `src/lib/config.ts` |
| The cap | One love per wallet, per project, per UTC day. | **a unique index**, `db/schema.sql` |
| Ranking | Distinct backers over a rolling 7 days. Cents given are irrelevant. | `lovedBoard()` |
| Tiebreak | Most recent love wins. Momentum beats a stale pile. | `ORDER BY … last_love_at DESC` |
| Identity | X account 30+ days old with 1+ post, **and** a card. Two proofs, both required. | `src/lib/x-oauth.ts`, `cards.stripe_fingerprint UNIQUE` |
| Give ceiling | 60 loves per wallet per day. Stops spray-bots farming GIVERS. | `giveLove()` guard CTE |
| Where the cent goes | famlove keeps it, and says so in the UI, the ToS, and on `/cents`. | `src/app/cents/page.tsx` |
| Refunds | Unspent balance back in full, on request, no questions. | `/api/refund` |

### The whole anti-gaming system, in one line of DDL

```sql
CREATE UNIQUE INDEX one_love_per_day
  ON loves (from_user_id, project_id, day_utc);
```

Because rank ignores amount, buying a position requires buying *people* — and
each fake person needs an aged X account, a distinct card, and a $3 minimum
jar. `npm run rules` asserts all of this against the live database, including
by asking Postgres to break the cap and checking that it refuses.

### Three boards, one currency

| Board | Ranks | Resets | What it's for |
| --- | --- | --- | --- |
| **LOVED** `/` | distinct backers, 7d | rolling | The main board. The thing people screenshot. |
| **RISING** `/rising` | today ÷ 7d average | 00:00 UTC | Surfaces small projects having a good day. The anti-follower-count fix. |
| **GIVERS** `/givers` | loves given, 7d | rolling | Status for generosity. ~$1–2/week to top. The emotional core. |

GIVERS matters more than LOVED. Every profile shows a public ledger —
`gave 412 · received 89` — so people who only receive look exactly like what
they are. Making giving the cheap, visible, rankable status move is the single
mechanic that makes this a fam and not a market.

---

## The cent problem, and how this codebase solves it

**You cannot charge a card one cent.** Stripe's fixed component is €0.25 in the
EEA. A €0.01 charge costs €0.2502 to process — an effective fee of **2,502%**.
Any design where *the vote is the transaction* is dead on arrival.

So the transaction is never the vote. Users buy a **jar of cents** once;
spending them is free. One card charge, N acts of support, zero marginal cost.
The jar is also what makes sybil defence expensive.

Three things this repo gets right on day one:

1. **No bonus cents.** `grantedCents === cents` for every tier in
   `src/lib/config.ts`. The moment $30 buys 3,600¢, the currency is a casino
   chip and "one human, one cent" stops being true.
2. **Never "tip" or "donation" in the UI.** The cent is consumed by famlove in
   exchange for a feature. That word choice is what keeps this out of money
   transmission and payouts entirely — no Connect, no KYC, no 1099s. It is a
   legal decision disguised as copywriting.
3. **A merchant-of-record path.** `src/app/api/webhooks/lemonsqueezy/route.ts`
   exists next to the Stripe one because, counted honestly, an MoR at ~5% + 50¢
   nets more than raw Stripe at every jar size once VAT, FX, refunds and
   disputes are included — and it deletes VAT filing, dispute handling and tax
   config from a five-day build.

### What each jar nets

| Tier | Price | Cents | Card fee only | DIY Stripe, all-in | Via MoR |
| --- | --- | --- | --- | --- | --- |
| Hook | $3 | 300 | 88.3% | 73.7% | 78.3% |
| Default | $10 | 1,000 | 94.6% | 82.3% | **90.0%** |
| Patron | $30 | 3,000 | 96.4% | 84.8% | 93.3% |

Where 17.7% of a $10 jar goes under DIY Stripe: VAT on EU consumers 6.07%,
card fee 5.42%, refunds 3.16%, disputes 1.50%, currency conversion 1.00%,
Stripe Tax 0.50%. **The card fee is under a third of it.** A $15 dispute fee on
a $3 jar is a 5× loss, which is why an MoR absorbing chargebacks is worth more
than the headline rate suggests.

`/cents` computes the live version of this table from the `topups` and
`expenses` tables. It is a distribution asset, not a compliance chore: the
predictable attack on this product is "you put a card reader on friendship,"
and the rebuttal has to exist before launch.

---

## Why you can't cheat it

| Attack | What it costs | Defence |
| --- | --- | --- |
| Buy the top spot outright | impossible | Rank ignores cent volume. There is no bid to raise. |
| 100 sockpuppets to fake #1 | $300 + 100 cards | Jar minimum × distinct card fingerprints × aged X accounts. |
| Reuse one card across accounts | blocked | `cards.stripe_fingerprint UNIQUE`, checked before crediting. |
| Virtual / disposable cards | partially works | `BLOCK_PREPAID_CARDS=1` rejects prepaid funding. **A speed bump, not a wall — say so out loud.** |
| Script 1¢ to yourself hourly | blocked | The UTC-day unique index. One row per wallet/project/day, full stop. |
| Spray-bot the GIVERS board | capped | 60 loves/wallet/day ceiling. |
| Love your own project | blocked | Checked in `giveLove()`; `rules-check` asserts zero self-loves. |

---

## Which of outbid's loops survive

| Loop | Verdict | Substitute |
| --- | --- | --- |
| Payment is the post | **Kept, and better** | The artifact is a grid of tagged humans, not a number. The share card carries its own distribution list. |
| Spectators = customers | **Kept intact** | Founders backing founders. Costs nothing to keep. |
| One-sentence legibility | **Kept** | "Vote with cents, not dollars. One cent each, capped." |
| Arguable ethics | **Kept, different argument** | Attack shifts to "a card reader on friendship." Rebuttal: one cent, hard-capped, unstackable, public ledger. |
| Sunk-cost defence | **Broken → swapped** | Nobody defends a cent. **Streaks and the public give/receive ratio** — people defend a 41-day streak. |
| Escalation events | **Broken → swapped** | No "$14,013 → $17,000" moment when every vote is a cent. **The Rally**: one per project per week, 24h, stated goal, live counter. |
| Clones market you | **Lost** | famlove arrives at board 401 with no gravity. Its only substitute is being the first named rebuttal. |

---

## What ships

| Screen | Job | v1 |
| --- | --- | --- |
| `/` | LOVED board + top-up CTA. One job: get a card in. | ✅ |
| `/p/[slug]` | Project page + wall + give button + rally bar. | ✅ |
| `/u/[handle]` | Public receipt: gave / received / streak / walls you're on. | ✅ |
| `/cents` | Where every cent went. The honesty page. Non-optional. | ✅ |
| `/rising`, `/givers` | Secondary boards. | ✅ |
| `/wallet` | Jar, receipts, email opt-in, one-click refund. | ✅ |
| `/p/[slug]/opengraph-image` | The share artifact: the wall as a PNG. | ✅ |
| comments, DMs, follows | — | ❌ |

---

## The design, and why the receipt is the ugly part

v1 of this UI was a terminal — near-black, monospace, hairline rules. It was
legible, and it looked like a developer tool, which is the wrong signal for a
product whose job is to feel like a friend showing up for you. People under 25
do not spend money on things that look like a config file.

v2 keeps exactly one thing austere: **the receipt**. That object has to read as
a real record, because it is the proof the entire product rests on. Everything
around it is a sticker book — chunky rounded cards, saturated colour, a heavy
display face, and puffy 3D stickers. The contrast is the point. The playful
surface gets you to spend a cent; the sober receipt is what you get for it.

### Making a cent feel safe to spend

Nobody hesitates over $3 because $3 is a lot. They hesitate because they don't
know whether it renews, whether they can undo it, who ends up holding their card
number, and whether they'll get carried away. `TrustRow` answers exactly those
four, next to the button rather than in a FAQ — and each line is enforced in
code, not merely promised:

| Claim | Enforced by |
| --- | --- |
| No subscription | One-off Checkout sessions. No prices, no billing cycle. |
| Refund anytime | `/api/refund` — unspent balance, in full, no questions |
| We never see your card | Hosted Checkout; we store a fingerprint, never a PAN |
| You can't overspend | `one_love_per_day` + the 60/day ceiling, in the database |

Tiers are priced in **acts, not dollars** — "$10 · 1,000 people" rather than
"$10 · 1,000 credits" — because the dollar is the friction and the act is the
product. Every project page carries a *What a cent buys* card stating plainly
that the cent stays with famlove and never reaches the owner, which is the
same sentence that keeps this out of money transmission.

### Generated assets

`npm run assets` regenerates the stickers with `gpt-image-2` from prompts kept
in `scripts/generate-assets.mjs`, then downscales them to WebP (7.8 MB of PNG
masters → 166 KB shipped). The PNGs are committed as masters because
regeneration is non-deterministic.

The rule they follow: **generated art is decoration and never carries
information.** Every sticker is `aria-hidden`; every number, face, rank and
receipt on the site is rendered from the database as real text. A product whose
entire claim is "this actually happened" cannot have an illustration implying
something did.

## Stack

Next.js 15 (App Router) on Vercel · Lakebase Postgres on Neon via
`@neondatabase/serverless` · Stripe Checkout **or** Lemon Squeezy · X OAuth 2.0
with PKCE · `next/og` for share cards · Upstash for courtesy rate limits ·
Resend for the one email. No ORM: the schema is one file of SQL and the boards
are three SELECTs.

### Standing orders, daily rallies, and the three emails

A cent stays a deliberate act by default. A **standing order** is opt-in, per
project, and offered on the receipt right after the first one: one cent a day,
automatically, until the jar runs out. Every rule still applies — one per
project per UTC day, the 60-a-day ceiling, a balance that covers it — so rank
remains unbuyable. What changes is what a face means, which is why
`loves.auto` records whether a cent was placed by a person or by their
standing order. That distinction is not recoverable later if it isn't kept now.

**Rallies open themselves** at 00:00 UTC rather than waiting for an owner to
remember, for every project with a pulse in the last week — sixty rallies
reading 0/50 would make the board look abandoned rather than busy. The goal is
that project's own best day plus a fifth: always a stretch, never an insult.

famlove sends **three** emails and no others:

| Email | When | Guard |
| --- | --- | --- |
| `showed-up` | somebody backs your project | at most **once per project per day**, on the first cent |
| `owner-digest` | 00:05 UTC | who showed up, the streak, the rank |
| `supporter-digest` | 00:05 UTC | how the projects *you* back did, and how many days of jar you have left |

The first is deliberately not one-per-backer: a project having a good day
would otherwise mean a hundred emails, which is how a sending domain gets
classed as spam and how a person learns to filter you.

Every send is claimed in `email_sends` before it goes out, so a cron that
retries doesn't mean two copies in an inbox — and the claim is **released
again if the send fails**, since a claim is a lock, not a record of delivery.
Nobody receives anything without typing an address in: X OAuth hands us none,
so silence is the default.

### Schema

| Table | Columns that matter | Note |
| --- | --- | --- |
| `users` | `x_id`, `handle`, `x_created_at`, `banned_at` | X OAuth 2.0. Accounts under 30 days are rejected at the door. |
| `cards` | `user_id`, `stripe_fingerprint UNIQUE` | The sybil ledger. One card, one human. |
| `wallets` | `cents_balance`, `cents_given`, `cents_topped_up` | Balance decrements in the same statement as the love insert. |
| `projects` | `owner_id`, `slug`, `name`, `url`, `tagline` | Up to `MAX_PROJECTS_PER_USER` (5) each, counted inside the INSERT. Capped, not unlimited — an uncapped board fills with spam listings. |
| `loves` | `(from_user_id, project_id, day_utc)` **UNIQUE** | The entire game lives here. |
| `topups` | `(provider, provider_ref)` **UNIQUE** | Idempotent. Webhook-driven. |
| `rallies` | `project_id`, `starts_at`, `ends_at`, `goal` | One per project per week, by unique index. |
| `expenses` | `occurred_on`, `label`, `cents` | The other side of `/cents`. |
| `daily_rollups` | `backers`, `streak_days`, `emailed_at` | Written by the 00:05 UTC cron. |

### Giving a cent is one SQL statement

`giveLove()` is a single statement with CTEs — Postgres wraps a statement in a
transaction, so the balance decrement and the love insert either both land or
neither does. A double-spend race is caught by `CHECK (cents_balance >= 0)`; a
second love on the same day is caught by the unique index. Neither needs
application logic to be correct.

---

## Running it

```bash
npm install
cp .env.example .env          # fill in DATABASE_URL and SESSION_SECRET at minimum
npm run db:migrate            # applies db/schema.sql
npm run db:seed               # 240 funded wallets, 60 projects, 10 days of loves
npm run dev
```

With `ALLOW_DEV_LOGIN=1` and no X keys, `/join` offers a local sign-in and
`/api/checkout` credits a jar without a card — so the whole game is playable
offline, against the real rules and the real database.

```bash
npm run rules                 # asserts all 11 invariants against the live DB
npm run typecheck
npm run build
```

### Where it runs

Live on **Cloudflare Workers** at [famlove.lol](https://famlove.lol), via
`@opennextjs/cloudflare` (the Workers adapter, Node.js runtime — not the older
edge-only Pages one).

```bash
npm run cf:build     # opennextjs-cloudflare build
npm run cf:deploy    # build + wrangler deploy
npm run cf:preview   # build + wrangler dev
```

Three things differ from a Vercel deployment, all handled:

- **`worker.ts` wraps the generated worker.** Cron Triggers invoke a
  `scheduled()` export rather than sending an HTTP request, and OpenNext only
  generates a `fetch` handler — so the 00:05 UTC rollup gets a handler to land
  in, which calls the existing route over the worker's own public URL.
  `vercel.json` is kept so the app still deploys to either host.
- **`NEXT_PUBLIC_SITE_URL` is inlined at build time**, so it must be correct
  when `opennextjs-cloudflare build` runs, not just at runtime.
- **No incremental cache and no R2 bucket.** Every page is `force-dynamic` —
  boards, walls and receipts are all "what is true right now" — so there is
  nothing to cache and one less thing to keep in sync.

`next/og` renders the share card fine under workerd (1200×630 PNG, ~1.2s),
which was the part worth proving before committing to the host.

### Deploying, and taking real money

```bash
npm run golive https://your-domain                    # preflight, read-only
npm run golive https://your-domain --create-webhook   # + create the endpoint
```

`golive` checks every way famlove can take somebody's money and give them
nothing back, and exits non-zero until each one is closed. With Cloudflare
credentials present it asks the deployed worker which secrets it actually
holds, rather than reading a local `.env` and reporting on a live site —
which is how a preflight lies to you in both directions. It checks: the site responds,
`SESSION_SECRET` isn't a placeholder, X OAuth is configured and its redirect
matches, both unique indexes exist, Stripe charges are enabled, Tax is active,
and a webhook endpoint exists for **this** site with the events the code
listens for. It never creates a charge; `--create-webhook` is the only call
that writes to Stripe.

Three things the live path does that the test path doesn't:

1. **Checkout refuses to open on a live key with no `STRIPE_WEBHOOK_SECRET`.**
   The webhook is what credits the jar. A missed sale is recoverable; charging
   a card and crediting nothing is not.
2. **Prices go to Stripe tax-inclusive.** With exclusive tax an EU buyer is
   asked for $3.63 and "$3 buys 300 cents" stops being true. Inclusive keeps
   the sticker price the price and takes VAT out of the margin — which is how
   §money models it.
3. **The success page reconciles.** `success_url` carries the session id, and
   `/wallet` verifies it against Stripe and credits the jar if the webhook
   hasn't yet. Both paths insert into `topups`, which is UNIQUE on
   `(provider, provider_ref)`, so the second one is a no-op. A misconfigured
   webhook costs you a log line instead of a buyer.

Then set a **famlove-specific statement descriptor** in Stripe. It is the
cheapest dispute defence there is, and on a $3 jar a $15 dispute fee is a 5×
loss.

---

## Five days, and the go / no-go gate

| Day | Work | Done when |
| --- | --- | --- |
| 1 | Schema, unique index first. X OAuth with the 30-day gate. Checkout + idempotent webhook. Card fingerprints. | You can top up $3 with a real card and see 300¢. |
| 2 | Project submit. `POST /love` as one transaction. LOVED / RISING / GIVERS. The 60/day ceiling. | Two accounts can't double-love the same project in one day. |
| 3 | The wall. Public profile receipt. `next/og` share card + OG tags. The "N people showed up" email. | Pasting a project link into X renders the face grid. |
| 4 | Rallies. The 00:00 UTC rollup. Statement descriptor, refund macro, ToS, privacy, `/cents`. | You'd be comfortable with a hostile quote-tweet reading your ToS. |
| 5 | DM ~80 founders. Ask them to list a project and put in $3. **Do not comp it.** | 50 people you know have each spent $3. |

**Day 5 is the experiment, not the launch.** If fifty founders who know you
personally won't spend three dollars, strangers on X certainly won't. That
answer costs about a hundred dollars of effort and you get it privately.
Treat a failed seed as a successful experiment and stop there.

---

## What it makes, honestly

Revenue is jars sold × average jar. There is no second lever, because the
whales were deliberately removed.

| Scenario | Wallets | Avg jar | Gross | Net via MoR |
| --- | --- | --- | --- | --- |
| Fizzle — your fam and nobody else | 60 | $7 | $420 | $369 |
| Base — a decent X day | 600 | $8 | $4,800 | $4,260 |
| Good — it gets quoted widely | 2,000 | $9 | $18,000 | $16,100 |
| outbid-tier — will not happen | 15,000 | $9 | $135,000 | $120,750 |

outbid took $214k because six people spent five figures each. famlove's design
makes that mathematically impossible. **Expect low four figures.** Build it for
the post and the primitive, not the revenue, or you'll be disappointed by a
result that is actually a success.

### What kills it

- **No whale, no headline.** "$17,000 for a link" is coverable; "23 people gave
  a cent" is not. The idea has to be the news, which makes the anti-outbid
  framing load-bearing rather than marketing.
- **An empty wall is worse than no wall.** Do not open the doors below ~50
  seeded projects and ~200 funded wallets. `npm run db:seed` builds exactly
  that floor so you can see what "enough" looks like.
- **It can decay into a follower-count mirror.** RISING is the fix and it ships
  in v1, not v2.
- **Chargebacks are asymmetric.** A $15 dispute fee on a $3 jar is a 5× loss.
- **The window closes fast.** The rebuttal frame is the only free distribution
  there is, and it has a shelf life measured in days.
- **Prepaid balances have a legal shape.** Cents are closed-loop,
  single-issuer, non-transferable credit redeemable against exactly one feature
  on one site, and refunded in cash while unspent — the mildest form of stored
  value there is, and deliberately so. `/legal/terms` §5 states what a cent is
  not (not e-money, not a payment instrument, not a voucher, not transferable),
  §7 handles the EU right of withdrawal over digital content supplied
  immediately, and checkout collects that consent rather than assuming it.
  The selling entity is a constant in `src/lib/legal.ts`, not configuration,
  because a trader has to identify itself before the sale and a missing
  environment variable must never be able to publish terms with a blank where
  the seller's name goes.

---

## The launch post

```
outbid.lol ranks you by how much money you have.

famlove.lol ranks you by how many people showed up.

1¢ each. Capped at one per person, per day.
You literally cannot buy the top spot.

No whales. No $17,000 slot.
Just a wall of everyone who spent a cent to prove they meant it.

every cent we take is listed at famlove.lol/cents
```

Post it as a reply-quote into the outbid conversation while that conversation
still exists.

---

## The reason to build it that isn't money

A wall of faces, each one a verified human who spent real money to publicly
back a specific thing on a specific day, is a primitive that outlives the joke
domain. It is a launch-day support wall. It is a warm list — not scraped, not
inferred, opted into with a card. It is proof-of-support with identity
attached, which the internet is short of.

---

*Figures for outbid.lol are self-reported and unaudited. Stripe rates cited are
standard published online-card pricing for EEA and UK accounts as of mid-2026;
confirm your own rate card before modelling. Nothing here is legal, tax or
financial advice — the stored-value, VAT and contest-law points are flagged
precisely because they need a professional, not because they're settled.*

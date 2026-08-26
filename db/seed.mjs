/**
 * Seed the board.
 *
 * "Do not open the doors below ~50 seeded projects and ~200 funded wallets" is
 * the single most important line in the launch plan: the product is a grid of
 * faces, and a project page showing two avatars actively signals failure. This
 * fixture builds that floor so the thing can be looked at, demoed and load-
 * tested with the real rules — one cent, one person, one project, one day —
 * rather than with an empty database.
 *
 * It is deterministic: same seed, same board, every time.
 */

const NAMES = [
  ["slashloop", "Viral video tracker — finds outliers before they peak"],
  ["Tinyharbor", "Ship a changelog your users actually read"],
  ["Lumen Notes", "Notes that answer back, offline, on your own machine"],
  ["Coldbrew", "Cold email that a human would reply to"],
  ["Portless", "Local ports, shared with one command"],
  ["Fennel", "A spreadsheet that understands your database"],
  ["Hush", "Focus timer that locks your worst tab"],
  ["Ledgerly", "Bookkeeping for people who hate bookkeeping"],
  ["Marrow", "Extract structure from any PDF pile"],
  ["Northpass", "Passwordless auth in four lines"],
  ["Orbit CRM", "The CRM that fits in a single screen"],
  ["Pixelfarm", "Batch image ops without opening Photoshop"],
  ["Quietmail", "An inbox that only opens twice a day"],
  ["Ratchet", "Migrations you can actually roll back"],
  ["Signalbox", "Uptime checks that page a human, not a channel"],
  ["Thicket", "Dependency graphs for humans"],
  ["Undercurrent", "Analytics without a cookie banner"],
  ["Vellum", "Contracts drafted from your own precedent"],
  ["Wharf", "One-command deploys to your own box"],
  ["Yardstick", "Benchmarks your CI can fail on"],
  ["Zephyr Docs", "Docs that stay in sync with the code"],
  ["Anchorpoint", "Version control for designers"],
  ["Bellwether", "Churn prediction that names the account"],
  ["Cobalt", "Type-safe SQL, no ORM"],
  ["Driftwood", "Feature flags with an expiry date"],
  ["Emberlight", "Status pages that write their own updates"],
  ["Foghorn", "On-call rotas that respect timezones"],
  ["Glimmer", "Design tokens, one source of truth"],
  ["Halyard", "Background jobs with a real UI"],
  ["Inkwell", "Newsletters written in your editor"],
  ["Junco", "Tiny CI for tiny repos"],
  ["Kelpie", "Scrape a site into a typed API"],
  ["Larkspur", "Habit tracking with no streak guilt"],
  ["Meridian", "Timezone-aware scheduling that isn't awful"],
  ["Nightjar", "Log search that fits in RAM"],
  ["Oxbow", "Data migrations between any two SaaS"],
  ["Plumb", "Trace a request across every service"],
  ["Quillon", "Handwriting to markdown"],
  ["Rookery", "Community forum without the bloat"],
  ["Saltmarsh", "Backups you can actually restore"],
  ["Tessellate", "Layout engine for print, in the browser"],
  ["Umbra", "Screenshot diffing that ignores the noise"],
  ["Verglas", "Cold-start-free serverless Postgres cache"],
  ["Windrow", "Harvest planning for small farms"],
  ["Xenon", "Load testing from your laptop"],
  ["Yarrow", "Herbal-simple config management"],
  ["Zinc", "Static site host with real redirects"],
  ["Ambergris", "Perfume discovery by note, not brand"],
  ["Basalt", "Rock-solid job queue for Postgres"],
  ["Cinder", "Burn-down charts nobody has to update"],
  ["Dovetail", "Merge two codebases without tears"],
  ["Estuary", "Stream your database into a warehouse"],
  ["Flint", "Spark a side project in one command"],
  ["Gossamer", "The lightest possible CSS reset"],
  ["Hearth", "Home server dashboard for normal people"],
  ["Ivory", "Chess trainer that finds your blind spot"],
  ["Juniper", "Plant care that texts you"],
  ["Kestrel", "Drone flight logs, searchable"],
  ["Lantern", "Onboarding tours that don't annoy"],
  ["Mistral", "Weather alerts for sailors"],
];

const HANDLES = [
  "jwilke", "alexc", "mkozlov", "rsingh", "tnguyen", "dperez", "evachen",
  "kbourne", "lorenzo", "scampos", "mrivera", "ahassan", "nbarros", "gtorres",
  "pzielin", "yildiz", "fdiallo", "cmarsh", "oumar", "vkapoor", "walsh",
  "jrobles", "bekele", "hsato", "ninaw", "tomaso", "cfields", "dnakamura",
  "esparza", "fmoreau", "gkeller", "hpatel", "ilyas", "jkowal", "kmbeki",
  "lgrasso", "mokoye", "nlindqv", "obrien", "pmehta", "qadir", "rlemoine",
  "svetlana", "tbaptiste", "uduak", "vhorvath", "wmbeki", "xiaoli", "yusuf",
  "zsolt", "amaru", "bianca", "caleb", "dagny", "eero", "farrah", "gunnar",
  "hilde", "isla", "jonas", "kaia", "lucian", "maren", "nadia", "otso",
  "petra", "quinn", "rasmus", "sanna", "tobias", "ulla", "viggo", "wren",
  "ximena", "yara", "zane", "adaeze", "bram", "cyrine", "dilan", "eluned",
  "fintan", "greta", "haruki", "ines", "jarrah", "kofi", "linnea", "mirek",
  "noor", "oisin", "priya", "rania", "sorcha", "tuomas", "uma", "vesna",
  "wojtek", "xochitl", "yanis", "zofia", "amina", "bodhi", "clove", "dario",
  "eira", "faye", "gio", "hana", "iker", "juno", "kian", "lia", "milo",
  "nia", "ove", "pia", "rio", "sena", "tao", "uri", "vera", "wes", "xan",
  "yuki", "zara", "arvo", "brix", "cass", "dune", "esme", "flynn", "gale",
  "hollis", "ida", "joss", "kit", "lark", "mave", "nell", "orla", "pace",
  "quill", "roux", "sage", "teal", "ula", "vail", "wynn", "xia", "yale",
  "zev", "arlo", "brynn", "cove", "dex", "eden", "fern", "gray", "hale",
  "indy", "jem", "koa", "lane", "moss", "nox", "onyx", "prim", "quest",
  "reed", "sol", "tal", "vale", "west", "yarrow", "zen", "ash", "birch",
  "cedar", "dell", "elm", "fig", "grove", "hazel", "iris", "juniper2",
  "kale", "linden", "maple", "nettle", "olive", "pine", "quince", "rowan",
  "sorrel", "thistle", "umber", "vine", "willow", "yew", "zinnia", "acacia",
  "bramble", "clover", "dahlia", "elder", "fennel2", "ginger", "heather",
  "indigo", "jasmine", "kudzu", "lotus", "myrtle", "nutmeg", "orchid",
  "poppy", "quinoa", "rosemary", "sage2", "tansy", "urchin", "violet",
  "wisteria", "xylem", "yucca", "zephyr", "amber", "basil", "cassia",
  "daisy", "ember", "flora", "gwen", "holly", "ianto", "jade", "kestrel2",
  "lilac", "magnolia", "nyssa", "opal", "pearl", "quartz", "ruby", "sable",
  "topaz", "ultra", "verde", "willa", "xanthe", "yolanda", "zinc2",
];

/** Deterministic PRNG so the same seed produces the same board every time. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
}

const utcDay = (offset) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

export async function seedDatabase(sql) {
  const random = rng(20260819);
  const DAYS = 10;

  console.log("seeding: clearing previous fixture data…");
  await sql`DELETE FROM loves WHERE from_user_id IN (SELECT id FROM users WHERE is_seed)`;
  await sql`DELETE FROM rallies WHERE project_id IN (
    SELECT p.id FROM projects p JOIN users u ON u.id = p.owner_id WHERE u.is_seed)`;
  await sql`DELETE FROM projects WHERE owner_id IN (SELECT id FROM users WHERE is_seed)`;
  await sql`DELETE FROM topups WHERE user_id IN (SELECT id FROM users WHERE is_seed)`;
  await sql`DELETE FROM wallets WHERE user_id IN (SELECT id FROM users WHERE is_seed)`;
  await sql`DELETE FROM cards WHERE user_id IN (SELECT id FROM users WHERE is_seed)`;
  await sql`DELETE FROM users WHERE is_seed`;
  await sql`DELETE FROM expenses`;

  // ---- people -------------------------------------------------------------
  const handles = [...new Set(HANDLES)].slice(0, 240);
  console.log(`seeding: ${handles.length} people…`);

  const userIds = new Map();
  for (let i = 0; i < handles.length; i += 1) {
    const handle = handles[i];
    const ageDays = 60 + Math.floor(random() * 3000);
    const [row] = await sql`
      INSERT INTO users (x_id, handle, display_name, avatar_url, x_created_at, is_seed)
      VALUES (${`seed:${handle}`}, ${handle}, ${handle}, NULL,
              ${new Date(Date.now() - ageDays * 86_400_000).toISOString()}, TRUE)
      ON CONFLICT (x_id) DO UPDATE SET handle = EXCLUDED.handle
      RETURNING id
    `;
    userIds.set(handle, Number(row.id));
  }

  // ---- jars ---------------------------------------------------------------
  // Every seeded wallet is a *funded* one: they each put in $3 or $10, because
  // "fifty founders who won't spend three dollars" is the go / no-go gate and
  // a fixture that skips it is lying to you.
  console.log("seeding: funding wallets…");
  const tiers = [
    { id: "hook", cents: 300 },
    { id: "default", cents: 1000 },
    { id: "patron", cents: 3000 },
  ];
  for (const [handle, id] of userIds) {
    const roll = random();
    const tier = roll < 0.62 ? tiers[0] : roll < 0.95 ? tiers[1] : tiers[2];
    await sql`
      INSERT INTO topups (user_id, provider, provider_ref, tier, gross_cents,
                          fee_cents, tax_cents, granted_cents)
      VALUES (${id}, 'seed', ${`seed:${handle}`}, ${tier.id}, ${tier.cents},
              ${Math.round(tier.cents * 0.05) + 50},
              ${Math.round(tier.cents * 0.06)}, ${tier.cents})
      ON CONFLICT (provider, provider_ref) DO NOTHING
    `;
    await sql`
      INSERT INTO wallets (user_id, cents_balance, cents_topped_up)
      VALUES (${id}, ${tier.cents}, ${tier.cents})
      ON CONFLICT (user_id) DO UPDATE
        SET cents_balance = ${tier.cents}, cents_topped_up = ${tier.cents},
            cents_given = 0
    `;
  }

  // ---- projects -----------------------------------------------------------
  console.log(`seeding: ${NAMES.length} projects…`);
  const owners = [...userIds.values()];
  const projects = [];
  for (let i = 0; i < NAMES.length; i += 1) {
    const [name, tagline] = NAMES[i];
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const [row] = await sql`
      INSERT INTO projects (owner_id, slug, name, url, tagline)
      VALUES (${owners[i]}, ${slug}, ${name},
              ${`https://${slug.replace(/-/g, "")}.com`}, ${tagline})
      ON CONFLICT (owner_id) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, slug
    `;
    projects.push({ id: Number(row.id), slug: row.slug, ownerIndex: i });
  }

  // ---- ten days of loves --------------------------------------------------
  // Each project gets a "pull" — how good it is at getting people to show up —
  // and each day is that pull with noise. Nobody can exceed one cent per
  // project per day, because the database will not let them.
  console.log(`seeding: ${DAYS} days of loves…`);
  const givers = [...userIds.values()];
  const rows = [];

  for (const project of projects) {
    // Most projects are quiet and a few are loved: a cubed roll gives a long
    // tail, which is what a real board looks like and what RISING needs to
    // have something to surface.
    const pull = 0.003 + Math.pow(random(), 3) * 0.085;
    for (let d = DAYS - 1; d >= 0; d -= 1) {
      const day = utcDay(-d);
      // A few projects get a spike on one day — that's what RISING is for.
      const spike = random() < 0.05 ? 2.6 : 1;
      const shuffled = [...givers].sort(() => random() - 0.5);
      const count = Math.min(
        shuffled.length,
        Math.max(0, Math.round(givers.length * pull * spike * (0.6 + random() * 0.8))),
      );
      for (let i = 0; i < count; i += 1) {
        const giver = shuffled[i];
        if (giver === owners[project.ownerIndex]) continue;
        rows.push([giver, project.id, day]);
      }
    }
  }

  console.log(`seeding: inserting ${rows.length} loves…`);
  const CHUNK = 400;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const values = chunk
      .map((r) => `(${r[0]}, ${r[1]}, '${r[2]}'::date)`)
      .join(",");
    await sql.query(
      `INSERT INTO loves (from_user_id, project_id, day_utc)
       VALUES ${values} ON CONFLICT DO NOTHING`,
    );
  }

  // Wallets must reflect what was actually given, or the ledger lies.
  await sql`
    UPDATE wallets w
    SET cents_given   = c.given,
        cents_balance = GREATEST(0, w.cents_topped_up - c.given)
    FROM (SELECT from_user_id, COUNT(*) AS given FROM loves GROUP BY from_user_id) c
    WHERE c.from_user_id = w.user_id
  `;

  // ---- one live rally -----------------------------------------------------
  const [top] = await sql`
    SELECT project_id FROM loves
    WHERE day_utc = (now() AT TIME ZONE 'utc')::date
    GROUP BY project_id ORDER BY COUNT(DISTINCT from_user_id) DESC LIMIT 1
  `;
  if (top) {
    await sql`
      INSERT INTO rallies (project_id, starts_at, ends_at, goal)
      VALUES (${Number(top.project_id)}, now() - interval '6 hours',
              now() + interval '18 hours', 50)
      ON CONFLICT DO NOTHING
    `;
  }

  // ---- the /cents page needs a real other side ---------------------------
  await sql`
    INSERT INTO expenses (occurred_on, label, detail, cents) VALUES
      (${utcDay(-12)}, 'famlove.lol domain', 'one year, .lol registration', 3200),
      (${utcDay(-11)}, 'Vercel', 'Pro, first month', 2000),
      (${utcDay(-11)}, 'Neon Postgres', 'Launch plan, first month', 1900),
      (${utcDay(-10)}, 'Resend', 'first month', 2000),
      (${utcDay(-9)},  'Lawyer', '30 minutes on stored-value wording', 15000)
  `;

  const [summary] = await sql`
    SELECT (SELECT COUNT(*) FROM users WHERE is_seed) AS people,
           (SELECT COUNT(*) FROM projects) AS projects,
           (SELECT COUNT(*) FROM loves) AS loves,
           (SELECT COUNT(*) FROM loves
             WHERE day_utc = (now() AT TIME ZONE 'utc')::date) AS today
  `;
  console.log(
    `\nseeded: ${summary.people} people · ${summary.projects} projects · ` +
      `${summary.loves} loves (${summary.today} today)`,
  );
}

#!/usr/bin/env node
/**
 * Generate the avatar set the seeded wall wears.
 *
 * Every seeded account had avatar_url NULL, so every card on the site — the
 * one a builder is supposed to want to post — drew a grid of grey initials.
 * A wall of initials reads as absence, and absence is the one thing this
 * product must never accidentally communicate.
 *
 * These are deliberately *illustrated* rather than photoreal. A photoreal
 * face attached to a fixture account is a manufactured person, on a site that
 * takes real money and whose entire claim is "these are real humans who
 * showed up". An obviously-drawn avatar is avatar art, which is what it is,
 * and it matches the puffy-3D house style the stickers already set.
 *
 *   node scripts/generate-faces.mjs           # only missing
 *   node scripts/generate-faces.mjs --force   # regenerate all
 */
import { writeFile, mkdir, access } from "node:fs/promises";
import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
/*
 * Sources stay out of public/. gpt-image-2 returns 1024px PNGs at roughly a
 * megabyte each, and anything under public/ is served to visitors and
 * uploaded on every deploy — 31 MB of regeneration input that no page ever
 * requests. Only the optimized output ships.
 */
const srcDir = path.join(root, "assets", "faces");
const outDir = path.join(root, "public", "faces");

const key = process.env.OPENAI_API_KEY;
if (!key) {
  console.error("OPENAI_API_KEY is not set.");
  process.exit(1);
}

const HOUSE = [
  "Character avatar in a soft inflated 3D style, like a glossy vinyl toy:",
  "smooth rounded forms, big friendly features, soft studio lighting, gentle",
  "rim light. Head and shoulders only, facing the camera, centred, filling",
  "the frame. Plain flat solid-colour background. Clearly an illustration,",
  "not a photograph. No text, no letters, no words, no watermark, no logo,",
  "no border, no frame.",
].join(" ");

/*
 * Written out one by one rather than sampled from lists: a generated crowd
 * that varies only by hair colour still looks like one person twenty times,
 * and that is exactly the tell that makes a wall read as fake.
 */
const PEOPLE = [
  "a young Black woman with short bleached-blonde coils and small gold hoop earrings, warm grin, background deep teal",
  "an older South Asian man with a grey beard and thick square glasses, calm half-smile, background mustard",
  "a East Asian woman in her twenties with a blunt black bob and a red beanie, deadpan expression, background lavender",
  "a white man in his thirties with messy ginger hair and freckles, laughing, background forest green",
  "a Latina woman with long dark curls and large round glasses, eyebrow raised, background hot pink",
  "a Black man with short locs and a denim collar, wide open smile, background burnt orange",
  "a Middle Eastern woman wearing a plum hijab, bright eyes, gentle smile, background sage",
  "a white woman in her fifties with silver cropped hair and red lipstick, wry look, background navy",
  "a Southeast Asian man in his twenties with a fade haircut and small silver nose stud, smirking, background sky blue",
  "a mixed-race nonbinary person with a two-tone green and black mullet, neutral confident expression, background charcoal",
  "an East Asian man with round wire glasses and a grey hoodie hood up, shy smile, background terracotta",
  "a Black woman with box braids piled in a high bun and big triangle earrings, chin up, background acid lime",
  "a white man in his sixties with a bald head and a thick white moustache, kind eyes, background maroon",
  "a South Asian woman with a long dark plait over one shoulder and a nose ring, soft smile, background dusty rose",
  "a Latino man with slicked back hair and a thin moustache, one eyebrow up, background cobalt",
  "a white nonbinary person with a shaved head and heavy black eyeliner, unimpressed expression, background pale yellow",
  "a Black man in his forties with a full beard and a flat cap, warm laugh, background plum",
  "an East Asian woman with long straight hair dyed dusty pink and blunt fringe, small smile, background olive",
  "a white woman in her twenties with a high messy bun and oversized headphones round her neck, mid-laugh, background coral",
  "a Middle Eastern man with dark wavy hair and stubble, arms-crossed confidence, background deep purple",
  "a Pacific Islander woman with a flower tucked behind one ear and a broad smile, background turquoise",
  "an older East Asian woman with short permed grey hair and jade earrings, twinkling eyes, background rust",
  "a white man in his twenties with a blond undercut and a septum ring, blank cool expression, background steel blue",
  "a Black nonbinary person with a bleached buzzcut and round yellow-tinted glasses, playful grin, background magenta",
  // Twenty-four was not enough. Faces are handed out by user id modulo the
  // set size, so a wall with more backers than there are faces starts drawing
  // the same person twice — and because walls sort by time rather than by id,
  // the twins land next to each other, which is exactly the tell that makes a
  // crowd read as manufactured. Sixty covers the 40 the share card draws.
  //
  // Only 33 of these exist so far: the OpenAI account ran out of credits at
  // f34. Re-running this script picks up exactly where it stopped; raise
  // FACES in db/seed.mjs to match whatever public/faces ends up holding.
  "a white woman in her thirties with a dark pixie cut and bold red glasses, thoughtful, background teal",
  "a Black man in his twenties with a high-top fade and a chain necklace, cool nod, background yellow",
  "an East Asian man in his fifties with greying temples and a polo shirt, patient smile, background indigo",
  "a South Asian man in his twenties with curly hair and a light beard, grinning, background sea green",
  "a Latina woman in her forties with shoulder-length auburn hair and gold studs, warm look, background slate",
  "a white man with long blond hair in a bun and a flannel collar, easy smile, background brick",
  "a Black woman in her fifties with natural grey afro and statement glasses, poised, background emerald",
  "a Middle Eastern woman with dark straight hair and a leather jacket, half-smile, background amber",
  "an East Asian nonbinary person with an undercut dyed electric blue, chin tilted, background charcoal",
  "a white man in his forties with square glasses and a receding hairline, dry expression, background moss",
  "a Southeast Asian woman with a short bob and a striped tee, laughing, background coral",
  "a Black man with a shaved head and a thick gold hoop, calm, background deep blue",
  "a Latino teenager with braces and a curly fringe, big grin, background lilac",
  "a white woman in her sixties with a grey bob and pearl earrings, gentle, background rose",
  "a South Asian woman in her thirties with a low bun and a bindi, serene, background mustard",
  "a Pacific Islander man with a full beard and a tattoo on his neck, friendly, background jade",
  "a white nonbinary person with freckles and short lavender hair, curious look, background ink blue",
  "an East Asian woman in her twenties with twin buns and cat-eye liner, playful, background cherry",
  "a Black woman with a silk headwrap in bold print, radiant smile, background aubergine",
  "a Middle Eastern man in his sixties with a white beard and a flat cap, wise eyes, background sand",
  "a white man in his twenties with a buzzcut and a hoodie, neutral, background pine",
  "a Latina teenager with long straight hair and hoop earrings, smirking, background sky",
  "an East Asian man with shaggy hair and round glasses, sleepy smile, background rust",
  "a Black nonbinary person with short twists and a septum ring, confident, background chartreuse",
  "a white woman in her forties with a curly ponytail and a denim shirt, mid-sentence, background navy",
  "a South Asian man in his fifties with a neat moustache and a cardigan, kindly, background olive",
  "a Southeast Asian man with spiked hair and a bomber jacket, cheeky, background magenta",
  "a white man in his thirties with a red beard and a beanie, hearty laugh, background forest",
  "an East Asian woman in her forties with a sleek ponytail and blazer, composed, background burgundy",
  "a Black man in his thirties with wire glasses and a turtleneck, thoughtful, background copper",
  "a Middle Eastern woman with a mint hijab and glasses, bright smile, background plum",
  "a white woman in her twenties with box-dyed black hair and heavy fringe, deadpan, background lime",
  "a Latino man in his fifties with salt-and-pepper hair and a work shirt, proud, background steel",
  "a Pacific Islander woman in her thirties with wavy hair and a lei, beaming, background turquoise",
  "an older Black woman with silver locs and round earrings, knowing look, background violet",
  "a white man in his fifties with a bald crown and rectangular glasses, amused, background ochre",
];


async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/*
 * Sixty images in a row will hit the account's per-minute image limit, and a
 * 429 there is a "come back shortly", not a failure — the first run of this
 * batch lost twenty-six faces to unretried 429s and left the wall with
 * visible twins. Back off and ask again.
 */
async function generate(name, who, attempt = 0) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-image-2",
      prompt: `A portrait avatar of ${who}. ${HOUSE}`,
      size: "1024x1024",
      n: 1,
      output_format: "png",
      // These render at 68px on the share card. "high" buys nothing a
      // downscale to 160px would keep.
      quality: "medium",
      background: "opaque",
    }),
  });
  /*
   * 429 covers two very different things. A rate limit is "come back
   * shortly" and worth waiting out; insufficient_quota is "the account has
   * no credits", which no amount of waiting fixes — retrying it just burns
   * ten minutes before reporting the same billing problem.
   */
  if (res.status === 429 && attempt < 6) {
    const body = await res.clone().text();
    if (body.includes("insufficient_quota")) {
      throw new Error(`${name}: out of OpenAI credits — top up and re-run`);
    }
    const backoff = 30_000 * (attempt + 1);
    console.log(`  · ${name}: rate limited, waiting ${backoff / 1000}s`);
    await wait(backoff);
    return generate(name, who, attempt + 1);
  }
  if (!res.ok) throw new Error(`${name}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error(`${name}: no image returned`);
  const buf = Buffer.from(b64, "base64");
  await writeFile(path.join(srcDir, `${name}.png`), buf);
  console.log(`  ✓ ${name}.png (${Math.round(buf.length / 1024)} KB)`);
}

const force = process.argv.includes("--force");
await mkdir(srcDir, { recursive: true });
await mkdir(outDir, { recursive: true });

console.log(`generating ${PEOPLE.length} faces:`);
for (let i = 0; i < PEOPLE.length; i += 1) {
  const name = `f${String(i + 1).padStart(2, "0")}`;
  if (!force && (await exists(path.join(srcDir, `${name}.png`)))) {
    console.log(`  · ${name}.png exists, skipping`);
    continue;
  }
  try {
    await generate(name, PEOPLE[i]);
    await wait(2000);
  } catch (err) {
    console.error(`  ✗ ${err.message}`);
  }
}

/*
 * Two encodings per face, and the second one is not belt-and-braces.
 *
 * A 1024px PNG per face would be ~30 MB of avatars for tiles that never draw
 * larger than 68px, so the site gets 160px WebP. But the share card is
 * rendered by satori, which has no WebP decoder: it fetches the image,
 * fails to decode it, and draws *nothing* — a silent hole in the grid, which
 * is worse than the grey initial it replaced. Verified by rendering a card
 * with WebP avatars: four faces came out as blank gaps.
 *
 * So satori gets a PNG. 136px is 2x the 68px it draws them at, and the
 * palette is quantised because these are flat illustrations, not photographs.
 */
const { default: sharp } = await import("sharp");
console.log("\noptimizing:");
let web = 0;
let card = 0;
for (let i = 0; i < PEOPLE.length; i += 1) {
  const name = `f${String(i + 1).padStart(2, "0")}`;
  // Prefer the raw 1024px PNG, but fall back to the committed q95 WebP master
  // (assets/faces/*.webp) — that archive is the durable copy, so the shipped
  // sizes can be rebuilt from a fresh clone even after the PNGs are gone and
  // the OpenAI account can no longer regenerate them.
  const png = path.join(srcDir, `${name}.png`);
  const master = path.join(srcDir, `${name}.webp`);
  const src = (await exists(png)) ? png : (await exists(master)) ? master : null;
  if (!src) continue;

  const webp = path.join(outDir, `${name}.webp`);
  await sharp(src).resize({ width: 160, height: 160, fit: "cover" })
    .webp({ quality: 82, effort: 6 }).toFile(webp);

  const small = path.join(outDir, `${name}.card.png`);
  await sharp(src).resize({ width: 136, height: 136, fit: "cover" })
    .png({ palette: true, quality: 78, effort: 9 }).toFile(small);

  web += statSync(webp).size;
  card += statSync(small).size;
  console.log(
    `  ✓ ${name} — ${Math.round(statSync(src).size / 1024)} KB → ` +
      `${Math.round(statSync(webp).size / 1024)} KB webp / ` +
      `${Math.round(statSync(small).size / 1024)} KB card png`,
  );
}
console.log(
  `\ntotal shipped: ${Math.round(web / 1024)} KB of WebP for the site, ` +
    `${Math.round(card / 1024)} KB of PNG for the share card`,
);

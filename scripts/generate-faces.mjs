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
];

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

async function generate(name, who) {
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
  if (!res.ok) throw new Error(`${name}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error(`${name}: no image returned`);
  const buf = Buffer.from(b64, "base64");
  await writeFile(path.join(outDir, `${name}.png`), buf);
  console.log(`  ✓ ${name}.png (${Math.round(buf.length / 1024)} KB)`);
}

const force = process.argv.includes("--force");
await mkdir(outDir, { recursive: true });

console.log(`generating ${PEOPLE.length} faces:`);
for (let i = 0; i < PEOPLE.length; i += 1) {
  const name = `f${String(i + 1).padStart(2, "0")}`;
  if (!force && (await exists(path.join(outDir, `${name}.png`)))) {
    console.log(`  · ${name}.png exists, skipping`);
    continue;
  }
  try {
    await generate(name, PEOPLE[i]);
  } catch (err) {
    console.error(`  ✗ ${err.message}`);
  }
}

/*
 * A 1024px PNG per face would be ~30 MB of avatars for tiles that never draw
 * larger than 68px. 160px WebP is 2x the largest use.
 */
const { default: sharp } = await import("sharp");
console.log("\noptimizing:");
let total = 0;
for (let i = 0; i < PEOPLE.length; i += 1) {
  const name = `f${String(i + 1).padStart(2, "0")}`;
  const src = path.join(outDir, `${name}.png`);
  if (!(await exists(src))) continue;
  const out = path.join(outDir, `${name}.webp`);
  await sharp(src).resize({ width: 160, height: 160, fit: "cover" })
    .webp({ quality: 82, effort: 6 }).toFile(out);
  const after = statSync(out).size;
  total += after;
  console.log(`  ✓ ${name}.webp — ${Math.round(statSync(src).size / 1024)} KB → ${Math.round(after / 1024)} KB`);
}
console.log(`\ntotal shipped: ${Math.round(total / 1024)} KB for ${PEOPLE.length} faces`);

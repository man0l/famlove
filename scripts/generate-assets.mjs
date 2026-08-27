#!/usr/bin/env node
/**
 * Generate famlove's visual assets with gpt-image-2.
 *
 * These are decorative only — stickers, glows, an empty-state illustration.
 * Nothing here carries information: every number, face and receipt on the site
 * is rendered from the database as real text, because the whole product is a
 * claim about what actually happened. Generated art sets the tone; it never
 * makes a claim.
 *
 *   OPENAI_API_KEY=… node scripts/generate-assets.mjs          # only missing
 *   OPENAI_API_KEY=… node scripts/generate-assets.mjs --force  # regenerate
 *   OPENAI_API_KEY=… node scripts/generate-assets.mjs heart    # one asset
 */
import { writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
// Sources out of public/, optimized output in. See scripts/generate-faces.mjs.
const srcDir = path.join(root, "assets", "stickers");
const outDir = path.join(root, "public", "stickers");

const key = process.env.OPENAI_API_KEY;
if (!key) {
  console.error("OPENAI_API_KEY is not set.");
  process.exit(1);
}

/**
 * One house style, stated once. The look is puffy 3D vinyl stickers — the
 * visual language people under 25 already read as "this is a fun thing", set
 * against famlove's near-black so the receipt stays the serious object.
 */
const HOUSE = [
  "Puffy 3D vinyl sticker, glossy inflated soft-plastic look with a thick",
  "rounded white die-cut border, bold saturated colours, soft studio",
  "highlights and a gentle drop shadow, playful and friendly, centred,",
  "isolated on a fully transparent background, no text, no letters,",
  "no words, no watermark, no background scenery.",
].join(" ");

const ASSETS = [
  {
    name: "penny",
    size: "1024x1024",
    // Deliberately not a real coin: no portrait, no country, no denomination
    // stamped on it. famlove prices in USD but is not a US product, and a
    // recognisable Lincoln cent reads as one.
    prompt: `A single shiny copper coin, tilted slightly and catching the light, blank and smooth except for one raised embossed heart in the centre of its face. No portrait, no face, no head, no person, no numbers, no country name, not a real currency. ${HOUSE}`,
  },
  {
    name: "heart",
    size: "1024x1024",
    prompt: `A plump glossy heart in hot pink (#ff3d68) with a bright highlight, slightly squashed and bouncy as if mid-wobble. ${HOUSE}`,
  },
  {
    name: "receipt",
    size: "1024x1024",
    // First attempt curled into a tube and read as a toilet roll. Flat, with
    // the torn edge clearly visible, is unmistakably a till receipt.
    prompt: `A small flat rectangular cream-white paper till receipt, portrait orientation, lying at a slight angle with only a gentle wave in the paper — not rolled, not a tube, not a cylinder. Its bottom edge is torn in a crisp zigzag. The paper is completely blank: no printing, no text, no letters, no numbers, no ruled lines. ${HOUSE}`,
  },
  {
    name: "sparkle",
    size: "1024x1024",
    prompt: `A cluster of three four-pointed sparkle stars in acid lime green (#c8ff3d), one large and two small, glossy and bouncy. ${HOUSE}`,
  },
  {
    name: "hands",
    size: "1024x1024",
    prompt: `Two friendly cartoon hands in different skin tones doing a small high five, rounded mitten-like fingers, no faces. ${HOUSE}`,
  },
  {
    name: "empty-wall",
    size: "1536x1024",
    prompt: [
      "A cheerful 3D illustration of an empty pinboard wall with a few blank",
      "round photo frames waiting to be filled, one tiny copper coin resting",
      "on the ledge beneath it. Soft inflated toy-like shapes, hot pink and",
      "acid lime accents on a dark charcoal background, gentle rim lighting,",
      "friendly and inviting rather than sad. No text, no letters, no words.",
    ].join(" "),
    background: "opaque",
  },
];

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function generate(asset) {
  const body = {
    model: "gpt-image-2",
    prompt: asset.prompt,
    size: asset.size,
    n: 1,
    output_format: "png",
    quality: "high",
    background: asset.background ?? "transparent",
  };

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`${asset.name}: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error(`${asset.name}: no image returned`);

  const file = path.join(srcDir, `${asset.name}.png`);
  await writeFile(file, Buffer.from(b64, "base64"));
  const kb = Math.round(Buffer.from(b64, "base64").length / 1024);
  console.log(`  ✓ ${asset.name}.png (${kb} KB)`);
}

const args = process.argv.slice(2);
const force = args.includes("--force");
const only = args.filter((a) => !a.startsWith("--"));

await mkdir(srcDir, { recursive: true });
await mkdir(outDir, { recursive: true });

const queue = ASSETS.filter((a) => !only.length || only.includes(a.name));
for (const asset of queue) {
  const file = path.join(srcDir, `${asset.name}.png`);
  if (!force && (await exists(file))) {
    console.log(`  · ${asset.name}.png exists, skipping`);
    continue;
  }
  try {
    await generate(asset);
  } catch (err) {
    console.error(`  ✗ ${err.message}`);
  }
}

/*
 * gpt-image-2 returns 1024px PNGs at around a megabyte each. Stickers render
 * between 14px and 110px on the site, so shipping those untouched would be a
 * 6 MB page for decoration nobody needs at full resolution. Downscale to 2×
 * the largest use and write WebP.
 */
const { default: sharp } = await import("sharp");

const OPTIMIZE = {
  penny: 320,
  heart: 320,
  receipt: 320,
  sparkle: 320,
  hands: 320,
  "empty-wall": 900,
};

console.log("\noptimizing:");
for (const [name, width] of Object.entries(OPTIMIZE)) {
  const src = path.join(srcDir, `${name}.png`);
  if (!(await exists(src))) continue;
  const out = path.join(outDir, `${name}.webp`);
  await sharp(src)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 90, effort: 6 })
    .toFile(out);
  const before = Math.round((await import("node:fs")).statSync(src).size / 1024);
  const after = Math.round((await import("node:fs")).statSync(out).size / 1024);
  console.log(`  ✓ ${name}.webp — ${before} KB → ${after} KB`);
}

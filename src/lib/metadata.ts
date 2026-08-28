/**
 * Read a site's own description of itself.
 *
 * Somebody listing a project has already written a name, a description and
 * chosen an icon — on their own site, in their own meta tags. Asking them to
 * type it a second time gets a worse answer, because the box is small and
 * they are in a hurry. So we fetch what they already published and hand it
 * back as a filled-in form they can correct.
 *
 * Everything here is a suggestion. Nothing is trusted, nothing is required,
 * and the person always sees the result before it is saved — a listing that
 * silently inherits whatever a page claimed about itself is a listing nobody
 * checked.
 */

export type SiteMeta = {
  title: string | null;
  description: string | null;
  image: string | null;
  favicon: string | null;
  /** The URL we actually ended up reading, after redirects. */
  resolved: string;
};

/** Only ever read the head, and only ever this much of it. */
const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 7000;

/*
 * Blocking private address space matters because this endpoint fetches a URL
 * a stranger chose: without it, "list your project at http://169.254.169.254/"
 * turns the listing form into a proxy for our own metadata service.
 *
 * On Cloudflare the worker also runs with global_fetch_strictly_public, which
 * refuses private destinations at the platform level. This check is here for
 * local dev, where nothing else is watching, and because a defence that only
 * exists in one environment is one deploy setting away from not existing.
 */
const PRIVATE_HOSTS =
  /^(localhost|127\.|0\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|\[?f[cd])/i;

export function publicHttpUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (PRIVATE_HOSTS.test(url.hostname)) return null;
  // A hostname with no dot is either a bare intranet name or localhost by
  // another spelling. Neither is a project anyone can visit.
  if (!url.hostname.includes(".")) return null;
  return url;
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  mdash: "—", ndash: "–", hellip: "…", rsquo: "’", lsquo: "‘",
  rdquo: "”", ldquo: "“",
};

function decode(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (whole, name) => ENTITIES[name.toLowerCase()] ?? whole)
    .replace(/\s+/g, " ")
    .trim();
}

/** Pull the attributes off one tag. Order-independent, unlike one big regex. */
function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-z][a-z0-9-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag))) {
    out[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? "";
  }
  return out;
}

function absolute(href: string | undefined, base: URL): string | null {
  if (!href) return null;
  try {
    const u = new URL(href, base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Read at most MAX_BYTES so a 40 MB "page" cannot hold a worker open. */
async function readCapped(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let html = "";
  let read = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    read += value.byteLength;
    html += decoder.decode(value, { stream: true });
    // The head is all we want, and it is always first.
    if (read >= MAX_BYTES || /<\/head>/i.test(html)) {
      await reader.cancel().catch(() => {});
      break;
    }
  }
  return html;
}

export async function fetchSiteMeta(raw: string): Promise<SiteMeta | null> {
  const url = publicHttpUrl(raw);
  if (!url) return null;

  let res: Response;
  try {
    res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        // Some sites serve a stub to anything that doesn't look like a browser.
        "user-agent":
          "Mozilla/5.0 (compatible; famlove.lol/1.0; +https://famlove.lol)",
        accept: "text/html,application/xhtml+xml",
      },
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("html")) return null;

  // Redirects mean the base for relative URLs is where we landed, not where
  // we knocked.
  const base = publicHttpUrl(res.url) ?? url;
  const html = await readCapped(res);
  const head = html.split(/<\/head>/i)[0] ?? html;

  const meta: Record<string, string> = {};
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const a = attrs(tag);
    const key = (a.property ?? a.name ?? a.itemprop ?? "").toLowerCase();
    if (key && a.content && !meta[key]) meta[key] = a.content;
  }

  const icons: { href: string; size: number; apple: boolean }[] = [];
  // Pre-OpenGraph, and still emitted by a lot of CMS themes.
  let linkImage: string | null = null;
  for (const tag of head.match(/<link\b[^>]*>/gi) ?? []) {
    const a = attrs(tag);
    const rel = (a.rel ?? "").toLowerCase();
    if (/\bimage_src\b/.test(rel) && !linkImage) linkImage = absolute(a.href, base);
    if (!/\b(icon|shortcut icon|apple-touch-icon|apple-touch-icon-precomposed)\b/.test(rel)) {
      continue;
    }
    const href = absolute(a.href, base);
    if (!href) continue;
    // "32x32" → 32. Bigger is better: these are drawn at 2x on retina.
    const size = Number((a.sizes ?? "").split(/[x×\s]/)[0]) || 0;
    icons.push({ href, size, apple: rel.includes("apple") });
  }
  // An apple-touch-icon is a 180px PNG by convention, which beats a 16px .ico.
  icons.sort((a, b) => (b.size || (b.apple ? 180 : 0)) - (a.size || (a.apple ? 180 : 0)));

  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];

  /*
   * The name box wants "Stripe", not "Stripe | Financial Infrastructure to
   * Grow Your Revenue". A <title> is written for search engines and is
   * usually the brand plus a pitch, joined by a separator; og:site_name is
   * the brand on its own, when a site bothers to publish it.
   */
  const title = shortName(
    meta["og:site_name"] ?? null,
    meta["og:title"] ?? meta["twitter:title"] ?? titleTag ?? null,
  );
  const description =
    meta["og:description"] ?? meta["twitter:description"] ?? meta.description ?? null;
  /*
   * Every place a site might have put its picture, best first. og:image is
   * the one that matters; the rest are what sites that never got around to
   * OpenGraph still emit — `image` covers <meta itemprop="image">, since the
   * map above keys itemprop alongside property and name.
   */
  const image =
    absolute(
      meta["og:image"] ??
        meta["og:image:url"] ??
        meta["og:image:secure_url"] ??
        meta["twitter:image"] ??
        meta["twitter:image:src"] ??
        meta["image"] ??
        meta["thumbnail"] ??
        null,
      base,
    ) ?? linkImage;

  let favicon: string | null = icons[0]?.href ?? null;
  if (!favicon) {
    // Nearly every site has one here even without declaring it — but check,
    // rather than storing a URL that 404s on every listing row forever.
    const guess = new URL("/favicon.ico", base).toString();
    favicon = (await reachable(guess)) ? guess : null;
  }

  return {
    title: title ? decode(title).slice(0, 120) : null,
    description: description ? decode(description).slice(0, 300) : null,
    image,
    favicon,
    resolved: base.toString(),
  };
}

function shortName(siteName: string | null, title: string | null): string | null {
  if (siteName?.trim()) return siteName.trim();
  if (!title) return null;
  const first = title.split(/\s+[|\u2013\u2014\u00b7\u2022:]\s+/)[0].trim();
  // Only take the first segment when it reads like a name rather than the
  // whole sentence having been cut in half.
  return first.length >= 2 && first.length <= 40 ? first : title;
}

async function reachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

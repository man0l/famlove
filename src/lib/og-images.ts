import { getCloudflareContext } from "@opennextjs/cloudflare";
import { SITE_URL } from "./config";

const short = (url: string) => url.split("/").slice(-1)[0].slice(0, 28);

/**
 * Read one image, from wherever it actually lives.
 *
 * Our own /faces come from the ASSETS binding rather than over the network.
 * A worker fetching its own hostname is a subrequest back through the edge
 * into this same worker, and it does not come back — the first version of
 * this drew an empty grid in production while working perfectly in local dev.
 * The binding hands over the file directly, with no hop at all.
 */
async function load(url: string): Promise<Response> {
  if (url.startsWith(SITE_URL)) {
    try {
      const { env } = getCloudflareContext();
      const assets = (env as unknown as { ASSETS?: { fetch: (r: Request) => Promise<Response> } })
        .ASSETS;
      if (assets) return await assets.fetch(new Request(url));
    } catch {
      // Not on Cloudflare — local dev serves the same path over HTTP.
    }
  }
  return fetch(url, { signal: AbortSignal.timeout(5000) });
}

/**
 * Fetch each distinct image once and return it as a data URI.
 *
 * Deduplicated because a wall of forty backers draws from a set of thirty-odd
 * faces, and forty subrequests where eleven would do is forty chances to be
 * slow. An image that cannot be fetched is simply absent from the map, and
 * the caller falls back to the initial tile — one unreachable avatar must
 * never cost the whole card.
 */
export async function inlineImages(
  urls: string[],
  notes?: string[],
  /** Skip anything larger than this. Our own faces are known-small; a
   *  stranger's og:image is whatever they felt like uploading, and a 12MB
   *  hero has to be dropped rather than base64'd into the card. */
  maxBytes?: number,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  await Promise.all(
    [...new Set(urls)].map(async (url) => {
      try {
        const res = await load(url);
        if (!res.ok) {
          notes?.push(`${short(url)}: ${res.status}`);
          return;
        }
        const type = res.headers.get("content-type") ?? "image/png";
        if (!type.startsWith("image/")) return;
        const declared = Number(res.headers.get("content-length") ?? 0);
        if (maxBytes && declared > maxBytes) {
          notes?.push(`${short(url)}: ${declared}B too big`);
          return;
        }
        const bytes = new Uint8Array(await res.arrayBuffer());
        // Content-Length lies, or is absent on a chunked response.
        if (maxBytes && bytes.length > maxBytes) {
          notes?.push(`${short(url)}: ${bytes.length}B too big`);
          return;
        }
        let binary = "";
        const CHUNK = 0x8000;
        for (let i = 0; i < bytes.length; i += CHUNK) {
          binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
        }
        out.set(url, `data:${type};base64,${btoa(binary)}`);
      } catch (err) {
        /* absent from the map, so the caller draws initials instead */
        notes?.push(`${short(url)}: ${(err as Error).message}`);
      }
    }),
  );
  return out;
}

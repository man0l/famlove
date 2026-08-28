/**
 * Live traffic numbers for the footer, read from DataFast.
 *
 * Server-side because the key is a secret: a df_ token can read this site's
 * analytics *and* write goals and payment events, so it must never reach a
 * browser. It is a Cloudflare secret, not a NEXT_PUBLIC_ var.
 *
 * This is entirely separate from the tracking script and is not gated on
 * consent, because it reads aggregate counts the server already holds and
 * sets nothing on anybody's device.
 */

const BASE = "https://datafa.st/api/v1";

export type SiteTraffic = { online: number; visitors: number };

async function read(path: string): Promise<unknown | null> {
  const key = process.env.DATAFAST_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(4000),
      /*
       * Cached for a minute. Every page renders this, and a footer is not
       * worth a round trip to a third party on each one — nor is it worth
       * holding the page up if DataFast is slow, hence the short timeout and
       * the null-on-failure below.
       */
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { status?: string; [k: string]: unknown };
    return json.status === "success" ? json : null;
  } catch {
    return null;
  }
}

export async function siteTraffic(): Promise<SiteTraffic | null> {
  const [live, series] = await Promise.all([
    read("/analytics/realtime"),
    /*
     * Monthly buckets, because `from` does not widen the window — the API
     * returns a fixed number of points per interval, so month is the widest
     * total available (a year). Fine for a site measured in days; if famlove
     * is ever older than that, this becomes "visitors this year".
     */
    read("/analytics/timeseries?fields=visitors&interval=month"),
  ]);

  const online = Number(
    ((live as { data?: { visitors?: number }[] } | null)?.data?.[0]?.visitors) ?? 0,
  );
  const visitors = Number(
    ((series as { totals?: { visitors?: number } } | null)?.totals?.visitors) ?? 0,
  );

  // Both reads failing is different from both being genuinely zero: say
  // nothing rather than claim an empty house.
  if (live === null && series === null) return null;
  return { online, visitors };
}

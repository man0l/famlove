/**
 * The Cloudflare entrypoint.
 *
 * `@opennextjs/cloudflare` generates `.open-next/worker.js` with a `fetch`
 * handler and nothing else. Cron Triggers don't send HTTP requests — they
 * invoke a `scheduled()` export — so the generated worker is wrapped rather
 * than used directly, and the nightly rollup gets a handler to land in.
 *
 * On Vercel this job is a line in vercel.json; both are kept so the app can
 * deploy to either.
 */
// @ts-expect-error — generated at build time by `opennextjs-cloudflare build`
import openNextWorker from "./.open-next/worker.js";

type Env = {
  NEXT_PUBLIC_SITE_URL?: string;
  CRON_SECRET?: string;
};

export default {
  fetch: openNextWorker.fetch,

  /**
   * 00:05 UTC: write yesterday's streaks and send the one email famlove has.
   *
   * The work already exists as a route handler, so this calls it over the
   * worker's own public URL rather than duplicating it — which is also why
   * `global_fetch_strictly_public` is set in wrangler.jsonc.
   */
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const base = env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
    if (!base) {
      console.error("[cron] NEXT_PUBLIC_SITE_URL is not set; skipping rollup");
      return;
    }

    ctx.waitUntil(
      (async () => {
        try {
          const res = await fetch(`${base}/api/cron/rollup`, {
            headers: env.CRON_SECRET
              ? { Authorization: `Bearer ${env.CRON_SECRET}` }
              : {},
          });
          const body = await res.text();
          console.log(`[cron] rollup ${res.status}: ${body.slice(0, 200)}`);
        } catch (err) {
          console.error("[cron] rollup failed:", err);
        }
      })(),
    );
  },
};

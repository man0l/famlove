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
   * 00:05 UTC: write yesterday's streaks, send the digests, open today's
   * rallies and fire standing orders.
   *
   * The work exists as a route handler, so this invokes that handler directly
   * rather than fetching the worker's own public URL. The round trip it used
   * to make was a real network request out of the worker and back in through
   * the edge — DNS, TLS, a second worker invocation, and the secret travelling
   * over the wire, every one of them a way for a job nobody is watching to
   * fail silently. This job produced no rows at all in its first day of
   * existence: no rollups, no emails, and so no rallies, which left the site
   * telling owners "a rally opens itself each morning" while none ever did.
   * Calling the handler in-process removes every one of those failure modes.
   *
   * It is awaited rather than left to waitUntil so an exception surfaces in
   * the invocation's own logs instead of vanishing into a detached promise.
   */
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const base = env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://famlove.lol";

    try {
      const request = new Request(`${base}/api/cron/rollup`, {
        headers: env.CRON_SECRET
          ? { Authorization: `Bearer ${env.CRON_SECRET}` }
          : {},
      });
      const res = await openNextWorker.fetch(request, env, ctx);
      const body = await res.text();
      console.log(`[cron] rollup ${res.status}: ${body.slice(0, 300)}`);
      if (!res.ok) throw new Error(`rollup returned ${res.status}`);
    } catch (err) {
      // Rethrow: a thrown scheduled handler is recorded as a failed cron
      // invocation, which is visible. A swallowed one looks like success.
      console.error("[cron] rollup failed:", err);
      throw err;
    }
  },
};

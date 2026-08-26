import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * Every page in famlove is `force-dynamic` — the boards, the walls and the
 * receipts are all "what is true right now", so there is nothing to
 * incrementally cache and no R2 bucket to keep in sync. The default in-memory
 * overrides are the right ones here.
 */
export default defineCloudflareConfig();

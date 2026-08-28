import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { SITE_URL } from "@/lib/config";

export const dynamic = "force-dynamic";

/*
 * Crawlers follow every link on a page. Counting them would turn "people went
 * and looked" into "how often we were indexed", which is a different and much
 * less interesting number. This catches the honest ones by name; the rest are
 * why the counter is described as clicks rather than humans.
 */
const BOT =
  /bot|crawler|spider|crawling|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|discordbot|preview|monitor|headless|lighthouse|pingdom|curl|wget|python-requests|node-fetch/i;

/**
 * Send somebody to a project, and count that it happened.
 *
 * The link on the board points here rather than straight out, because a
 * counter needs a request it can see — an <a> to the project's own domain is
 * invisible to us by design.
 *
 * The redirect is 302 and explicitly not cached: a 301 would be remembered by
 * the browser and every later click would skip famlove entirely, so the
 * number would quietly stop growing while looking like it worked.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const rows = (await sql`
    SELECT url FROM projects WHERE slug = ${slug} AND removed_at IS NULL
  `) as { url: string }[];

  const target = rows[0]?.url;
  if (!target) {
    return NextResponse.redirect(new URL("/", SITE_URL), { status: 302 });
  }

  const agent = request.headers.get("user-agent") ?? "";
  if (!BOT.test(agent)) {
    // Counted before the redirect rather than after: once the response goes
    // out the request is over, and a count that races the redirect is a count
    // that sometimes does not happen.
    await sql`
      UPDATE projects SET clicks = clicks + 1 WHERE slug = ${slug}
    `;
  }

  return NextResponse.redirect(target, {
    status: 302,
    headers: { "Cache-Control": "no-store" },
  });
}

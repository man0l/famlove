import { after, NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { giveLove } from "@/lib/queries";
import { rateLimit } from "@/lib/ratelimit";
import { DAILY_GIVE_CEILING } from "@/lib/config";
import { sql } from "@/lib/db";
import { sendFirstBackerOfDay } from "@/lib/email";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  no_project: "That project doesn't exist.",
  already_today: "You already showed up today. Come back after 00:00 UTC.",
  empty_wallet: "Your jar is empty. Top up and try again.",
  give_ceiling: `That's ${DAILY_GIVE_CEILING} today — the give ceiling. Tomorrow.`,
  own_project: "You can't show up for yourself. That's the whole idea.",
};

export async function POST(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const body = (await request.json().catch(() => ({}))) as { slug?: string };
  const slug = body.slug?.trim();
  if (!slug) {
    return NextResponse.json({ ok: false, error: "slug_required" }, { status: 400 });
  }

  // Courtesy limit only; the real caps live in the database.
  const limit = await rateLimit(`love:${user.id}`, 120, 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "slow_down", message: "Slow down." },
      { status: 429 },
    );
  }

  const result = await giveLove(user.id, slug);
  if (result.ok) notifyOwner(slug, user.handle, result.backersToday);
  if (!result.ok) {
    return NextResponse.json(
      { ...result, message: MESSAGES[result.error] ?? "Couldn't do that." },
      { status: result.error === "no_project" ? 404 : 409 },
    );
  }
  return NextResponse.json(result);
}


/**
 * Tell the owner somebody turned up — on the day's first cent only.
 *
 * Deliberately not awaited. The buyer's confetti should not wait on an email
 * API, and the send is claimed in the database so a lost request costs a
 * notification rather than correctness. On Workers it is handed to
 * waitUntil so the runtime keeps the request alive long enough to finish.
 */
function notifyOwner(slug: string, backerHandle: string, backersToday: number) {
  if (backersToday !== 1) return;

  /*
   * `after()` is the framework's own hook for work that should outlive the
   * response — Next keeps the invocation alive for it, and the Cloudflare
   * adapter maps it onto waitUntil. The alternative, a floating promise, is
   * killed the moment a Worker returns.
   */
  after(async () => {
    try {
      const [row] = (await sql`
        SELECT u.id AS owner_id, u.email, p.name
        FROM projects p
        JOIN users u ON u.id = p.owner_id
        WHERE p.slug = ${slug} AND p.removed_at IS NULL AND u.email IS NOT NULL
      `) as Record<string, unknown>[];
      if (!row) return;

      await sendFirstBackerOfDay({
        ownerId: Number(row.owner_id),
        to: String(row.email),
        projectName: String(row.name),
        slug,
        backerHandle,
        day: new Date().toISOString().slice(0, 10),
      });
    } catch (err) {
      console.error("[love] owner notification failed:", err);
    }
  });
}

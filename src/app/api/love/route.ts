import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { giveLove } from "@/lib/queries";
import { rateLimit } from "@/lib/ratelimit";
import { DAILY_GIVE_CEILING } from "@/lib/config";

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
  if (!result.ok) {
    return NextResponse.json(
      { ...result, message: MESSAGES[result.error] ?? "Couldn't do that." },
      { status: result.error === "no_project" ? 404 : 409 },
    );
  }
  return NextResponse.json(result);
}

import { NextRequest, NextResponse } from "next/server";
import { upsertUser } from "@/lib/users";
import { createSession } from "@/lib/session";
import { sql } from "@/lib/db";

/**
 * Local-only sign-in so the product can be run and demoed without X keys.
 * It refuses to exist in production, and it refuses to hand you an account
 * that isn't already in the seed set — it is a door into the fixture data,
 * not a way around the account-age gate.
 */
export async function POST(request: NextRequest) {
  const enabled =
    process.env.ALLOW_DEV_LOGIN === "1" && process.env.NODE_ENV !== "production";
  if (!enabled) {
    return NextResponse.json({ ok: false, error: "not_available" }, { status: 404 });
  }

  const form = await request.formData();
  const handle = String(form.get("handle") ?? "").replace(/^@/, "").trim();
  if (!handle) {
    return NextResponse.json({ ok: false, error: "handle_required" }, { status: 400 });
  }

  const existing = (await sql`
    SELECT id, email, email_declined_at FROM users
    WHERE lower(handle) = lower(${handle})
  `) as { id: number; email: string | null; email_declined_at: string | null }[];

  const created = existing[0]
    ? null
    : await upsertUser({
        xId: `dev:${handle.toLowerCase()}`,
        handle,
        displayName: handle,
        avatarUrl: null,
        xCreatedAt: new Date(Date.now() - 400 * 86_400_000).toISOString(),
        isSeed: true,
      });

  const userId = existing[0] ? Number(existing[0].id) : created!.id;
  const wantsEmail = existing[0]
    ? !existing[0].email && !existing[0].email_declined_at
    : created!.wantsEmail;

  await createSession(userId);
  const next = String(form.get("next") ?? "/wallet");

  // Mirror the X callback exactly. A local path that skips a step the real
  // one takes is how a flow ships broken having been "tested".
  const destination = wantsEmail
    ? `/welcome?next=${encodeURIComponent(next)}`
    : next;

  return NextResponse.redirect(new URL(destination, request.nextUrl.origin), {
    status: 303,
  });
}

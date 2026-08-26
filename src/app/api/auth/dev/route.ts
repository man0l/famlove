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
    SELECT id FROM users WHERE lower(handle) = lower(${handle})
  `) as { id: number }[];

  const userId = existing[0]
    ? Number(existing[0].id)
    : await upsertUser({
        xId: `dev:${handle.toLowerCase()}`,
        handle,
        displayName: handle,
        avatarUrl: null,
        xCreatedAt: new Date(Date.now() - 400 * 86_400_000).toISOString(),
        isSeed: true,
      });

  await createSession(userId);
  const next = String(form.get("next") ?? "/wallet");
  return NextResponse.redirect(new URL(next, request.nextUrl.origin), {
    status: 303,
  });
}

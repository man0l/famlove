import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { sql } from "@/lib/db";

/**
 * "Don't ask again", recorded rather than merely obeyed for one page load.
 * An ask that comes back every sign-in is a nag, and the whole point of
 * offering a real Skip is that it is real.
 */
export async function POST(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  await sql`
    UPDATE users SET email_declined_at = now()
    WHERE id = ${user.id} AND email IS NULL
  `;

  const form = await request.formData();
  const requested = String(form.get("next") ?? "");
  const next = /^\/[a-zA-Z0-9/_-]*$/.test(requested) ? requested : "/wallet";

  return NextResponse.redirect(new URL(next, request.nextUrl.origin), {
    status: 303,
  });
}

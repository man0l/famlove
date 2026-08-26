import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { sql } from "@/lib/db";

/** The only stored contact detail, and it is opt-in: X OAuth gives us none. */
export async function POST(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const form = await request.formData();
  const raw = String(form.get("email") ?? "").trim();
  const email = raw === "" ? null : raw;

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.redirect(
      new URL("/wallet?error=bad_email", request.nextUrl.origin),
      { status: 303 },
    );
  }

  await sql`UPDATE users SET email = ${email} WHERE id = ${user.id}`;
  return NextResponse.redirect(new URL("/wallet?saved=1", request.nextUrl.origin), {
    status: 303,
  });
}

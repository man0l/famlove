import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { validUnsubscribe } from "@/lib/unsubscribe";
import { SITE_URL } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Stop the emails. POST only, and no session required — the signature in the
 * link is the proof, because somebody unsubscribing from their inbox is very
 * often not signed in, and a login wall in front of an unsubscribe is how a
 * sender gets marked as spam instead.
 *
 * POST rather than GET is what keeps it safe: mail clients and security
 * scanners routinely fetch every link in a message, and a GET that
 * unsubscribed would quietly cancel people's mail for them. This also makes
 * the route usable as an RFC 8058 List-Unsubscribe-Post target, which is what
 * Gmail and Apple Mail call when somebody uses their built-in button.
 */
async function unsubscribe(userId: number, token: string): Promise<boolean> {
  if (!Number.isInteger(userId) || userId <= 0) return false;
  if (!(await validUnsubscribe(userId, token))) return false;
  /*
   * Clearing the address is the same thing the wallet form does, and it also
   * records the refusal so the site never asks this person for an email again
   * — an unsubscribe that leads to a fresh "give us your email" prompt is not
   * an unsubscribe.
   */
  await sql`
    UPDATE users
    SET email = NULL, email_declined_at = COALESCE(email_declined_at, now())
    WHERE id = ${userId}
  `;
  return true;
}

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const params = request.nextUrl.searchParams;
  const userId = Number(form?.get("u") ?? params.get("u") ?? 0);
  const token = String(form?.get("t") ?? params.get("t") ?? "");

  const ok = await unsubscribe(userId, token);

  // A List-Unsubscribe-Post call comes from a mail provider, not a browser:
  // it wants a status code, not a redirect to a page nobody will look at.
  if (request.headers.get("list-unsubscribe") === "One-Click") {
    return new NextResponse(null, { status: ok ? 200 : 400 });
  }

  return NextResponse.redirect(
    new URL(ok ? "/unsubscribe?done=1" : "/unsubscribe?bad=1", SITE_URL),
    { status: 303 },
  );
}

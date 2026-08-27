import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, fetchProfile, gateProfile, XAuthError } from "@/lib/x-oauth";
import { upsertUser } from "@/lib/users";
import { createSession } from "@/lib/session";
import { SITE_URL } from "@/lib/config";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const jar = await cookies();

  const back = (query: string) =>
    NextResponse.redirect(`${SITE_URL}/join?${query}`);

  if (params.get("error")) return back("error=cancelled");

  const code = params.get("code");
  const state = params.get("state");
  const expectedState = jar.get("x_state")?.value;
  const verifier = jar.get("x_verifier")?.value;
  const next = jar.get("x_next")?.value;

  jar.delete("x_state");
  jar.delete("x_verifier");
  jar.delete("x_next");

  if (!code || !state || !verifier || state !== expectedState) {
    return back("error=bad_state");
  }

  try {
    const token = await exchangeCode(code, verifier);
    const profile = await fetchProfile(token);

    const gate = gateProfile(profile);
    if (!gate.ok) {
      return back(`error=gate&reason=${encodeURIComponent(gate.reason)}`);
    }

    const banned = (await sql`
      SELECT banned_at FROM users WHERE x_id = ${profile.id}
    `) as { banned_at: string | null }[];
    if (banned[0]?.banned_at) return back("error=banned");

    const { id: userId, wantsEmail } = await upsertUser({
      xId: profile.id,
      handle: profile.username,
      displayName: profile.name,
      avatarUrl: profile.avatarUrl,
      xCreatedAt: profile.createdAt,
    });

    await createSession(userId);

    // Back to whatever they were trying to do, not a generic landing page.
    const destination =
      next && /^\/[a-zA-Z0-9/_-]*$/.test(next) ? next : "/wallet";

    /*
     * X hands over no email, so the only way famlove ever gets one is by
     * asking. Ask here, once, while the person is already mid-flow — and
     * carry their destination through, so saying yes or no both land them
     * where they were going. Never a gate: somebody who came to spend a cent
     * must be able to walk past it.
     */
    if (wantsEmail) {
      return NextResponse.redirect(
        `${SITE_URL}/welcome?next=${encodeURIComponent(destination)}`,
      );
    }
    return NextResponse.redirect(`${SITE_URL}${destination}`);
  } catch (err) {
    // Surface X's own reason (redirect_uri_mismatch, invalid_client, …) so a
    // failed sign-in can be diagnosed. Whitelisted characters only — the value
    // comes from X but is echoed into a URL.
    const why =
      err instanceof XAuthError
        ? err.code.replace(/[^a-z0-9_]/gi, "").slice(0, 40)
        : "unknown";
    return back(`error=x_failed&why=${why}`);
  }
}

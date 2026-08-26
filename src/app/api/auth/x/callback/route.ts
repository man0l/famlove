import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, fetchProfile, gateProfile } from "@/lib/x-oauth";
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

  jar.delete("x_state");
  jar.delete("x_verifier");

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

    const userId = await upsertUser({
      xId: profile.id,
      handle: profile.username,
      displayName: profile.name,
      avatarUrl: profile.avatarUrl,
      xCreatedAt: profile.createdAt,
    });

    await createSession(userId);
    return NextResponse.redirect(`${SITE_URL}/wallet`);
  } catch {
    return back("error=x_failed");
  }
}

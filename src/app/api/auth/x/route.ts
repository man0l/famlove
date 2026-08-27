import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  authorizeUrl,
  pkceChallenge,
  randomToken,
  xConfigured,
} from "@/lib/x-oauth";
import { SITE_URL } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!xConfigured()) {
    return NextResponse.redirect(`${SITE_URL}/join?error=x_not_configured`);
  }

  /*
   * Where they were heading before we interrupted them to sign in. Without
   * this a builder who clicks "List your project" is bounced to X, then
   * dropped on their wallet, and has to find their way back to the thing
   * they actually wanted to do.
   */
  const next = new URL(request.url).searchParams.get("next");
  const safeNext = next && /^\/[a-zA-Z0-9/_-]*$/.test(next) ? next : null;

  const state = randomToken(16);
  const verifier = randomToken(48);
  const challenge = await pkceChallenge(verifier);

  const jar = await cookies();
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  };
  jar.set("x_state", state, options);
  jar.set("x_verifier", verifier, options);
  if (safeNext) jar.set("x_next", safeNext, options);

  return NextResponse.redirect(authorizeUrl(state, challenge));
}

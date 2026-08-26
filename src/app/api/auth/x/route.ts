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

export async function GET() {
  if (!xConfigured()) {
    return NextResponse.redirect(`${SITE_URL}/join?error=x_not_configured`);
  }

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

  return NextResponse.redirect(authorizeUrl(state, challenge));
}

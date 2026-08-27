import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { fetchSiteMeta } from "@/lib/metadata";

/**
 * Read a URL's meta tags so the listing form can fill itself in.
 *
 * Signed-in only, and not because the data is sensitive — it is a public web
 * page — but because an unauthenticated "fetch any URL and tell me what came
 * back" endpoint is a proxy with our name on the request log.
 */
export async function GET(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;
  void user;

  const target = request.nextUrl.searchParams.get("url") ?? "";
  const meta = await fetchSiteMeta(target);

  // Not being able to read a site is not an error the person needs to act on:
  // they can type the two fields themselves, as they always could.
  if (!meta) return NextResponse.json({ ok: false }, { status: 200 });

  return NextResponse.json({ ok: true, meta }, { status: 200 });
}

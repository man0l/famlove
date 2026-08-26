import { NextResponse } from "next/server";
import { destroySession } from "@/lib/session";
import { SITE_URL } from "@/lib/config";

export async function POST() {
  await destroySession();
  return NextResponse.redirect(SITE_URL, { status: 303 });
}

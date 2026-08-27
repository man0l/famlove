import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { sql } from "@/lib/db";
import { freeSlug, normalizeUrl } from "@/lib/users";
import { isUniqueViolation } from "@/lib/queries";

export async function POST(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  const tagline = String(form.get("tagline") ?? "").trim().slice(0, 90);
  const rawUrl = String(form.get("url") ?? "");

  const fail = (message: string) =>
    NextResponse.redirect(
      new URL(`/new?error=${encodeURIComponent(message)}`, request.nextUrl.origin),
      { status: 303 },
    );

  if (name.length < 2) return fail("Give it a name.");
  const url = normalizeUrl(rawUrl);
  if (!url) return fail("That URL doesn't look real.");

  const slug = await freeSlug(name);

  try {
    await sql`
      INSERT INTO projects (owner_id, slug, name, url, tagline)
      VALUES (${user.id}, ${slug}, ${name}, ${url}, ${tagline})
    `;
  } catch (err) {
    if (isUniqueViolation(err)) {
      // owner_id is UNIQUE: one project per person in v1, by design.
      return fail("You already have a project. One each, for now.");
    }
    throw err;
  }

  // ?listed=1 arms the share launcher. The thirty seconds after listing is
  // when a builder is most willing to ask their fam, and an empty wall is the
  // worst state this product has.
  return NextResponse.redirect(
    new URL(`/p/${slug}?listed=1`, request.nextUrl.origin),
    { status: 303 },
  );
}

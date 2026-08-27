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

  let created: { slug: string }[];
  try {
    // No cap to count, so nothing to race: a plain insert. See config.ts for
    // why listing is unlimited and what stops spam instead.
    created = (await sql`
      INSERT INTO projects (owner_id, slug, name, url, tagline)
      VALUES (${user.id}, ${slug}, ${name}, ${url}, ${tagline})
      RETURNING slug
    `) as { slug: string }[];
  } catch (err) {
    if (isUniqueViolation(err)) {
      return fail("That name is already taken. Try another.");
    }
    throw err;
  }

  if (!created[0]) return fail("Couldn't save that one. Try again.");

  return NextResponse.redirect(
    new URL(`/p/${slug}?listed=1`, request.nextUrl.origin),
    { status: 303 },
  );
}

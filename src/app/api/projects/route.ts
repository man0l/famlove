import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { requireUser } from "@/lib/session";
import { sql } from "@/lib/db";
import { freeSlug, normalizeUrl } from "@/lib/users";
import { isUniqueViolation } from "@/lib/queries";
import { publicHttpUrl, fetchSiteMeta } from "@/lib/metadata";

export async function POST(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  const tagline = String(form.get("tagline") ?? "").trim().slice(0, 90);
  const rawUrl = String(form.get("url") ?? "");

  /*
   * The icon and share image arrive from the form, which got them from the
   * site's own meta tags — but they arrive as a string a person could have
   * typed anything into, so they are re-checked here rather than trusted.
   * Anything that isn't a public http(s) URL is simply dropped: a listing
   * without an icon looks like it always did, which is a fine outcome.
   */
  const art = (field: string): string | null => {
    const value = String(form.get(field) ?? "").trim();
    if (!value || value.length > 1000) return null;
    return publicHttpUrl(value)?.toString() ?? null;
  };
  const faviconUrl = art("favicon_url");
  const imageUrl = art("image_url");

  const fail = (message: string) =>
    NextResponse.redirect(
      new URL(`/new?error=${encodeURIComponent(message)}`, request.nextUrl.origin),
      { status: 303 },
    );

  if (name.length < 2) return fail("Give it a name.");
  const url = normalizeUrl(rawUrl);
  if (!url) return fail("That URL doesn't look real.");

  const slug = await freeSlug(name);

  let created: { id: number; slug: string }[];
  try {
    // No cap to count, so nothing to race: a plain insert. See config.ts for
    // why listing is unlimited and what stops spam instead.
    created = (await sql`
      INSERT INTO projects (owner_id, slug, name, url, tagline, favicon_url, image_url)
      VALUES (${user.id}, ${slug}, ${name}, ${url}, ${tagline},
              ${faviconUrl}, ${imageUrl})
      RETURNING id, slug
    `) as { id: number; slug: string }[];
  } catch (err) {
    if (isUniqueViolation(err)) {
      return fail("That name is already taken. Try another.");
    }
    throw err;
  }

  const project = created[0];
  if (!project) return fail("Couldn't save that one. Try again.");

  /*
   * The form reads the site in the browser, which covers everybody with
   * JavaScript — but a form that only works with JavaScript is a form that
   * quietly does less for some people. If nothing came through, read the site
   * here instead, after the response has gone, so listing stays instant.
   */
  if (!faviconUrl || !imageUrl) {
    after(async () => {
      const meta = await fetchSiteMeta(url);
      if (!meta) return;
      await sql`
        UPDATE projects
        SET favicon_url = COALESCE(favicon_url, ${meta.favicon}),
            image_url   = COALESCE(image_url, ${meta.image})
        WHERE id = ${project.id}
      `;
    });
  }

  return NextResponse.redirect(
    new URL(`/p/${project.slug}?listed=1`, request.nextUrl.origin),
    { status: 303 },
  );
}

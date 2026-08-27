import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { sql } from "@/lib/db";
import { projectBySlug } from "@/lib/queries";

/** Turn a standing order on or off for one project. */
export async function POST(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const body = (await request.json().catch(() => ({}))) as {
    slug?: string;
    on?: boolean;
  };
  const slug = body.slug?.trim();
  if (!slug) {
    return NextResponse.json({ ok: false, error: "slug_required" }, { status: 400 });
  }

  const project = await projectBySlug(slug);
  if (!project) {
    return NextResponse.json({ ok: false, error: "no_project" }, { status: 404 });
  }
  if (project.ownerId === user.id) {
    return NextResponse.json({ ok: false, error: "own_project" }, { status: 409 });
  }

  if (body.on) {
    await sql`
      INSERT INTO auto_loves (user_id, project_id)
      VALUES (${user.id}, ${project.id})
      ON CONFLICT DO NOTHING
    `;
  } else {
    await sql`
      DELETE FROM auto_loves
      WHERE user_id = ${user.id} AND project_id = ${project.id}
    `;
  }

  return NextResponse.json({ ok: true, on: Boolean(body.on) });
}

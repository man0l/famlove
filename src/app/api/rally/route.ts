import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { sql } from "@/lib/db";
import { startRally } from "@/lib/queries";
import { RALLY_MAX_GOAL, RALLY_MIN_GOAL } from "@/lib/config";

export async function POST(request: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  const form = await request.formData();
  const goal = Number(form.get("goal") ?? 0);

  const rows = (await sql`
    SELECT id, slug FROM projects WHERE owner_id = ${user.id} AND removed_at IS NULL
  `) as { id: number; slug: string }[];
  const project = rows[0];
  if (!project) {
    return NextResponse.redirect(new URL("/new", request.nextUrl.origin), {
      status: 303,
    });
  }

  const back = (query: string) =>
    NextResponse.redirect(
      new URL(`/p/${project.slug}?${query}`, request.nextUrl.origin),
      { status: 303 },
    );

  if (!Number.isInteger(goal) || goal < RALLY_MIN_GOAL || goal > RALLY_MAX_GOAL) {
    return back(`rally_error=${encodeURIComponent(`Pick a goal between ${RALLY_MIN_GOAL} and ${RALLY_MAX_GOAL}.`)}`);
  }

  const result = await startRally(Number(project.id), goal);
  if (!result.ok) {
    return back("rally_error=One+rally+per+project+per+week.");
  }
  return back("rally=started");
}

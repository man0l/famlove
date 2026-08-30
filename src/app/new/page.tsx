import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { sql } from "@/lib/db";
import Link from "next/link";
import { Sticker } from "@/components/Sticker";
import { NewProjectForm } from "@/components/NewProjectForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "List a product" };

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const user = await currentUser();
  if (!user) redirect("/join?next=%2Fnew");

  const existing = (await sql`
    SELECT slug, name FROM projects
    WHERE owner_id = ${user.id} AND removed_at IS NULL ORDER BY id
  `) as { slug: string; name: string }[];

  const query = await searchParams;

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="flex items-start justify-between gap-4">
        <h1 className="display text-4xl">List a product</h1>
        <Sticker name="receipt" size={70} float="slow" className="shrink-0" />
      </div>
      <p className="mt-3 text-mute">Paste the link. We fill in the rest.</p>

      {existing.length > 0 && (
        <div className="card mt-5 p-4">
          <p className="text-xs font-medium text-mute">
            You already have {existing.length}{" "}
            {existing.length === 1 ? "project" : "projects"}
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {existing.map((project) => (
              <li key={project.slug}>
                <Link
                  href={`/p/${project.slug}`}
                  className="block rounded-full border border-line px-3.5 py-1.5 text-sm text-mute transition hover:border-love hover:text-love"
                >
                  {project.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <NewProjectForm error={query.error} />

      <p className="mt-6 text-sm leading-relaxed text-mute">
        Ask ten people for a cent before you post. An empty wall looks dead.
      </p>
    </div>
  );
}

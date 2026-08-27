import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { sql } from "@/lib/db";
import Link from "next/link";
import { Sticker } from "@/components/Sticker";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "List a project" };

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
        <h1 className="display text-4xl">List a project</h1>
        <Sticker name="receipt" size={70} float="slow" className="shrink-0" />
      </div>
      <p className="mt-3 text-mute">
        As many as you ship. Each one gets its own wall, and rank counts
        people rather than listings — so a second project moves you up only if
        a second crowd shows up for it.
      </p>

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

      {query.error && (
        <p className="mt-5 rounded-2xl border border-love/40 bg-love/10 px-4 py-3 text-sm text-love-soft">
          {query.error}
        </p>
      )}

      <form action="/api/projects" method="post" className="mt-7 space-y-4">
        <Field label="Name" name="name" placeholder="slashloop" maxLength={60} required />
        <Field
          label="Tagline"
          name="tagline"
          placeholder="Viral video tracker — finds outliers before they peak"
          maxLength={90}
        />
        <Field label="URL" name="url" placeholder="slashloop.com" required />
        <button
          type="submit"
          className="btn-love w-full px-5 py-4 font-semibold"
        >
          Put it on the board
        </button>
      </form>

      <p className="mt-6 text-sm leading-relaxed text-mute">
        An empty wall is worse than no wall. Before you post the link anywhere,
        ask ten people to spend a cent — a project page showing two avatars
        signals failure louder than no page at all.
      </p>
    </div>
  );
}

function Field({
  label,
  name,
  placeholder,
  maxLength,
  required,
}: {
  label: string;
  name: string;
  placeholder: string;
  maxLength?: number;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-mute">{label}</span>
      <input
        name={name}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        className="mt-1.5 w-full rounded-2xl border border-line bg-ink px-4 py-3 outline-none transition focus:border-love"
      />
    </label>
  );
}

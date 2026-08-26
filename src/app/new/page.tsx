import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "List a project" };

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const user = await currentUser();
  if (!user) redirect("/join");

  const existing = (await sql`
    SELECT slug FROM projects WHERE owner_id = ${user.id} AND removed_at IS NULL
  `) as { slug: string }[];
  if (existing[0]) redirect(`/p/${existing[0].slug}`);

  const query = await searchParams;

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">List a project</h1>
      <p className="mt-3 text-mute">
        One per person, for now. Fewer listings, fewer spam walls, and a board
        where every row is somebody&apos;s actual thing.
      </p>

      {query.error && (
        <p className="mt-5 rounded-xl border border-love/40 bg-love/5 px-4 py-3 font-mono text-sm text-love">
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
          className="w-full rounded-xl bg-love px-5 py-3.5 font-mono text-sm font-semibold text-white transition hover:brightness-110"
        >
          Put it on the board
        </button>
      </form>

      <p className="mt-6 font-mono text-xs leading-relaxed text-mute">
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
      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">
        {label}
      </span>
      <input
        name={name}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        className="mt-1.5 w-full rounded-lg border border-line bg-ink px-3 py-2.5 text-sm outline-none focus:border-love"
      />
    </label>
  );
}

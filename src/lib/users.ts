import { sql } from "./db";

export type UpsertArgs = {
  xId: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  xCreatedAt: string;
  isSeed?: boolean;
};

/** Create or refresh a user and make sure they have a (possibly empty) jar. */
export async function upsertUser(args: UpsertArgs): Promise<number> {
  const [row] = (await sql`
    INSERT INTO users (x_id, handle, display_name, avatar_url, x_created_at, is_seed)
    VALUES (${args.xId}, ${args.handle}, ${args.displayName},
            ${args.avatarUrl}, ${args.xCreatedAt}, ${args.isSeed ?? false})
    ON CONFLICT (x_id) DO UPDATE
      SET handle       = EXCLUDED.handle,
          display_name = EXCLUDED.display_name,
          avatar_url   = EXCLUDED.avatar_url
    RETURNING id
  `) as { id: number }[];

  const id = Number(row.id);
  await sql`
    INSERT INTO wallets (user_id) VALUES (${id}) ON CONFLICT (user_id) DO NOTHING
  `;
  return id;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** First free slug: `slug`, then `slug-2`, `slug-3`, … */
export async function freeSlug(base: string): Promise<string> {
  const root = slugify(base) || "project";
  const taken = (await sql`
    SELECT slug FROM projects WHERE slug = ${root} OR slug LIKE ${`${root}-%`}
  `) as { slug: string }[];
  const set = new Set(taken.map((t) => t.slug));
  if (!set.has(root)) return root;
  for (let n = 2; n < 500; n += 1) {
    if (!set.has(`${root}-${n}`)) return `${root}-${n}`;
  }
  return `${root}-${Date.now()}`;
}

export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

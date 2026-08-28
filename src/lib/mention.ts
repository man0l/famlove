/**
 * @-mentions in the posts famlove writes for people.
 *
 * A share that names the owner but does not tag them notifies nobody, which
 * makes the loop leak at exactly the point it should close: the whole reason
 * a backer posts is so the person they showed up for finds out.
 *
 * The care needed is on the other side. Every real account here comes from X
 * OAuth, so `handle` is a genuine X username — but seeded accounts carry
 * invented handles, and posting one publicly would either mention nobody or,
 * worse, mention a real stranger who happens to own that name. So a mention
 * is only ever built from an account we know came from X.
 */
export function ownerMention(
  handle: string,
  opts: { isSeed: boolean; viewerIsOwner: boolean },
): string | null {
  // Tagging yourself in your own post reads as a mistake, not a credit.
  if (opts.viewerIsOwner) return null;
  if (opts.isSeed) return null;
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) return null;
  return `@${handle}`;
}

/** "@manol_ai's slashloop.dev", or just "slashloop.dev" when we can't tag. */
export function possessive(mention: string | null, name: string): string {
  return mention ? `${mention}'s ${name}` : name;
}

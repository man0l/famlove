/**
 * Ask for an address at the only moment it obviously earns one: standing on
 * your own wall, wondering who turned up.
 *
 * X hands us no email — the scopes famlove requests deliberately don't
 * include it — so without this the daily digest and the "somebody showed up"
 * note simply never fire, and nobody ever finds out they existed. The field
 * was on /wallet, which is where you go to buy cents, not to wonder who
 * backed you.
 */
export function EmailPrompt({
  next,
  projectName,
}: {
  next: string;
  projectName: string;
}) {
  return (
    <div className="rounded-[26px] border border-dashed border-lime/40 bg-lime/5 p-5">
      <h2 className="display text-lg text-lime">Know who showed up</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-mute">
        We can&apos;t see your address — X doesn&apos;t give it to us. Add one
        and you&apos;ll hear the moment somebody backs {projectName}, plus a
        nightly note listing everyone who did. Nothing else, ever.
      </p>
      <form action="/api/settings" method="post" className="mt-3 flex gap-2">
        <input type="hidden" name="next" value={next} />
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          className="min-w-0 flex-1 rounded-full border border-line bg-ink px-4 py-2.5 text-sm outline-none transition focus:border-lime"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-lime px-4 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110"
        >
          Tell me
        </button>
      </form>
    </div>
  );
}

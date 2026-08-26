/**
 * Four sentences that do more for conversion than any amount of copywriting
 * about community.
 *
 * People don't hesitate over $3 because $3 is a lot. They hesitate because
 * they don't know whether it renews, whether they can undo it, who ends up
 * holding their card number, and whether they'll get carried away. Each line
 * here answers exactly one of those, and every one of them is enforced
 * somewhere in this codebase rather than merely promised:
 *
 *   no subscription   — one-off Checkout sessions, no prices, no billing cycle
 *   refund anytime    — /api/refund, no questions, unspent balance in full
 *   card stays hidden — Checkout is hosted; we store a fingerprint, never a PAN
 *   can't overspend   — a unique index and a 60/day ceiling in the database
 */
/* One glyph for all four, because all four are the same kind of statement:
   a guarantee. Mixed emoji looked like four unrelated warnings. */
const POINTS = [
  { label: "No subscription", detail: "One-off. Nothing renews." },
  { label: "Refund anytime", detail: "Unspent cents back in full." },
  { label: "We never see your card", detail: "Checkout is hosted." },
  { label: "You can't overspend", detail: "1¢ a day per project. Capped." },
];

export function TrustRow({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-xs text-mute">
        No subscription · refund anytime · we never see your card
      </p>
    );
  }

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {POINTS.map((point) => (
        <li
          key={point.label}
          className="flex items-start gap-2.5 rounded-2xl border border-line/70 bg-ink-2/50 px-3.5 py-3"
        >
          <span
            aria-hidden="true"
            className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-lime/15 text-[10px] font-bold text-lime"
          >
            ✓
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">{point.label}</span>
            <span className="block text-xs text-mute">{point.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

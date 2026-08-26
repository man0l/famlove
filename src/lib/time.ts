/** Everything in famlove resets at 00:00 UTC. One clock, no timezone arguments. */

export function utcDay(at: Date = new Date()): string {
  return at.toISOString().slice(0, 10);
}

export function utcDayOffset(days: number, from: Date = new Date()): string {
  const d = new Date(from.getTime() + days * 86_400_000);
  return utcDay(d);
}

/** ms until the next 00:00 UTC — the cap reset the UI counts down to. */
export function msUntilUtcMidnight(from: Date = new Date()): number {
  const next = Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate() + 1,
  );
  return next - from.getTime();
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatCompactCents(cents: number): string {
  return cents >= 100 ? formatCents(cents) : `${cents}¢`;
}

export function countdown(ms: number): string {
  if (ms <= 0) return "0m";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h === 0) {
    const s = total % 60;
    return `${m}m ${String(s).padStart(2, "0")}s`;
  }
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/**
 * The Postgres driver hands back `date` and `timestamptz` columns as JS Dates,
 * whose default string form is "Mon Aug 17 2026 …" — slicing that gives you a
 * weekday, not a date. Always go through here.
 */
export function isoDay(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "").slice(0, 10);
}

/** Same problem, full precision — safe to sort and to hand to `new Date()`. */
export function isoTime(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value ?? ""));
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

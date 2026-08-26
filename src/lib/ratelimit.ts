/**
 * Upstash if it's configured, a no-op if it isn't.
 *
 * This is a courtesy layer only. The rules that actually matter — one love per
 * person per project per day, 60 loves per wallet per day — are enforced by a
 * unique index and a guarded UPDATE, so losing Redis costs you nothing except
 * some wasted database round-trips.
 */

type Result = { allowed: boolean; remaining: number };

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

export const rateLimitConfigured = Boolean(url && token);

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<Result> {
  if (!rateLimitConfigured) return { allowed: true, remaining: limit };

  const bucket = `famlove:${key}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;

  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", bucket],
        ["EXPIRE", bucket, String(windowSeconds)],
      ]),
      cache: "no-store",
    });
    if (!res.ok) return { allowed: true, remaining: limit };
    const [incr] = (await res.json()) as { result: number }[];
    const used = Number(incr?.result ?? 0);
    return { allowed: used <= limit, remaining: Math.max(0, limit - used) };
  } catch {
    return { allowed: true, remaining: limit };
  }
}

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { sql } from "./db";

const COOKIE = "famlove_session";
const MAX_AGE = 60 * 60 * 24 * 30;

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 24) {
    throw new Error("SESSION_SECRET must be set to at least 24 characters.");
  }
  return new TextEncoder().encode(value);
}

export type SessionUser = {
  id: number;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
  centsBalance: number;
  centsGiven: number;
  bannedAt: string | null;
};

export async function createSession(userId: number): Promise<void> {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

async function userIdFromCookie(): Promise<number | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const uid = payload.uid;
    return typeof uid === "number" ? uid : null;
  } catch {
    return null;
  }
}

/** The signed-in user joined to their wallet, or null. Never throws. */
export async function currentUser(): Promise<SessionUser | null> {
  const uid = await userIdFromCookie();
  if (!uid) return null;

  const rows = (await sql`
    SELECT u.id, u.handle, u.display_name, u.avatar_url, u.email, u.banned_at,
           COALESCE(w.cents_balance, 0) AS cents_balance,
           COALESCE(w.cents_given, 0)   AS cents_given
    FROM users u
    LEFT JOIN wallets w ON w.user_id = u.id
    WHERE u.id = ${uid}
  `) as Record<string, unknown>[];

  const row = rows[0];
  if (!row) return null;

  return {
    id: Number(row.id),
    handle: String(row.handle),
    displayName: String(row.display_name ?? ""),
    avatarUrl: (row.avatar_url as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    centsBalance: Number(row.cents_balance),
    centsGiven: Number(row.cents_given),
    bannedAt: (row.banned_at as string | null) ?? null,
  };
}

/** For route handlers: the user, or a 401 you can return directly. */
export async function requireUser(): Promise<
  { user: SessionUser; error: null } | { user: null; error: Response }
> {
  const user = await currentUser();
  if (!user) {
    return {
      user: null,
      error: Response.json(
        { ok: false, error: "sign_in_required", message: "Sign in with X first." },
        { status: 401 },
      ),
    };
  }
  if (user.bannedAt) {
    return {
      user: null,
      error: Response.json(
        { ok: false, error: "banned", message: "This account is suspended." },
        { status: 403 },
      ),
    };
  }
  return { user, error: null };
}

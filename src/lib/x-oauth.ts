import { MIN_X_ACCOUNT_AGE_DAYS, MIN_X_POSTS, SITE_URL } from "./config";

/**
 * X OAuth 2.0 with PKCE. One of the two independent proofs of humanity — the
 * other is a card. Neither is sufficient alone, which is the whole defence:
 * a fake backer costs an aged account *and* a distinct card fingerprint.
 */

const AUTHORIZE = "https://x.com/i/oauth2/authorize";
const TOKEN = "https://api.x.com/2/oauth2/token";
const ME =
  "https://api.x.com/2/users/me?user.fields=created_at,profile_image_url," +
  "public_metrics,username,name,confirmed_email";

/*
 * users.email is what lets /2/users/me return confirmed_email, so the address
 * arrives with the sign-in instead of being asked for afterwards. It is not
 * free: X only honours it once the app has "Request email from users" enabled
 * in the developer portal, which in turn requires the terms and privacy URLs
 * to be filled in. And even then it can come back empty — an account with no
 * confirmed address, or someone who declined that part of the consent screen —
 * so the ask on /welcome stays as the fallback rather than being deleted.
 */
export const X_SCOPES = ["users.read", "tweet.read", "users.email"];

export function xConfigured(): boolean {
  return Boolean(process.env.X_CLIENT_ID && process.env.X_CLIENT_SECRET);
}

export function redirectUri(): string {
  return process.env.X_REDIRECT_URI ?? `${SITE_URL}/api/auth/x/callback`;
}

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function randomToken(bytes = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64url(new Uint8Array(digest));
}

export function authorizeUrl(state: string, challenge: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.X_CLIENT_ID!,
    redirect_uri: redirectUri(),
    scope: X_SCOPES.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `${AUTHORIZE}?${params.toString()}`;
}

export class XAuthError extends Error {
  constructor(public code: string) {
    super(`X auth failed: ${code}`);
    this.name = "XAuthError";
  }
}

export type XProfile = {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
  tweetCount: number;
  /** Only present when the app is approved for it and the account has one. */
  email: string | null;
};

export async function exchangeCode(
  code: string,
  verifier: string,
): Promise<string> {
  const basic = Buffer.from(
    `${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`,
  ).toString("base64");

  const res = await fetch(TOKEN, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }),
  });

  if (!res.ok) {
    /*
     * X's token error is structured — { error, error_description } — and its
     * `error` value is the one thing that says *why* a real login failed:
     * "invalid_client" (wrong id/secret), "redirect_uri_mismatch" (the
     * callback URL is not on the app's allow-list), "invalid_grant" (a stale
     * or reused code). The callback surfaces this string so a failed sign-in
     * is diagnosable rather than a blanket "x_failed". It carries no secret —
     * it is X describing its own rejection.
     */
    let code = String(res.status);
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) code = body.error;
    } catch {
      /* non-JSON body; the status code stands */
    }
    throw new XAuthError(code);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new XAuthError("no_token");
  return json.access_token;
}

export async function fetchProfile(accessToken: string): Promise<XProfile> {
  const res = await fetch(ME, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`X /users/me failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    data?: {
      id: string;
      username: string;
      name: string;
      created_at: string;
      profile_image_url?: string;
      public_metrics?: { tweet_count?: number };
      confirmed_email?: string;
    };
  };
  const d = json.data;
  if (!d) throw new Error("X /users/me returned no user.");

  return {
    id: d.id,
    username: d.username,
    name: d.name,
    // _normal is 48px; _400x400 is the one that survives being a face on a wall.
    avatarUrl: d.profile_image_url?.replace("_normal", "_400x400") ?? null,
    createdAt: d.created_at,
    tweetCount: d.public_metrics?.tweet_count ?? 0,
    email: d.confirmed_email?.trim() || null,
  };
}

export type Gate = { ok: true } | { ok: false; reason: string };

/** Two cheap checks that make a throwaway account useless. */
export function gateProfile(profile: XProfile): Gate {
  const ageDays =
    (Date.now() - new Date(profile.createdAt).getTime()) / 86_400_000;
  if (ageDays < MIN_X_ACCOUNT_AGE_DAYS) {
    return {
      ok: false,
      reason: `Your X account is ${Math.floor(ageDays)} days old. famlove needs ${MIN_X_ACCOUNT_AGE_DAYS}+.`,
    };
  }
  if (profile.tweetCount < MIN_X_POSTS) {
    return { ok: false, reason: "Post something on X first. Anything." };
  }
  return { ok: true };
}

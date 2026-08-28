import { SITE_URL } from "./config";

/**
 * Unsubscribe links that work from the inbox.
 *
 * The footer used to say "clear the field to stop" and point at /wallet —
 * which meant signing in, finding the email input, emptying it and saving.
 * Calling that "Unsubscribe" would be a promise the link does not keep, so
 * the link now carries a signature instead: enough to prove this address's
 * owner asked, without a session and without letting anyone unsubscribe a
 * stranger by guessing a number.
 *
 * Deliberately no expiry. People unsubscribe from months-old mail, and a
 * dead unsubscribe link is how a sender ends up reported as spam instead.
 */

function key(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error("SESSION_SECRET must be set to at least 24 characters.");
  }
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function unsubscribeToken(userId: number): Promise<string> {
  const mac = await crypto.subtle.sign(
    "HMAC",
    await key(),
    new TextEncoder().encode(`unsub:${userId}`),
  );
  // Half of a SHA-256 is 128 bits — far past guessing, and keeps the URL short
  // enough to survive a mail client wrapping it.
  return base64url(new Uint8Array(mac).slice(0, 16));
}

/** Constant-time compare: a timing side channel here leaks a valid token. */
export async function validUnsubscribe(
  userId: number,
  token: string,
): Promise<boolean> {
  const expected = await unsubscribeToken(userId);
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return diff === 0;
}

export async function unsubscribeUrl(userId: number): Promise<string> {
  const token = await unsubscribeToken(userId);
  return `${SITE_URL}/unsubscribe?u=${userId}&t=${token}`;
}

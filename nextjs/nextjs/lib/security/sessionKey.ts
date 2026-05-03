import { createHmac, createHash } from "node:crypto";
import { getSession } from "@/lib/session";

/**
 * Per-session AES key for payload obfuscation.
 *
 * Derived from `PAYLOAD_CIPHER_KEY` (server secret) HMAC'd with the
 * session userid. Same userid → same key, so cached responses survive
 * re-renders. Rotating PAYLOAD_CIPHER_KEY invalidates everything.
 *
 * If PAYLOAD_CIPHER_KEY is unset we fall back to a SHA-256 of
 * BILLING_SESSION_SECRET; this keeps dev usable without a separate
 * keypair, but production should set a dedicated key.
 */

function masterSecret(): string {
  const explicit = process.env.PAYLOAD_CIPHER_KEY;
  if (explicit && explicit.trim()) return explicit.trim();
  const fallback = process.env.BILLING_SESSION_SECRET ?? "change-me";
  return createHash("sha256").update(`payload:${fallback}`).digest("base64");
}

export function deriveKeyForUser(userid: string | number): string {
  const id = String(userid);
  return createHmac("sha256", masterSecret()).update(`user:${id}`).digest("base64");
}

/** Returns the base64 32-byte AES key for the current logged-in user, or null if no session. */
export async function getCurrentSessionKey(): Promise<string | null> {
  const s = await getSession();
  if (!s) return null;
  const id = (s as { userid?: string | number }).userid ?? (s as { username?: string }).username;
  if (id == null) return null;
  return deriveKeyForUser(id);
}

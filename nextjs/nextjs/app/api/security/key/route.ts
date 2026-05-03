import { NextResponse } from "next/server";
import { getCurrentSessionKey } from "@/lib/security/sessionKey";

/**
 * Issues the per-session AES key used by `secureFetch` to decrypt encrypted
 * API responses. Requires a valid billing_session cookie.
 *
 * The key is intentionally retrievable from the browser — this is obfuscation,
 * not confidentiality. See lib/security/payloadCipher.ts for the full caveat.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const key = await getCurrentSessionKey();
  if (!key) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ key, alg: "aes-gcm-v1" }, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate, private" },
  });
}

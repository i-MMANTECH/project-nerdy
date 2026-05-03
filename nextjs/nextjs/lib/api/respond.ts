import { NextResponse } from "next/server";
import { encryptJson } from "@/lib/security/payloadCipher";
import { getCurrentSessionKey } from "@/lib/security/sessionKey";
import { CIPHER_MODE_AES_GCM, CIPHER_REQUEST_HEADER, CIPHER_RESPONSE_HEADER } from "@/lib/api/cipherMode";

export { CIPHER_MODE_AES_GCM, CIPHER_REQUEST_HEADER, CIPHER_RESPONSE_HEADER };

type SecureJsonInit = ResponseInit & { forceEncrypt?: boolean };

/**
 * Drop-in replacement for `NextResponse.json` that encrypts the body when:
 *   - the client sent `x-cipher-mode: aes-gcm-v1`, OR
 *   - `forceEncrypt: true` is passed
 * and a session key is derivable. Falls back to plain JSON otherwise so server-
 * to-server callers (cron, integration tests) still work.
 */
export async function secureJson<T>(data: T, request: Request, init: SecureJsonInit = {}): Promise<Response> {
  const wantsCipher =
    init.forceEncrypt === true ||
    request.headers.get(CIPHER_REQUEST_HEADER)?.toLowerCase() === CIPHER_MODE_AES_GCM;

  if (!wantsCipher) {
    return NextResponse.json(data as object, init);
  }

  const key = await getCurrentSessionKey();
  if (!key) {
    return NextResponse.json(data as object, init);
  }

  const envelope = encryptJson(data, key);
  const res = NextResponse.json(envelope, init);
  res.headers.set(CIPHER_RESPONSE_HEADER, CIPHER_MODE_AES_GCM);
  return res;
}

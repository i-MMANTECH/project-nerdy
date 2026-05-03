"use client";

/**
 * Client fetch wrapper for encrypted API responses.
 *
 * Flow:
 *   1. First call → fetches /api/security/key, caches in sessionStorage.
 *   2. Adds `x-cipher-mode: aes-gcm-v1` to opt the request in.
 *   3. If response carries `x-cipher-mode: aes-gcm-v1`, decrypts the envelope.
 *   4. If not (server downgrade), returns the parsed JSON as-is.
 */

import { CIPHER_MODE_AES_GCM, CIPHER_REQUEST_HEADER, CIPHER_RESPONSE_HEADER } from "@/lib/api/cipherMode";

const KEY_STORAGE = "billing.sessionKey.v1";
let inflightKey: Promise<string | null> | null = null;

type Envelope = { v: 1; iv: string; ct: string };

/**
 * Returns a Uint8Array backed by a fresh ArrayBuffer. The explicit ArrayBuffer
 * narrowing matters: `crypto.subtle.*` requires `BufferSource`, which excludes
 * SharedArrayBuffer-backed views.
 */
function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const buf = new ArrayBuffer(bin.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importKey(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", fromB64(b64), { name: "AES-GCM" }, false, ["decrypt"]);
}

async function fetchKey(): Promise<string | null> {
  try {
    const res = await fetch("/api/security/key", { credentials: "same-origin", cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { key?: string };
    return typeof body.key === "string" ? body.key : null;
  } catch {
    return null;
  }
}

async function getKey(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const cached = sessionStorage.getItem(KEY_STORAGE);
  if (cached) return cached;
  if (!inflightKey) {
    inflightKey = fetchKey().then((k) => {
      if (k) sessionStorage.setItem(KEY_STORAGE, k);
      inflightKey = null;
      return k;
    });
  }
  return inflightKey;
}

/** Drop on cipher-mode failure (e.g. key rotated) so the next call refreshes. */
export function clearCachedSessionKey(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY_STORAGE);
}

export async function decryptEnvelope<T>(env: Envelope, keyB64: string): Promise<T> {
  const key = await importKey(keyB64);
  const iv = fromB64(env.iv);
  const ct = fromB64(env.ct);
  const buf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(buf)) as T;
}

export type SecureFetchInit = RequestInit & { skipCipher?: boolean };

export async function secureFetch<T = unknown>(input: RequestInfo | URL, init: SecureFetchInit = {}): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  if (!init.skipCipher) headers.set(CIPHER_REQUEST_HEADER, CIPHER_MODE_AES_GCM);

  const res = await fetch(input, { ...init, headers, credentials: init.credentials ?? "same-origin" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`secureFetch ${res.status}: ${text || res.statusText}`);
  }

  const cipherMode = res.headers.get(CIPHER_RESPONSE_HEADER)?.toLowerCase();
  const body = await res.json();

  if (cipherMode !== CIPHER_MODE_AES_GCM) return body as T;

  const key = await getKey();
  if (!key) {
    clearCachedSessionKey();
    throw new Error("secureFetch: missing session key for encrypted response");
  }

  try {
    return await decryptEnvelope<T>(body as Envelope, key);
  } catch (err) {
    clearCachedSessionKey();
    throw err;
  }
}

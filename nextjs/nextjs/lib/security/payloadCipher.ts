/**
 * Server-side AES-256-GCM payload encryption used by `secureJson()` to obfuscate
 * sensitive API responses from casual DevTools inspection.
 *
 * NOT a substitute for HTTPS. NOT a confidentiality boundary against an
 * attacker who controls the browser — the decryption key is derivable in
 * the client. Treat this as defense-in-depth for casual viewers.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm" as const;
const IV_LEN = 12;
const TAG_LEN = 16;

export type CipherEnvelope = {
  v: 1;
  iv: string; // base64
  ct: string; // base64 (ciphertext + auth tag concatenated)
};

function toBuf(keyB64: string): Buffer {
  const buf = Buffer.from(keyB64, "base64");
  if (buf.length !== 32) {
    throw new Error("payloadCipher: key must decode to 32 bytes (AES-256)");
  }
  return buf;
}

export function encryptJson(value: unknown, keyB64: string): CipherEnvelope {
  const key = toBuf(keyB64);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const json = Buffer.from(JSON.stringify(value), "utf8");
  const enc = Buffer.concat([cipher.update(json), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    iv: iv.toString("base64"),
    ct: Buffer.concat([enc, tag]).toString("base64"),
  };
}

export function decryptJson<T = unknown>(env: CipherEnvelope, keyB64: string): T {
  const key = toBuf(keyB64);
  const iv = Buffer.from(env.iv, "base64");
  const all = Buffer.from(env.ct, "base64");
  if (all.length < TAG_LEN) throw new Error("payloadCipher: ciphertext too short");
  const ct = all.subarray(0, all.length - TAG_LEN);
  const tag = all.subarray(all.length - TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const out = Buffer.concat([decipher.update(ct), decipher.final()]);
  return JSON.parse(out.toString("utf8")) as T;
}

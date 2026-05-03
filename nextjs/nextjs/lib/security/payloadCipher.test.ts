import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { decryptJson, encryptJson, type CipherEnvelope } from "./payloadCipher";

const key = (): string => randomBytes(32).toString("base64");

describe("payloadCipher", () => {
  it("round-trips a JSON object", () => {
    const k = key();
    const data = { account: "user42", credits: 1234, mac: "00:1A:79:00:00:01" };
    const env = encryptJson(data, k);
    expect(env.v).toBe(1);
    expect(env.iv).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(env.ct).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(decryptJson(env, k)).toEqual(data);
  });

  it("rejects a key of the wrong size", () => {
    const tooShort = Buffer.alloc(16).toString("base64");
    expect(() => encryptJson({ x: 1 }, tooShort)).toThrow(/32 bytes/);
  });

  it("fails to decrypt with the wrong key", () => {
    const env = encryptJson({ secret: "hi" }, key());
    expect(() => decryptJson(env, key())).toThrow();
  });

  it("fails to decrypt a tampered ciphertext", () => {
    const k = key();
    const env = encryptJson({ a: 1 }, k);
    const bytes = Buffer.from(env.ct, "base64");
    bytes[0] ^= 0x01;
    const tampered: CipherEnvelope = { ...env, ct: bytes.toString("base64") };
    expect(() => decryptJson(tampered, k)).toThrow();
  });

  it("produces a fresh IV each call (no nonce reuse)", () => {
    const k = key();
    const a = encryptJson({ x: 1 }, k);
    const b = encryptJson({ x: 1 }, k);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });
});

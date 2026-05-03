import type { RowDataPacket } from "mysql2";
import { getBillingPool } from "@/lib/db/pool";
import { isBillingExpiresInPast } from "@/lib/repos/resellerPortal";

/** Match billing / Stalker style (uppercase, colons). */
export function normalizeMacForLookup(raw: string): string {
  return raw.trim().toUpperCase().replace(/-/g, ":");
}

/** PHP `valid_mac` — six hex octets, colon or hyphen separators. */
export function isValidMacFormat(raw: string): boolean {
  const s = raw.trim();
  if (!s) return false;
  const withColons = normalizeMacForLookup(s);
  return /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(withColons);
}

export type CheckMacLookupResult =
  | { kind: "invalid" }
  | { kind: "available" }
  | { kind: "ambiguous" }
  | { kind: "exists"; expires: string | null; expired: boolean };

/**
 * PHP `Check_mac::index` — `accounts.mac` exact match; PHP only treats exactly one row as "in use".
 * Tries a few common stored shapes (colon / hyphen, case).
 */
export async function lookupAccountByMac(rawMac: string): Promise<CheckMacLookupResult> {
  if (!isValidMacFormat(rawMac)) return { kind: "invalid" };
  const canon = normalizeMacForLookup(rawMac);
  const hyphen = canon.replace(/:/g, "-");
  const variants = [...new Set([canon, hyphen, canon.toLowerCase(), hyphen.toLowerCase()])];
  const pool = getBillingPool();
  const ph = variants.map(() => "?").join(",");
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT expires FROM accounts WHERE mac IN (${ph}) LIMIT 2`,
    variants,
  );
  if (rows.length === 0) return { kind: "available" };
  if (rows.length > 1) return { kind: "ambiguous" };
  const exp = rows[0].expires != null ? String(rows[0].expires) : null;
  const expired = isBillingExpiresInPast(exp);
  return { kind: "exists", expires: exp, expired };
}

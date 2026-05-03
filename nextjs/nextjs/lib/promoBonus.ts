/** Promo 1 = % of requested credits by amount tier; Promo 2 = % of requested credits by active-client tier. */

export type PromoTier = { ge: number; lt: number | null; percentage: number };

export const PROMO_BONUS_P1_CONFIG_KEY = "promo_bonus_p1_json";
export const PROMO_BONUS_P2_CONFIG_KEY = "promo_bonus_p2_json";

export function parsePromoTiersJson(raw: string | null | undefined): PromoTier[] {
  if (raw == null || String(raw).trim() === "") return [];
  try {
    const v = JSON.parse(String(raw)) as unknown;
    if (!Array.isArray(v)) return [];
    const out: PromoTier[] = [];
    for (const row of v) {
      if (row == null || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const ge = Math.floor(Number(o.ge));
      const pct = Number(o.percentage);
      const ltRaw = o.lt;
      const lt =
        ltRaw === null || ltRaw === undefined || String(ltRaw).trim() === ""
          ? null
          : Math.floor(Number(ltRaw));
      if (!Number.isFinite(ge) || ge < 0) continue;
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) continue;
      if (lt != null && (!Number.isFinite(lt) || lt <= ge)) continue;
      out.push({ ge, lt, percentage: pct });
    }
    return out;
  } catch {
    return [];
  }
}

export function serializePromoTiers(tiers: PromoTier[]): string {
  return JSON.stringify(tiers);
}

/** Half-open: value ∈ [ge, lt) or [ge, ∞) when lt is null. */
export function pickTierPercentage(value: number, tiers: PromoTier[]): number {
  if (!Number.isFinite(value) || value < 0 || tiers.length === 0) return 0;
  const sorted = [...tiers].sort((a, b) => a.ge - b.ge);
  for (const t of sorted) {
    if (value < t.ge) continue;
    if (t.lt != null && value >= t.lt) continue;
    return t.percentage;
  }
  return 0;
}

export function ceilPercentOfBase(percent: number, base: number): number {
  if (!Number.isFinite(percent) || percent <= 0 || !Number.isFinite(base) || base <= 0) return 0;
  return Math.ceil((base * percent) / 100);
}

export function computePromoBonusesForAdd(
  requestedCredits: number,
  activeClientCount: number,
  promo1: PromoTier[],
  promo2: PromoTier[],
): { pct1: number; pct2: number; bonus1: number; bonus2: number } {
  const p = Math.floor(Number(requestedCredits));
  const c = Math.floor(Number(activeClientCount));
  const pct1 = pickTierPercentage(p, promo1);
  const pct2 = pickTierPercentage(c, promo2);
  const bonus1 = ceilPercentOfBase(pct1, p);
  const bonus2 = ceilPercentOfBase(pct2, p);
  return { pct1, pct2, bonus1, bonus2 };
}

/**
 * Validates tiers for save. Uses half-open ranges [ge, lt), sorted by ge.
 * Optional strict: no gaps between finite upper bounds (next.ge === prev.lt).
 */
export function validatePromoTiers(tiers: PromoTier[], label: string, strictNoGaps: boolean): string | null {
  if (tiers.length === 0) return null;
  const sorted = [...tiers].sort((a, b) => a.ge - b.ge);
  let openEnded = 0;
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    if (!Number.isFinite(t.ge) || t.ge < 0) return `${label}: row ${i + 1} has invalid GE.`;
    if (!Number.isFinite(t.percentage) || t.percentage < 0 || t.percentage > 100) return `${label}: row ${i + 1} has invalid percentage (0–100).`;
    if (t.lt != null) {
      if (!Number.isFinite(t.lt) || t.lt <= t.ge) return `${label}: row ${i + 1}: LT must be greater than GE.`;
    } else {
      openEnded++;
    }
  }
  if (openEnded > 1) return `${label}: at most one open-ended row (empty LT) is allowed.`;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (a.lt == null) return `${label}: only the last tier may have an empty LT (open end).`;
    if (b.ge < a.lt) return `${label}: overlapping ranges near GE=${b.ge}.`;
    if (strictNoGaps && b.ge > a.lt) return `${label}: gap between LT=${a.lt} and next GE=${b.ge} (tiers must be contiguous).`;
  }
  return null;
}

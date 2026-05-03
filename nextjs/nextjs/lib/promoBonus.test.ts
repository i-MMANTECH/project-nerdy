import { describe, expect, it } from "vitest";
import {
  ceilPercentOfBase,
  computePromoBonusesForAdd,
  parsePromoTiersJson,
  pickTierPercentage,
  serializePromoTiers,
  validatePromoTiers,
  type PromoTier,
} from "./promoBonus";

/** Example Promo 1 ladder (requested credits): low tier 0%, mid 5%, high 10%. */
const SAMPLE_P1: PromoTier[] = [
  { ge: 0, lt: 100, percentage: 0 },
  { ge: 100, lt: 500, percentage: 5 },
  { ge: 500, lt: null, percentage: 10 },
];

/** Example Promo 2 ladder (active client count); 100 falls in [100, ∞) top tier. */
const SAMPLE_P2: PromoTier[] = [
  { ge: 0, lt: 50, percentage: 0 },
  { ge: 50, lt: 100, percentage: 3 },
  { ge: 100, lt: null, percentage: 7 },
];

describe("pickTierPercentage", () => {
  it("uses half-open ranges: GE inclusive, LT exclusive", () => {
    const tiers: PromoTier[] = [
      { ge: 0, lt: 100, percentage: 0 },
      { ge: 100, lt: 200, percentage: 50 },
    ];
    expect(pickTierPercentage(0, tiers)).toBe(0);
    expect(pickTierPercentage(99, tiers)).toBe(0);
    expect(pickTierPercentage(100, tiers)).toBe(50);
    expect(pickTierPercentage(199, tiers)).toBe(50);
    expect(pickTierPercentage(200, tiers)).toBe(0);
  });

  it("matches open-ended top tier", () => {
    const tiers: PromoTier[] = [
      { ge: 0, lt: 1000, percentage: 1 },
      { ge: 1000, lt: null, percentage: 12 },
    ];
    expect(pickTierPercentage(999, tiers)).toBe(1);
    expect(pickTierPercentage(1000, tiers)).toBe(12);
    expect(pickTierPercentage(200_000, tiers)).toBe(12);
  });

  it("sorts by GE when rows are out of order", () => {
    const shuffled: PromoTier[] = [
      { ge: 500, lt: null, percentage: 10 },
      { ge: 0, lt: 100, percentage: 0 },
      { ge: 100, lt: 500, percentage: 5 },
    ];
    expect(pickTierPercentage(250, shuffled)).toBe(5);
  });
});

describe("ceilPercentOfBase", () => {
  it("rounds each promo line up independently (fractional % of base)", () => {
    expect(ceilPercentOfBase(10, 99)).toBe(10);
    expect(ceilPercentOfBase(10, 33)).toBe(4);
    expect(ceilPercentOfBase(33, 3)).toBe(1);
  });

  it("returns 0 for non-positive inputs", () => {
    expect(ceilPercentOfBase(0, 100)).toBe(0);
    expect(ceilPercentOfBase(10, 0)).toBe(0);
  });
});

describe("computePromoBonusesForAdd", () => {
  it("golden: 2000 requested, 120 active — 10% + 3% of base (120 ∈ [50,200) on P2 ladder)", () => {
    const p1: PromoTier[] = [
      { ge: 0, lt: 500, percentage: 0 },
      { ge: 500, lt: null, percentage: 10 },
    ];
    const p2: PromoTier[] = [
      { ge: 0, lt: 50, percentage: 0 },
      { ge: 50, lt: 200, percentage: 3 },
      { ge: 200, lt: null, percentage: 7 },
    ];
    const r = computePromoBonusesForAdd(2000, 120, p1, p2);
    expect(r.pct1).toBe(10);
    expect(r.pct2).toBe(3);
    expect(r.bonus1).toBe(200);
    expect(r.bonus2).toBe(60);
  });

  it("golden: 100 requested, 100 active — mid P1 + top P2", () => {
    const r = computePromoBonusesForAdd(100, 100, SAMPLE_P1, SAMPLE_P2);
    expect(r.pct1).toBe(5);
    expect(r.pct2).toBe(7);
    expect(r.bonus1).toBe(5);
    expect(r.bonus2).toBe(7);
  });

  it("floors requested credits and active count before tier lookup", () => {
    const p1: PromoTier[] = [{ ge: 100, lt: null, percentage: 10 }];
    const p2: PromoTier[] = [{ ge: 10, lt: null, percentage: 5 }];
    const r = computePromoBonusesForAdd(199.9, 9.9, p1, p2);
    expect(r.pct1).toBe(10);
    expect(r.pct2).toBe(0);
    expect(r.bonus1).toBe(20);
    expect(r.bonus2).toBe(0);
  });

  it("empty tiers yield zero bonuses", () => {
    const r = computePromoBonusesForAdd(500, 80, [], []);
    expect(r).toEqual({ pct1: 0, pct2: 0, bonus1: 0, bonus2: 0 });
  });

  it("each percentage applies to full requested principal (not net after other bonus)", () => {
    const p1: PromoTier[] = [{ ge: 0, lt: null, percentage: 10 }];
    const p2: PromoTier[] = [{ ge: 0, lt: null, percentage: 10 }];
    const r = computePromoBonusesForAdd(100, 1, p1, p2);
    expect(r.bonus1).toBe(10);
    expect(r.bonus2).toBe(10);
  });
});

describe("parsePromoTiersJson / serializePromoTiers", () => {
  it("round-trips valid rows", () => {
    const tiers: PromoTier[] = [
      { ge: 0, lt: 100, percentage: 0 },
      { ge: 100, lt: null, percentage: 5.5 },
    ];
    const json = serializePromoTiers(tiers);
    const back = parsePromoTiersJson(json);
    expect(back).toEqual([
      { ge: 0, lt: 100, percentage: 0 },
      { ge: 100, lt: null, percentage: 5.5 },
    ]);
  });

  it("returns [] for invalid JSON", () => {
    expect(parsePromoTiersJson("{")).toEqual([]);
  });
});

describe("validatePromoTiers", () => {
  it("allows empty list", () => {
    expect(validatePromoTiers([], "P1", true)).toBeNull();
  });

  it("rejects overlapping ranges", () => {
    const bad: PromoTier[] = [
      { ge: 0, lt: 150, percentage: 1 },
      { ge: 100, lt: 200, percentage: 2 },
    ];
    expect(validatePromoTiers(bad, "P1", false)).toMatch(/overlapping/);
  });

  it("strict mode rejects gaps", () => {
    const gap: PromoTier[] = [
      { ge: 0, lt: 100, percentage: 1 },
      { ge: 101, lt: null, percentage: 2 },
    ];
    expect(validatePromoTiers(gap, "P1", true)).toMatch(/gap/);
  });

  it("strict mode accepts contiguous tiers", () => {
    const ok: PromoTier[] = [
      { ge: 0, lt: 100, percentage: 1 },
      { ge: 100, lt: null, percentage: 2 },
    ];
    expect(validatePromoTiers(ok, "P1", true)).toBeNull();
  });
});

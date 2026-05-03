"use client";

import { computePromoBonusesForAdd } from "@/lib/promoBonus";
import type { PromoTier } from "@/lib/promoBonus";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(n));
}

export function HierarchyAddCreditPreviewDetail({
  principal,
  currentBalance,
  p1,
  p2,
  activeClients,
  hideFooterProjected,
}: {
  principal: number;
  currentBalance: number;
  p1: PromoTier[];
  p2: PromoTier[];
  activeClients: number;
  /** When true, omit the bottom “projected balance” line (parent shows it once). */
  hideFooterProjected?: boolean;
}) {
  const r = computePromoBonusesForAdd(principal, activeClients, p1, p2);
  const totalCredited = principal + r.bonus1 + r.bonus2;

  return (
    <div className="space-y-2 rounded-lg border border-emerald-400/25 bg-emerald-500/5 px-3 py-2.5 text-xs">
      <p className="font-semibold text-emerald-200/95">Add preview</p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-muted-foreground">
        <dt>Principal (your amount)</dt>
        <dd className="text-right font-mono tabular-nums text-foreground">{fmt(principal)}</dd>
        <dt>
          Promo 1 ({r.pct1}%){r.bonus1 <= 0 ? <span className="text-muted-foreground/80"> — amount tier</span> : null}
        </dt>
        <dd className="text-right font-mono tabular-nums text-foreground">+{fmt(r.bonus1)}</dd>
        <dt>
          Promo 2 ({r.pct2}%){r.bonus2 <= 0 ? <span className="text-muted-foreground/80"> — active subs tier</span> : null}
        </dt>
        <dd className="text-right font-mono tabular-nums text-foreground">+{fmt(r.bonus2)}</dd>
        <dt className="font-medium text-foreground">Total credited</dt>
        <dd className="text-right font-mono tabular-nums font-semibold text-emerald-200">{fmt(totalCredited)}</dd>
        <dt className="text-muted-foreground">Active subs (Promo 2 axis)</dt>
        <dd className="text-right font-mono tabular-nums text-foreground">{fmt(activeClients)}</dd>
      </dl>
      {!hideFooterProjected ? (
        <p className="border-t border-emerald-400/20 pt-2 text-[11px] text-muted-foreground">
          Projected balance after add:{" "}
          <span className="font-semibold text-emerald-200">{fmt(currentBalance + totalCredited)}</span>
        </p>
      ) : null}
    </div>
  );
}

export function HierarchyRecoverCreditPreviewDetail({
  currentBalance,
  principal,
  debitTotal,
  matchedGrant,
  hideFooterProjected,
}: {
  currentBalance: number;
  principal: number;
  debitTotal: number;
  matchedGrant: boolean;
  hideFooterProjected?: boolean;
}) {
  const projected = Math.max(0, currentBalance - debitTotal);
  const insufficient = debitTotal > currentBalance;

  return (
    <div className="space-y-2 rounded-lg border border-amber-400/25 bg-amber-500/5 px-3 py-2.5 text-xs">
      <p className="font-semibold text-amber-200/95">Recover preview</p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-muted-foreground">
        <dt>Principal entered</dt>
        <dd className="text-right font-mono tabular-nums text-foreground">{fmt(principal)}</dd>
        <dt>Debit from balance</dt>
        <dd className="text-right font-mono tabular-nums text-foreground">{fmt(debitTotal)}</dd>
        <dt className="align-top">Grant match</dt>
        <dd className="max-w-[14rem] text-right text-[11px] leading-snug text-muted-foreground">
          {matchedGrant
            ? "FIFO grant found — includes promo portion when applicable."
            : "No matching `(base …)` grant — principal only."}
        </dd>
      </dl>
      {hideFooterProjected ? (
        insufficient ? (
          <p className="border-t border-amber-400/20 pt-2 text-[11px] text-destructive">
            Insufficient balance for this debit ({fmt(debitTotal)} needed).
          </p>
        ) : null
      ) : (
        <p className="border-t border-amber-400/20 pt-2 text-[11px] text-muted-foreground">
          Projected balance after recover:{" "}
          <span className={`font-semibold ${insufficient ? "text-destructive" : "text-amber-200"}`}>{fmt(projected)}</span>
          {insufficient ? (
            <span className="block pt-1 text-destructive">Insufficient balance for this debit ({fmt(debitTotal)} needed).</span>
          ) : null}
        </p>
      )}
    </div>
  );
}

export type HierarchyCreditPreviewBundle = {
  p1: PromoTier[];
  p2: PromoTier[];
  activeClients: number;
};

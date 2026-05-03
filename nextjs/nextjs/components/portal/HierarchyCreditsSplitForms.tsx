"use client";

import { useEffect, useMemo, useState } from "react";
import { PlusCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HIERARCHY_ADD_CREDITS_MAX } from "@/lib/constants/hierarchyCredits";
import { computePromoBonusesForAdd } from "@/lib/promoBonus";
import {
  HierarchyAddCreditPreviewDetail,
  HierarchyRecoverCreditPreviewDetail,
  type HierarchyCreditPreviewBundle,
} from "@/components/portal/HierarchyCreditPreviewBlocks";

type Props = {
  username: string;
  addMin: number;
  addMax?: number;
  currentBalance?: number;
  applyAction: (formData: FormData) => Promise<void>;
  addBlurb?: string;
  /** Passed through from some dealer/reseller pages for credits combobox parity (unused here). */
  bonusChargedMap?: Record<number, number>;
  /** When set, ADD shows Promo 1/2 breakdown and projected balance including bonuses. */
  creditPreview?: HierarchyCreditPreviewBundle | null;
  /** When set, RECOVER fetches FIFO debit preview for this billing role. */
  recoverPreviewRole?: "MNGR" | "SRSLR" | "RSLR";
};

function formatInt(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(n));
}

export function HierarchyCreditsSplitForms({
  username,
  addMin,
  addMax,
  currentBalance = 0,
  applyAction,
  addBlurb,
  creditPreview,
  recoverPreviewRole,
  bonusChargedMap: _bonusChargedMap,
}: Props) {
  const max = Math.min(HIERARCHY_ADD_CREDITS_MAX, Math.max(1, Math.floor(Number(addMax ?? HIERARCHY_ADD_CREDITS_MAX))));
  const min = Math.min(Math.max(1, addMin), max);
  const [operation, setOperation] = useState<"ADD" | "RECOVER">("ADD");
  const [amount, setAmount] = useState(min);

  const addBonuses = useMemo(() => {
    if (!creditPreview || operation !== "ADD") return null;
    return computePromoBonusesForAdd(amount, creditPreview.activeClients, creditPreview.p1, creditPreview.p2);
  }, [creditPreview, operation, amount]);

  const totalAddCredit =
    operation === "ADD" && addBonuses ? amount + addBonuses.bonus1 + addBonuses.bonus2 : operation === "ADD" ? amount : null;

  const [recoverDebitTotal, setRecoverDebitTotal] = useState<number | null>(null);
  const [recoverMatchedGrant, setRecoverMatchedGrant] = useState(false);

  useEffect(() => {
    if (operation !== "RECOVER" || !recoverPreviewRole) {
      setRecoverDebitTotal(null);
      setRecoverMatchedGrant(false);
      return;
    }
    const ac = new AbortController();
    const t = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/billing/credit-preview?mode=recover&username=${encodeURIComponent(username)}&principal=${amount}&role=${recoverPreviewRole}`,
            { signal: ac.signal, credentials: "same-origin" },
          );
          if (!res.ok) {
            setRecoverDebitTotal(null);
            setRecoverMatchedGrant(false);
            return;
          }
          const j = (await res.json()) as { debitTotal: number; matchedGrantTxId: number | null };
          setRecoverDebitTotal(j.debitTotal);
          setRecoverMatchedGrant(j.matchedGrantTxId != null);
        } catch {
          if (!ac.signal.aborted) {
            setRecoverDebitTotal(null);
            setRecoverMatchedGrant(false);
          }
        }
      })();
    }, 200);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [operation, recoverPreviewRole, username, amount]);

  const recoverDebit = operation === "RECOVER" ? (recoverDebitTotal ?? amount) : amount;

  const projected =
    operation === "ADD"
      ? currentBalance + (totalAddCredit ?? amount)
      : Math.max(0, currentBalance - recoverDebit);

  return (
    <div className="space-y-4 text-sm">
      {addBlurb ? <p className="text-xs text-muted-foreground">{addBlurb}</p> : null}
      <form action={applyAction} className="space-y-3 rounded border border-border bg-muted/50/60 p-3">
        <input type="hidden" name="username" value={username} />
        <input type="hidden" name="type" value={operation} />
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-foreground">Operation</legend>
          <div className="inline-flex rounded-xl border border-border/70 bg-background/40 p-1">
            <button
              type="button"
              onClick={() => setOperation("ADD")}
              className={`inline-flex min-w-[8.5rem] items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                operation === "ADD" ? "bg-primary/15 text-primary" : "text-muted-foreground"
              }`}
            >
              <PlusCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Add credits
            </button>
            <button
              type="button"
              onClick={() => setOperation("RECOVER")}
              className={`inline-flex min-w-[8.5rem] items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                operation === "RECOVER" ? "bg-primary/15 text-primary" : "text-muted-foreground"
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Recover credits
            </button>
          </div>
        </fieldset>
        <label htmlFor={`hierarchy-credits-${username}`} className="block text-xs font-semibold text-foreground">
          Amount to {operation === "ADD" ? "add" : "recover"}
        </label>
        <input
          id={`hierarchy-credits-${username}`}
          name="credits"
          type="number"
          min={1}
          max={operation === "ADD" ? max : HIERARCHY_ADD_CREDITS_MAX}
          step={1}
          value={amount}
          onChange={(e) =>
            setAmount(
              Math.max(
                1,
                Math.min(operation === "ADD" ? max : HIERARCHY_ADD_CREDITS_MAX, Number.parseInt(e.target.value || "1", 10) || 1),
              ),
            )
          }
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none [appearance:textfield] focus-visible:ring-2 focus-visible:ring-ring/60 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        {operation === "ADD" && creditPreview ? (
          <HierarchyAddCreditPreviewDetail
            principal={amount}
            currentBalance={currentBalance}
            p1={creditPreview.p1}
            p2={creditPreview.p2}
            activeClients={creditPreview.activeClients}
          />
        ) : null}
        {operation === "RECOVER" && recoverPreviewRole ? (
          <HierarchyRecoverCreditPreviewDetail
            currentBalance={currentBalance}
            principal={amount}
            debitTotal={recoverDebit}
            matchedGrant={recoverMatchedGrant}
          />
        ) : null}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl border border-border/60 bg-muted/15 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">Current balance</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{formatInt(currentBalance)}</p>
          </div>
          <div
            className={`rounded-xl px-3 py-2.5 ${
              operation === "ADD"
                ? "border border-emerald-400/35 bg-emerald-500/10"
                : "border border-amber-400/35 bg-amber-500/10"
            }`}
          >
            <p
              className={`text-[10px] font-semibold uppercase tracking-[0.09em] ${
                operation === "ADD" ? "text-emerald-200/90" : "text-amber-200/90"
              }`}
            >
              Projected
            </p>
            <p className={`mt-1 text-lg font-semibold tabular-nums ${operation === "ADD" ? "text-emerald-300" : "text-amber-300"}`}>
              {formatInt(projected)}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {operation === "RECOVER"
            ? "Recover uses principal; debit may include promo if a matching grant exists (see preview above)."
            : "Projected balance includes Promo 1 + Promo 2 when tier rules apply."}
        </p>
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          className="h-auto px-0 text-[11px] font-semibold uppercase tracking-wide text-primary underline decoration-primary/40 underline-offset-2 hover:bg-transparent hover:decoration-primary"
        >
          Apply credit change
        </Button>
      </form>
    </div>
  );
}

export type { HierarchyCreditPreviewBundle };

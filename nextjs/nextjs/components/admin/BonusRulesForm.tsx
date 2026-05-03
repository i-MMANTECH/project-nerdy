"use client";

import { useState } from "react";
import { ArrowRight, Plus, Save, Trash2 } from "lucide-react";
import { saveBonusPromoRulesAction } from "@/actions/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PromoTier } from "@/lib/promoBonus";
import { validatePromoTiers } from "@/lib/promoBonus";

function emptyRow(): PromoTier {
  return { ge: Number.NaN, lt: null, percentage: Number.NaN };
}

function TierTable({
  title,
  subtitle,
  rows,
  onChange,
  onAdd,
  onRemove,
}: {
  title: string;
  subtitle: string;
  rows: PromoTier[];
  onChange: (index: number, patch: Partial<PromoTier>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <section className="min-w-0 space-y-2 rounded-xl border border-border/70 bg-card p-3 shadow-sm sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
          <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">{subtitle}</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 px-3 text-xs font-medium" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add tier
        </Button>
      </div>
      <div className="w-full overflow-x-auto rounded-xl border border-border/60 bg-background/30 shadow-inner">
        <div className="thin-scrollbar max-h-[min(60dvh,620px)] overflow-y-auto pb-2 [scrollbar-gutter:stable]">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
              <tr className="border-b border-border/70 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="w-16 py-2.5 pl-3 pr-2 font-medium">No</th>
                <th className="py-2.5 pr-2 font-medium">From (GE)</th>
                <th className="py-2.5 pr-2 font-medium">To (LT)</th>
                <th className="py-2.5 pr-2 font-medium">Rate %</th>
                <th className="w-10 py-2.5 pr-2" />
              </tr>
            </thead>
            <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                  No tiers yet. Click <span className="font-medium text-foreground">&quot;Add tier&quot;</span> to create your first range.
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} className="border-b border-border/35 last:border-0 even:bg-background/15 hover:bg-background/25">
                  <td className="py-1 pl-3 pr-2 align-middle">
                    <span className="inline-flex min-w-8 justify-center rounded-md border border-border/60 bg-muted/25 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-foreground/85">
                      {i + 1}
                    </span>
                  </td>
                  <td className="py-1 pr-1 align-middle">
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      placeholder="0"
                      value={Number.isFinite(row.ge) ? row.ge : ""}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        if (raw === "") {
                          onChange(i, { ge: Number.NaN });
                          return;
                        }
                        const parsed = Number.parseInt(raw, 10);
                        onChange(i, { ge: Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : Number.NaN });
                      }}
                      className="h-8 border-0 bg-transparent px-1.5 py-0 font-mono tabular-nums shadow-none ring-0 focus-visible:ring-0"
                      aria-label={`${title} row ${i + 1} GE`}
                    />
                  </td>
                  <td className="py-1 pr-1 align-middle">
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      placeholder="∞"
                      value={row.lt == null ? "" : row.lt}
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        if (v === "") onChange(i, { lt: null });
                        else onChange(i, { lt: Math.floor(Number.parseInt(v, 10) || 0) });
                      }}
                      className="h-8 border-0 bg-transparent px-1.5 py-0 font-mono tabular-nums shadow-none ring-0 focus-visible:ring-0"
                      aria-label={`${title} row ${i + 1} LT empty for open end`}
                    />
                  </td>
                  <td className="py-1 pr-1 align-middle">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      placeholder="0"
                      value={Number.isFinite(row.percentage) ? row.percentage : ""}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        if (raw === "") {
                          onChange(i, { percentage: Number.NaN });
                          return;
                        }
                        const parsed = Number.parseFloat(raw);
                        onChange(i, { percentage: Number.isFinite(parsed) ? parsed : Number.NaN });
                      }}
                      className="h-8 border-0 bg-transparent px-1.5 py-0 font-mono tabular-nums shadow-none ring-0 focus-visible:ring-0"
                      aria-label={`${title} row ${i + 1} percentage`}
                    />
                  </td>
                  <td className="py-1 pr-2 align-middle">
                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => onRemove(i)} aria-label={`Remove row ${i + 1}`}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export function BonusRulesForm({ initialP1, initialP2 }: { initialP1: PromoTier[]; initialP2: PromoTier[] }) {
  const [p1, setP1] = useState<PromoTier[]>(initialP1.length ? initialP1 : []);
  const [p2, setP2] = useState<PromoTier[]>(initialP2.length ? initialP2 : []);
  const [clientError, setClientError] = useState<string | null>(null);
  const p1Json = JSON.stringify(p1);
  const p2Json = JSON.stringify(p2);

  return (
    <form
      action={saveBonusPromoRulesAction}
      onSubmit={(e) => {
        setClientError(null);
        const err1 = validatePromoTiers(p1, "Promo 1 (requested credits)", true);
        if (err1) {
          e.preventDefault();
          setClientError(err1);
          return;
        }
        const err2 = validatePromoTiers(p2, "Promo 2 (active clients)", true);
        if (err2) {
          e.preventDefault();
          setClientError(err2);
        }
      }}
      className="min-w-0 space-y-4 pb-1"
    >
      {clientError ? <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{clientError}</p> : null}
      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <TierTable
          title="Promo 1 — Requested credits"
          subtitle="Rule: GE ≤ requested credits < LT. Leave LT empty for the final open-ended row."
          rows={p1}
          onAdd={() => setP1((r) => [...r, emptyRow()])}
          onRemove={(i) => setP1((r) => r.filter((_, j) => j !== i))}
          onChange={(i, patch) => setP1((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)))}
        />
        <TierTable
          title="Promo 2 — Active clients"
          subtitle="Counts active clients (status on, not expired). Uses the same rate % on requested credits."
          rows={p2}
          onAdd={() => setP2((r) => [...r, emptyRow()])}
          onRemove={(i) => setP2((r) => r.filter((_, j) => j !== i))}
          onChange={(i, patch) => setP2((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)))}
        />
      </div>
      <input type="hidden" name="promo_p1_json" value={p1Json} readOnly className="sr-only" aria-hidden tabIndex={-1} />
      <input type="hidden" name="promo_p2_json" value={p2Json} readOnly className="sr-only" aria-hidden tabIndex={-1} />
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2">
        <p className="text-xs text-muted-foreground">Rules must be contiguous with no overlap. Only one row may leave LT empty.</p>
        <Button
          type="submit"
          className="h-10 min-w-[160px] rounded-lg gap-1.5 bg-cyan-500 px-4 text-slate-950 hover:bg-cyan-400"
        >
          <Save className="h-3.5 w-3.5" aria-hidden />
          Save rules
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
    </form>
  );
}

import { CalendarRange, Coins, Gift, Info, RotateCcw, Save } from "lucide-react";
import type { FlashToastItem } from "@/components/FlashToasts";
import { FlashToastsBoundary } from "@/components/FlashToasts";
import { getDeductionsConfig } from "@/lib/data";
import { PageHeader } from "@/components/admin/PageHeader";
import { saveDeductionsAction } from "@/actions/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeductionMonthSelect } from "@/components/admin/DeductionMonthSelect";
import { cn } from "@/lib/cn";

type Props = { searchParams?: Promise<{ ok?: string }> };

const selectClassName = cn(
  "h-9 w-full min-w-0 rounded-md border border-input bg-input-background px-2.5 py-1.5 text-sm text-foreground outline-none transition-[color,box-shadow,border-color] duration-200 ease-out",
  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

export default async function DeductionsPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const cfg = await getDeductionsConfig();

  const deductionFlashes: FlashToastItem[] = sp.ok
    ? [
        {
          type: "success",
          message: "Changes saved",
          description: "Renewal credit rules and policy flags are now active for new renewals and purchases.",
        },
      ]
    : [];

  return (
    <div className="space-y-4 pb-6">
      {deductionFlashes.length ? <FlashToastsBoundary items={deductionFlashes} stripParams={["ok"]} /> : null}
      <PageHeader title="Credit deductions" breadcrumb="Home › Credit Deductions" />

      <div className="relative min-w-0 overflow-hidden rounded-xl border border-border/60 bg-card/95 shadow-sm ring-1 ring-black/[0.04] transition-shadow duration-200 dark:ring-white/[0.06]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-100"
          style={{
            background:
              "radial-gradient(560px 120px at 0% 0%, rgba(6, 182, 212, 0.1), transparent 55%), radial-gradient(480px 100px at 100% 0%, rgba(139, 92, 246, 0.05), transparent 50%)",
          }}
          aria-hidden
        />

        <div className="relative border-b border-border/50 px-4 py-3 sm:px-5 sm:py-3.5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold leading-tight tracking-tight text-foreground sm:text-lg">Renewal credit rules</h2>
              <p className="mt-1 max-w-2xl text-xs leading-snug text-muted-foreground sm:text-sm">
                For each subscription length (in months), set how many credits are charged when that validity is chosen.
                This drives the credit cost shown when staff renew or create accounts with a fixed term.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 rounded-md border border-border/55 bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground shadow-sm">
              <Info className="h-3.5 w-3.5 shrink-0 text-cyan-400/90" aria-hidden />
              <span>{cfg.rows.length} rule{cfg.rows.length === 1 ? "" : "s"}</span>
            </div>
          </div>
        </div>

        <form action={saveDeductionsAction} className="relative space-y-4 px-4 py-4 sm:px-5 sm:py-5">
          {cfg.rows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-4 text-center text-sm leading-snug text-muted-foreground">
              No deduction rows are configured in the database yet. Add rows in <span className="font-mono text-foreground">credit_deductions</span> or seed
              defaults, then reload this page.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="hidden gap-3 border-b border-border/45 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="flex items-center gap-1.5">
                  <CalendarRange className="h-3.5 w-3.5 text-cyan-400/90" aria-hidden />
                  Validity (months)
                </div>
                <div className="flex items-center gap-1.5">
                  <Coins className="h-3.5 w-3.5 text-amber-400/90" aria-hidden />
                  Credits charged
                </div>
              </div>

              <ul className="space-y-2">
                {cfg.rows.map((row, index) => {
                  const monthSelectId = `deduction-month-${row.id}`;
                  const creditsInputId = `deduction-credits-${row.id}`;
                  return (
                    <li
                      key={row.id}
                      className="rounded-lg border border-border/55 bg-muted/[0.1] p-3 ring-1 ring-black/[0.02] transition-[border-color,box-shadow,background-color] duration-200 ease-out hover:border-border/80 hover:bg-muted/[0.14] dark:bg-muted/10 dark:ring-white/[0.04] dark:hover:bg-muted/[0.12] sm:p-3.5"
                    >
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:hidden">
                        Rule {index + 1}
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                        <div className="space-y-1.5">
                          <label htmlFor={monthSelectId} className="text-xs font-medium text-foreground sm:text-sm">
                            When validity is
                          </label>
                          <DeductionMonthSelect
                            id={monthSelectId}
                            name={`month_${row.id}`}
                            defaultMonth={row.month}
                            className={selectClassName}
                          />
                          <p className="text-[11px] leading-snug text-muted-foreground">
                            Applies when this many months of service are selected for the subscription term.
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <label htmlFor={creditsInputId} className="text-xs font-medium text-foreground sm:text-sm">
                            Charge this many credits
                          </label>
                          <Input
                            id={creditsInputId}
                            name={`month_deduction_${row.id}`}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            defaultValue={row.month_deduction}
                            className="h-9 max-w-[180px] font-mono tabular-nums transition-[border-color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-ring/40"
                          />
                          <p className="text-[11px] leading-snug text-muted-foreground">
                            Debit from the operator or subscriber credit balance (not currency). Use integers; zero means no extra charge for this tier.
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="space-y-2 border-t border-border/40 pt-3">
            <h3 className="text-xs font-semibold tracking-tight text-foreground sm:text-sm">Policy options</h3>
            <p className="max-w-2xl text-[11px] leading-snug text-muted-foreground">
              These flags match the legacy billing configuration keys and affect how free time and bonus credits behave across the panel.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label
                htmlFor="one_month_free"
                className="group flex cursor-pointer gap-2.5 rounded-lg border border-border/55 bg-card/70 p-3 shadow-sm transition-[border-color,background-color,box-shadow] duration-200 ease-out hover:border-cyan-500/25 hover:bg-muted/20 hover:shadow-md has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/40"
              >
                <input
                  id="one_month_free"
                  type="checkbox"
                  name="one_month_free"
                  value="1"
                  defaultChecked={cfg.monthFree}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-input text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-foreground sm:text-sm">
                    <Gift className="h-3.5 w-3.5 shrink-0 text-cyan-400/90 transition-transform duration-200 group-hover:scale-105" aria-hidden />
                    One month free
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                    When enabled, billing treats one month of the term as complimentary where the product logic applies (legacy “1 month free” flag).
                  </span>
                </span>
              </label>
              <label
                htmlFor="is_recover_bonus_credit"
                className="group flex cursor-pointer gap-2.5 rounded-lg border border-border/55 bg-card/70 p-3 shadow-sm transition-[border-color,background-color,box-shadow] duration-200 ease-out hover:border-violet-500/25 hover:bg-muted/20 hover:shadow-md has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/40"
              >
                <input
                  id="is_recover_bonus_credit"
                  type="checkbox"
                  name="is_recover_bonus_credit"
                  value="1"
                  defaultChecked={cfg.recoverBonus}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-input text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-foreground sm:text-sm">
                    <RotateCcw className="h-3.5 w-3.5 shrink-0 text-violet-400/90 transition-transform duration-200 group-hover:scale-105" aria-hidden />
                    Recover bonus credit
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                    When enabled, the system may reclaim bonus credits according to your bonus recovery rules (legacy config key).
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-border/50 pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <p className="text-[11px] leading-snug text-muted-foreground sm:max-w-[60%]">
              Saving replaces all rows in <span className="font-mono text-foreground/90">credit_deductions</span> with the values above and updates config flags.
            </p>
            <Button
              type="submit"
              className="h-9 w-full gap-2 rounded-md bg-cyan-500 px-4 text-sm font-semibold text-cyan-950 shadow-sm transition-[background-color,box-shadow,transform] duration-200 hover:bg-cyan-400 hover:shadow-md active:translate-y-px sm:w-auto sm:shrink-0"
            >
              <Save className="h-4 w-4 shrink-0" aria-hidden />
              Save changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

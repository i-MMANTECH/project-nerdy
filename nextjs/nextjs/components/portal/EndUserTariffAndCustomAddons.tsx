"use client";

import { useEffect, useMemo, useState } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormSelect } from "@/components/forms/form-select";
import { NativeSelect } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

type TariffOpt = { id: number; name: string };
type AddonPkg = { package_id: number; name: string };

function packMatchesFilter(p: AddonPkg, q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const name = (p.name || "").toLowerCase();
  return name.includes(s) || String(p.package_id).includes(s);
}

/**
 * Package selector + optional `packs[]` checkboxes when the chosen tariff is Stalker “CUSTOM PACKAGE”
 * (PHP `users/add` + `tariff_custom` / `packs[]`).
 */
export function EndUserTariffAndCustomAddons({
  tariffs,
  customPlanId,
  addonPackages,
  initialPlanId,
  initialSelectedPackIds,
}: {
  tariffs: TariffOpt[];
  customPlanId: number | null;
  addonPackages: AddonPkg[];
  initialPlanId?: number | null;
  initialSelectedPackIds?: number[];
}) {
  const [filter, setFilter] = useState("");
  const [selectedPacks, setSelectedPacks] = useState<Set<number>>(
    () => new Set((initialSelectedPackIds ?? []).filter((n) => Number.isFinite(n) && n > 0)),
  );
  const initialSelectedPacksKey = useMemo(
    () =>
      (initialSelectedPackIds ?? [])
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n) && n > 0)
        .sort((a, b) => a - b)
        .join(","),
    [initialSelectedPackIds],
  );

  if (!tariffs.length) {
    return (
      <FormField id="pkg-empty" label="Package">
        <NativeSelect id="pkg-empty" name="package" disabled value="" className="h-10 w-full opacity-70">
          <option value="">No packages</option>
        </NativeSelect>
      </FormField>
    );
  }

  const firstId = tariffs[0]!.id;
  const [plan, setPlan] = useState(
    initialPlanId != null && Number.isFinite(initialPlanId) && initialPlanId > 0 ? String(initialPlanId) : String(firstId),
  );
  const planNum = Number.parseInt(plan, 10);
  const showAddons =
    customPlanId != null && addonPackages.length > 0 && Number.isFinite(planNum) && planNum === customPlanId;

  const packageOptions = useMemo(() => tariffs.map((t) => ({ value: String(t.id), label: t.name })), [tariffs]);

  const visibleCount = useMemo(
    () => addonPackages.filter((p) => packMatchesFilter(p, filter)).length,
    [addonPackages, filter],
  );

  function setPacksForVisible(checked: boolean) {
    setSelectedPacks((prev) => {
      const next = new Set(prev);
      addonPackages.forEach((p) => {
        if (!packMatchesFilter(p, filter)) return;
        if (checked) next.add(p.package_id);
        else next.delete(p.package_id);
      });
      return next;
    });
  }

  useEffect(() => {
    const nextPlan =
      initialPlanId != null && Number.isFinite(initialPlanId) && initialPlanId > 0 ? String(initialPlanId) : String(firstId);
    setPlan(nextPlan);
  }, [initialPlanId, firstId]);

  useEffect(() => {
    const ids =
      initialSelectedPacksKey === ""
        ? []
        : initialSelectedPacksKey
            .split(",")
            .map((v) => Number(v))
            .filter((n) => Number.isFinite(n) && n > 0);
    setSelectedPacks(new Set(ids));
  }, [initialSelectedPacksKey]);

  return (
    <>
      <FormField id="pkg-select" label="Package">
        <FormSelect
          id="pkg-select"
          name="package"
          required
          value={plan}
          onValueChange={setPlan}
          options={packageOptions}
        />
      </FormField>
      {showAddons ? (
        <details className="group rounded-xl border border-border/60 bg-muted/10 ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.06]">
          <summary className="cursor-pointer list-none px-4 py-3.5 transition-colors hover:bg-muted/25 sm:px-5 [&::-webkit-details-marker]:hidden">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-sm font-semibold text-foreground">Active packages</span>
                <span className="ml-2 text-sm font-normal text-muted-foreground">(optional)</span>
              </div>
              <span className="rounded-full bg-muted/80 px-2.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-foreground">
                {addonPackages.length}
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground group-open:hidden">
              Stays collapsed so the form stays short — expand to pick Stalker add-on channels for this custom plan.
            </p>
          </summary>
          <div className="space-y-3 border-t border-border/50 px-4 py-4 sm:px-5">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Same as PHP: saved to{" "}
              <code className="rounded bg-muted/80 px-1.5 py-0.5 font-mono text-[11px]">user_package_subscription</code>{" "}
              when the account is created.
            </p>
            <Input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by name or ID…"
              className="h-10 max-w-md"
              autoComplete="off"
            />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold">
              <button
                type="button"
                className="rounded-md text-primary transition hover:bg-primary/10 hover:text-primary/90"
                onClick={() => setPacksForVisible(true)}
              >
                Select shown
              </button>
              <span className="text-muted-foreground/40">·</span>
              <button
                type="button"
                className="rounded-md text-primary transition hover:bg-primary/10 hover:text-primary/90"
                onClick={() => setPacksForVisible(false)}
              >
                Clear shown
              </button>
              <span className="text-muted-foreground">
                Selected <span className="font-mono text-foreground">{selectedPacks.size}</span> :{" "}
                <span className="font-mono text-foreground">{addonPackages.length}</span>
              </span>
            </div>
            <div className="thin-scrollbar max-h-[min(320px,42vh)] overflow-y-auto rounded-lg border border-border/50 bg-background/40 p-2 sm:p-3">
              <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2 lg:grid-cols-3">
                {addonPackages.map((p) => {
                  const matches = packMatchesFilter(p, filter);
                  return (
                    <label
                      key={p.package_id}
                      data-pack-visible={matches ? "1" : "0"}
                      className={cn(
                        "flex min-w-0 cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/40",
                        !matches && "hidden",
                      )}
                    >
                      <Checkbox
                        name="packs"
                        value={String(p.package_id)}
                        checked={selectedPacks.has(p.package_id)}
                        onChange={(e) => {
                          const checked = e.currentTarget.checked;
                          setSelectedPacks((prev) => {
                            const next = new Set(prev);
                            if (checked) next.add(p.package_id);
                            else next.delete(p.package_id);
                            return next;
                          });
                        }}
                        className="mt-0.5"
                      />
                      <span className="min-w-0 leading-snug">{p.name || `Package #${p.package_id}`}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </details>
      ) : null}
    </>
  );
}

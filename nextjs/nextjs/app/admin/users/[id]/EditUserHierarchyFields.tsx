"use client";

import { useMemo, useRef, useState } from "react";
import { loadDealersForResellerAction } from "@/actions/forms";
import { FormSelect } from "@/components/forms/form-select";
import { cn } from "@/lib/cn";

type Opt = { username: string; name: string };

type AddonPkg = { package_id: number; name: string };

type Props = {
  initialReseller: string;
  initialDealer: string;
  resellers: Opt[];
  initialDealers: Opt[];
  tariffs: { id: number; name: string }[];
  initialTariffPlanId: number;
  initialParentPin: string;
  customPackagePlanId: number | null;
  addonPackages: AddonPkg[];
  subscribedPackageIds: number[];
};

const hierarchySelectClass = cn(
  "h-10 w-full border-border/80 bg-background/80 shadow-sm ring-offset-background",
);

export function EditUserHierarchyFields({
  initialReseller,
  initialDealer,
  resellers,
  initialDealers,
  tariffs,
  initialTariffPlanId,
  initialParentPin,
  customPackagePlanId,
  addonPackages,
  subscribedPackageIds,
}: Props) {
  const packListRef = useRef<HTMLDivElement>(null);
  const [dealers, setDealers] = useState<Opt[]>(initialDealers);
  const [loadingDealers, setLoadingDealers] = useState(false);
  const [resellerChosen, setResellerChosen] = useState(Boolean(initialReseller));
  const [activeReseller, setActiveReseller] = useState(initialReseller);
  const [dealerValue, setDealerValue] = useState(initialDealer);

  const initialTariffStr =
    initialTariffPlanId > 0 ? String(initialTariffPlanId) : tariffs[0] ? String(tariffs[0].id) : "";
  const [tariffSelection, setTariffSelection] = useState(initialTariffStr);

  async function onResellerChange(username: string) {
    if (!username) {
      setDealers([]);
      setResellerChosen(false);
      return;
    }
    setResellerChosen(true);
    setLoadingDealers(true);
    try {
      const d = await loadDealersForResellerAction(username);
      setDealers(d);
    } finally {
      setLoadingDealers(false);
    }
  }

  const noTariffs = tariffs.length === 0;
  const showAddonPackages =
    customPackagePlanId != null &&
    addonPackages.length > 0 &&
    Number(tariffSelection) === customPackagePlanId;

  const resellerOptions = useMemo(
    () =>
      resellers.map((r) => ({
        value: r.username,
        label: `${r.username}${r.name && r.name !== r.username ? ` — ${r.name}` : ""}`,
      })),
    [resellers],
  );

  const dealerOptions = useMemo(
    () => [{ value: "", label: "— Bill under reseller only —" }, ...dealers.map((d) => ({ value: d.username, label: d.username }))],
    [dealers],
  );

  const packageOptions = useMemo(() => tariffs.map((t) => ({ value: String(t.id), label: t.name })), [tariffs]);

  function setAllPacks(checked: boolean) {
    const root = packListRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name="packs"]').forEach((el) => {
      el.checked = checked;
    });
  }

  return (
    <>
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reseller</label>
        <FormSelect
          name="reseller"
          required
          placeholder="Select reseller"
          value={activeReseller}
          onValueChange={(v) => {
            setActiveReseller(v);
            setDealerValue("");
            void onResellerChange(v);
          }}
          options={resellerOptions}
          className={hierarchySelectClass}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dealer (optional)</label>
        <FormSelect
          name="dealer"
          value={dealerValue}
          onValueChange={setDealerValue}
          disabled={!resellerChosen || loadingDealers}
          options={dealerOptions}
          className={hierarchySelectClass}
        />
        {loadingDealers ? <p className="mt-1 text-xs text-muted-foreground">Loading dealers…</p> : null}
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Package (Stalker tariff)</label>
        {noTariffs ? (
          <>
            <input type="hidden" name="package" value="" />
            <div className="flex h-10 items-center rounded-lg border border-border/80 bg-muted/30 px-3 text-sm text-muted-foreground">
              No plans (configure Stalker DB)
            </div>
          </>
        ) : (
          <FormSelect
            name="package"
            required
            value={tariffSelection}
            onValueChange={setTariffSelection}
            options={packageOptions}
            className={hierarchySelectClass}
          />
        )}
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Parent PIN (Stalker)</label>
        <input
          name="parent_password"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{4}"
          title="Four digits"
          minLength={4}
          maxLength={4}
          defaultValue={/^\d{4}$/.test(initialParentPin) ? initialParentPin : "9090"}
          className="h-10 w-full rounded-lg border border-border/80 bg-background/80 px-3 font-mono text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="9090"
        />
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">PHP requires a 4-digit parent / PIN for this form.</p>
      </div>
      {showAddonPackages ? (
        <div className="sm:col-span-2">
          <p className="mb-1 text-sm font-semibold tracking-tight text-foreground">Select packages</p>
          <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
            Same as PHP: only when <span className="font-medium text-foreground/90">Package (Stalker tariff)</span> is the custom plan. Saves to{" "}
            <code className="rounded bg-muted/80 px-1.5 py-0.5 font-mono text-[11px]">user_package_subscription</code>.
          </p>
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold">
            <button
              type="button"
              className="rounded-md text-primary transition hover:bg-primary/10 hover:text-primary/90"
              onClick={() => setAllPacks(true)}
            >
              Select all
            </button>
            <span className="text-border">·</span>
            <button
              type="button"
              className="rounded-md text-primary transition hover:bg-primary/10 hover:text-primary/90"
              onClick={() => setAllPacks(false)}
            >
              Deselect all
            </button>
          </div>
          <div
            ref={packListRef}
            key={tariffSelection}
            className="thin-scrollbar max-h-[min(280px,42vh)] overflow-y-auto rounded-xl border border-border/50 bg-muted/10 p-2.5 text-sm ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.06] sm:p-3"
          >
            <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2 sm:gap-x-2">
              {addonPackages.map((p) => (
                <label
                  key={p.package_id}
                  className="flex min-w-0 cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/40"
                >
                  <input
                    type="checkbox"
                    name="packs"
                    value={String(p.package_id)}
                    defaultChecked={subscribedPackageIds.includes(p.package_id)}
                    className="mt-0.5 size-4 shrink-0 rounded border-border text-primary"
                  />
                  <span className="min-w-0 leading-snug">{p.name || `Package #${p.package_id}`}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      ) : customPackagePlanId == null ? (
        <p className="sm:col-span-2 text-xs text-muted-foreground">
          No Stalker tariff named <code className="rounded bg-muted px-1">CUSTOM PACKAGE</code> (or starting with that prefix) — add-on checkboxes are unavailable.
        </p>
      ) : addonPackages.length === 0 ? (
        <p className="sm:col-span-2 text-xs text-muted-foreground">
          Custom package plan has no rows in <code className="rounded bg-muted px-1">package_in_plan</code> for that plan.
        </p>
      ) : null}
    </>
  );
}

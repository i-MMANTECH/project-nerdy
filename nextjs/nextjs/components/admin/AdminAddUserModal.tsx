"use client";

import { useEffect, useState } from "react";
import { Save, UserPlus, X } from "lucide-react";
import { createUserAction, loadDealersForResellerAction, saveUserAction } from "@/actions/forms";
import { EndUserTariffAndCustomAddons } from "@/components/portal/EndUserTariffAndCustomAddons";
import { FormField } from "@/components/forms/form-field";
import { MacAddressInput } from "@/components/forms/MacAddressInput";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/forms/form-select";
import { SearchableFormSelect } from "@/components/forms/SearchableFormSelect";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

type ResellerOpt = { username: string; name: string };
type TariffOpt = { id: number; name: string };
type ValidityOpt = { value: string; label: string };
type AddonPkg = { package_id: number; name: string };

type Props = {
  open: boolean;
  onClose: () => void;
  resellers: ResellerOpt[];
  tariffs: TariffOpt[];
  validityOptions: ValidityOpt[];
  customPlanId: number | null;
  addonPackages: AddonPkg[];
  mode?: "add" | "edit";
  initialValues?: {
    account?: string;
    name?: string;
    password?: string;
    mac?: string;
    phone?: string;
    status?: number;
    reseller?: string;
    dealer?: string;
    packageId?: number;
    subscribedPackageIds?: number[];
    parentPin?: string;
    note?: string;
  };
  returnTo?: string;
};

export function AdminAddUserModal({
  open,
  onClose,
  resellers,
  tariffs,
  validityOptions,
  customPlanId,
  addonPackages,
  mode = "add",
  initialValues,
  returnTo = "/admin/users",
}: Props) {
  const [dealers, setDealers] = useState<ResellerOpt[]>([]);
  const [loadingDealers, setLoadingDealers] = useState(false);
  const [resellerChosen, setResellerChosen] = useState(false);
  const [activeReseller, setActiveReseller] = useState("");
  const [dealerValue, setDealerValue] = useState("");
  const noTariffs = tariffs.length === 0;
  const grid = "grid gap-2.5 grid-cols-1";
  const rowFieldClass = "gap-x-1.5 [grid-template-columns:6.75rem_minmax(0,1fr)]";

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

  useEffect(() => {
    if (!open) return;
    const nextReseller = initialValues?.reseller ?? "";
    const nextDealer = initialValues?.dealer ?? "";
    setActiveReseller(nextReseller);
    setDealerValue(nextDealer);
    setResellerChosen(Boolean(nextReseller));
    if (!nextReseller) {
      setDealers([]);
      return;
    }
    void loadDealersForResellerAction(nextReseller)
      .then((d) => setDealers(d))
      .catch(() => setDealers([]));
  }, [open, initialValues?.reseller, initialValues?.dealer, initialValues?.packageId, tariffs]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-2.5 backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
      aria-label="Add user"
      onClick={onClose}
    >
      <div
        className="thin-scrollbar max-h-[92vh] w-full max-w-4xl overflow-auto rounded-xl border border-border/50 bg-card/95 shadow-2xl ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-2 border-b border-border/50 bg-muted/10 px-3.5 pb-2 pt-2.5 backdrop-blur sm:px-4">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground">{mode === "edit" ? "Edit user" : "Add user"}</h2>
            <p className="text-sm text-muted-foreground">
              {mode === "edit"
                ? `Update account: ${initialValues?.account ?? ""}`
                : "Create a new account without leaving this page."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-background/40 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <form action={mode === "edit" ? saveUserAction : createUserAction} className="w-full px-3.5 pb-3.5 pt-2.5 sm:px-4 sm:pb-4">
          <input type="hidden" name="returnTo" value={returnTo} />
          {mode === "edit" && initialValues?.account ? <input type="hidden" name="account" value={initialValues.account} /> : null}
          <input type="hidden" name="apply_packs" value="1" />
          <div className="flex flex-col gap-2.5">
            <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
              <section className="rounded-lg border border-border/50 bg-muted/[0.08] p-2.5">
                <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Account</h3>
                <div className={cn(grid)}>
                  <FormField id="mu-name" label="Name" density="compact" layout="horizontal" className={rowFieldClass}>
                    <Input id="mu-name" name="name" placeholder="Display name" className="h-9 rounded-md border-border/60 bg-background/40" />
                  </FormField>
                  <FormField
                    id="mu-username"
                    label="Login (device ID)"
                    hint="Lowercase letters and digits only."
                    density="compact"
                    layout="horizontal"
                    className={rowFieldClass}
                  >
                    <Input
                      id="mu-username"
                      name={mode === "add" ? "username" : undefined}
                      required={mode === "add"}
                      pattern={mode === "add" ? "[a-z0-9]+" : undefined}
                      title={mode === "add" ? "Lowercase letters and digits only" : undefined}
                      className="h-9 rounded-md border-border/60 bg-background/40 font-mono"
                      placeholder={mode === "add" ? "clientlogin" : undefined}
                      defaultValue={mode === "edit" ? initialValues?.account ?? "" : undefined}
                      readOnly={mode === "edit"}
                    />
                  </FormField>
                  <FormField
                    id="mu-password"
                    label="Password"
                    hint="Minimum 4 characters."
                    density="compact"
                    layout="horizontal"
                    className={rowFieldClass}
                  >
                    <Input
                      id="mu-password"
                      name="password"
                      type="text"
                      required
                      minLength={4}
                      maxLength={100}
                      className="h-9 rounded-md border-border/60 bg-background/40 font-mono"
                      placeholder="Min 4 characters"
                      defaultValue={mode === "edit" ? initialValues?.password ?? "" : undefined}
                    />
                  </FormField>
                  <FormField id="mu-mac" label="MAC address" density="compact" layout="horizontal" className={rowFieldClass}>
                    <MacAddressInput
                      id="mu-mac"
                      name="mac"
                      required
                      className="h-9 rounded-md border-border/60 bg-background/40 px-3 font-mono uppercase"
                      placeholder="00:1A:79:00:00:01"
                      defaultValue={mode === "edit" ? initialValues?.mac ?? "" : undefined}
                    />
                  </FormField>
                  {mode === "edit" ? (
                    <FormField id="mu-phone" label="Phone" density="compact" layout="horizontal" className={rowFieldClass}>
                      <Input id="mu-phone" name="phone" className="h-9 rounded-md border-border/60 bg-background/40" defaultValue={initialValues?.phone ?? ""} />
                    </FormField>
                  ) : null}
                </div>
              </section>

              <div className="flex flex-col gap-2.5">
                <section className="rounded-lg border border-border/50 bg-muted/[0.08] p-2.5">
                  <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Subscription</h3>
                  <div className={cn(grid)}>
                    {mode === "add" ? (
                      <FormField id="mu-validity" label="Validity" density="compact" layout="horizontal" className={rowFieldClass}>
                        <FormSelect
                          id="mu-validity"
                          name="validity"
                          required
                          defaultValue="1"
                          className="h-9 rounded-md border-border/60 bg-background/40"
                          options={validityOptions.map((o) => ({ value: o.value, label: o.label }))}
                        />
                      </FormField>
                    ) : (
                      <FormField id="mu-parent-pin" label="Parent PIN" density="compact" layout="horizontal" className={rowFieldClass}>
                        <Input
                          id="mu-parent-pin"
                          name="parent_password"
                          className="h-9 rounded-md border-border/60 bg-background/40 font-mono"
                          inputMode="numeric"
                          pattern="[0-9]{4}"
                          minLength={4}
                          maxLength={4}
                          defaultValue={initialValues?.parentPin || "9090"}
                        />
                      </FormField>
                    )}
                    <FormField id="mu-status" label="Status" density="compact" layout="horizontal" className={rowFieldClass}>
                      <FormSelect
                        id="mu-status"
                        name="status"
                        defaultValue={mode === "edit" ? String(initialValues?.status ?? 0) : "0"}
                        className="h-9 rounded-md border-border/60 bg-background/40"
                        options={[
                          { value: "0", label: "Active" },
                          { value: "1", label: "Inactive" },
                        ]}
                      />
                    </FormField>
                  </div>
                </section>

                <section className="rounded-lg border border-border/50 bg-muted/[0.08] p-2.5">
                  <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Billing ownership</h3>
                  <div className={cn(grid)}>
                    <FormField id="mu-reseller" label="Reseller" density="compact" layout="horizontal" className={rowFieldClass}>
                      <SearchableFormSelect
                        id="mu-reseller"
                        name="reseller"
                        value={activeReseller}
                        onValueChange={(v) => {
                          setActiveReseller(v);
                          setDealerValue("");
                          void onResellerChange(v);
                        }}
                        required
                        placeholder="Select reseller"
                        searchPlaceholder="Search reseller..."
                        className="w-full"
                        options={resellers.map((r) => ({
                          value: r.username,
                          label: `${r.username}${r.name && r.name !== r.username ? ` — ${r.name}` : ""}`,
                        }))}
                      />
                    </FormField>
                    <FormField
                      id="mu-dealer"
                      label="Dealer (optional)"
                      hint={loadingDealers ? "Loading dealers..." : "Leave empty to bill only under the reseller."}
                      density="compact"
                      layout="horizontal"
                      className={rowFieldClass}
                    >
                      <SearchableFormSelect
                        id="mu-dealer"
                        name="dealer"
                        value={dealerValue}
                        onValueChange={setDealerValue}
                        placeholder="— Use reseller as owner —"
                        searchPlaceholder="Search dealer..."
                        className="w-full"
                        disabled={!resellerChosen}
                        options={[
                          { value: "", label: "— Use reseller as owner —" },
                          ...dealers.map((d) => ({ value: d.username, label: d.username })),
                        ]}
                      />
                    </FormField>
                  </div>
                </section>

              </div>
            </div>

            <section className="rounded-lg border border-border/50 bg-muted/[0.08] p-2.5">
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Stalker package</h3>
              <div className="max-w-2xl space-y-2.5">
                <EndUserTariffAndCustomAddons
                  tariffs={tariffs}
                  customPlanId={customPlanId}
                  addonPackages={addonPackages}
                  initialPlanId={mode === "edit" ? (initialValues?.packageId ?? null) : null}
                  initialSelectedPackIds={mode === "edit" ? (initialValues?.subscribedPackageIds ?? []) : []}
                />
              </div>
            </section>

            <section className="rounded-lg border border-border/50 bg-muted/[0.08] p-2.5">
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Notes</h3>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground" htmlFor="mu-note">
                  Comments
                </label>
                <textarea
                  id="mu-note"
                  name="note"
                  rows={3}
                  defaultValue={mode === "edit" ? initialValues?.note ?? "" : undefined}
                  className="w-full rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Internal comments..."
                />
              </div>
            </section>

            <div className="sticky bottom-0 z-10 -mx-3.5 flex items-center justify-end gap-4 border-t border-border/70 bg-card/95 px-3.5 pt-2.5 sm:-mx-4 sm:px-4">
              <Button type="button" variant="ctaLinkMuted" size="inline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="ctaLink" size="inline" disabled={noTariffs} className="gap-1">
                {mode === "edit" ? (
                  <>
                    Save changes
                    <Save className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                  </>
                ) : (
                  <>
                    Create user
                    <UserPlus className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

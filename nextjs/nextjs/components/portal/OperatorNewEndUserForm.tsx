"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { EndUserTariffAndCustomAddons } from "@/components/portal/EndUserTariffAndCustomAddons";
import { FormField } from "@/components/forms/form-field";
import { MacAddressInput } from "@/components/forms/MacAddressInput";
import { Alert } from "@/components/ui/alert";
import { Button, buttonOutlineLinkClassName } from "@/components/ui/button";
import { FormSelect } from "@/components/forms/form-select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

type TariffOpt = { id: number; name: string };
type ValidityOpt = { value: string; label: string };
type AddonPkg = { package_id: number; name: string };

type Props = {
  /** Server action from `actions/forms` (dealer / reseller / reseller-dealer). */
  formAction: (formData: FormData) => void | Promise<void>;
  cancelHref: string;
  /** Prefix for control ids (avoid collisions if multiple instances). */
  idPrefix: string;
  validityOptions: ValidityOpt[];
  tariffs: TariffOpt[];
  customPlanId: number | null;
  addonPackages: AddonPkg[];
  /** Dealer portal only — maps to `status` in `createDealerEndUserAction`. */
  showStatus?: boolean;
  /** Reseller creating under a dealer — hidden `dealer` field. */
  ownedByDealer?: string;
};

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{children}</h2>
  );
}

export function OperatorNewEndUserForm({
  formAction,
  cancelHref,
  idPrefix,
  validityOptions,
  tariffs,
  customPlanId,
  addonPackages,
  showStatus = false,
  ownedByDealer,
}: Props) {
  const noTariffs = tariffs.length === 0;
  const grid = "grid gap-4 md:grid-cols-2 md:gap-x-6 md:gap-y-4";

  return (
    <div className="mx-auto w-full max-w-5xl">
      {noTariffs ? (
        <Alert className="mb-6 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs">
          No tariff plans found. Set <code>STALKER_DATABASE_*</code> in <code>.env.local</code> so packages load from Stalker{" "}
          <code>tariff_plan</code>.
        </Alert>
      ) : null}
      <form action={formAction} className="w-full">
        {ownedByDealer ? <input type="hidden" name="dealer" value={ownedByDealer} /> : null}
        <div className="flex flex-col gap-8 sm:gap-10">
          <section>
            <SectionTitle>Account</SectionTitle>
            <div className={cn(grid)}>
              <FormField id={`${idPrefix}-name`} label="Name">
                <Input id={`${idPrefix}-name`} name="name" placeholder="Display name" />
              </FormField>
              <FormField id={`${idPrefix}-username`} label="Login (device ID)" hint="Lowercase letters and digits only.">
                <Input
                  id={`${idPrefix}-username`}
                  name="username"
                  required
                  pattern="[a-z0-9]+"
                  title="Lowercase letters and digits only"
                  className="font-mono"
                  placeholder="clientlogin"
                />
              </FormField>
              <FormField id={`${idPrefix}-password`} label="Password" hint="Minimum 4 characters.">
                <Input
                  id={`${idPrefix}-password`}
                  name="password"
                  type="text"
                  required
                  minLength={4}
                  maxLength={100}
                  className="font-mono"
                  placeholder="Min 4 characters"
                />
              </FormField>
              <FormField id={`${idPrefix}-mac`} label="MAC address">
                <MacAddressInput
                  id={`${idPrefix}-mac`}
                  name="mac"
                  required
                  className="font-mono uppercase"
                  placeholder="00:1A:79:00:00:01"
                />
              </FormField>
            </div>
          </section>

          <section className="border-t border-border/60 pt-8 sm:pt-10">
            <SectionTitle>Subscription</SectionTitle>
            <div className={cn(grid, !showStatus && "md:max-w-md")}>
              <FormField id={`${idPrefix}-validity`} label="Validity">
                <FormSelect
                  id={`${idPrefix}-validity`}
                  name="validity"
                  required
                  defaultValue="1"
                  options={validityOptions.map((o) => ({ value: o.value, label: o.label }))}
                />
              </FormField>
              {showStatus ? (
                <FormField id={`${idPrefix}-status`} label="Status">
                  <FormSelect
                    id={`${idPrefix}-status`}
                    name="status"
                    defaultValue="0"
                    options={[
                      { value: "0", label: "Active" },
                      { value: "1", label: "Inactive" },
                    ]}
                  />
                </FormField>
              ) : null}
            </div>
          </section>

          <section className="border-t border-border/60 pt-8 sm:pt-10">
            <SectionTitle>Stalker package</SectionTitle>
            <div className="max-w-2xl space-y-4">
              <EndUserTariffAndCustomAddons tariffs={tariffs} customPlanId={customPlanId} addonPackages={addonPackages} />
            </div>
          </section>

          <div className="flex flex-col-reverse gap-3 border-t border-border/60 pt-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3">
            <Link href={cancelHref} className={buttonOutlineLinkClassName("min-h-11 w-full justify-center sm:w-auto")}>
              Cancel
            </Link>
            <Button type="submit" disabled={noTariffs} className="min-h-11 w-full px-8 font-semibold sm:w-auto">
              Create user
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

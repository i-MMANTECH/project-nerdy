import Link from "next/link";
import { getDeductionsConfig, listResellersForSelect, listStalkerTariffPlans } from "@/lib/data";
import { getStalkerCustomPackagePlanId, listStalkerPackagesForPlan } from "@/lib/repos/stalkerUserPackages";
import { PageHeader } from "@/components/admin/PageHeader";
import { Panel } from "@/components/admin/Panel";
import { NewUserForm } from "./NewUserForm";
import { buttonOutlineLinkClassName } from "@/components/ui/button";
import { FlashToastsBoundary } from "@/components/FlashToasts";
import { newEndUserCreationFlashItems } from "@/lib/urlFlashToasts";

type Props = {
  searchParams?: Promise<{ error?: string; bal?: string; req?: string }>;
};

function buildValidityOptions(monthFree: boolean) {
  const out: { value: string; label: string }[] = [{ value: "FREE_TRIAL", label: "2 days trial" }];
  if (monthFree) {
    out.push({ value: "1_MONTH_FREE", label: "1 month free (bonus)" });
  }
  for (let i = 1; i <= 24; i++) {
    out.push({ value: String(i), label: `${i} month${i === 1 ? "" : "s"}` });
  }
  return out;
}

export default async function NewUserPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const newUserFlashes = newEndUserCreationFlashItems(sp, "admin");

  const [resellers, cfg, tariffs, customPlanId] = await Promise.all([
    listResellersForSelect(),
    getDeductionsConfig(),
    listStalkerTariffPlans(),
    getStalkerCustomPackagePlanId(),
  ]);
  const addonPackages =
    customPlanId != null && Number.isFinite(customPlanId) && customPlanId > 0
      ? await listStalkerPackagesForPlan(customPlanId)
      : [];
  const validityOptions = buildValidityOptions(cfg.monthFree);

  return (
    <div>
      <PageHeader
        title="Add user"
        breadcrumb={
          <>
            <Link href="/admin/dashboard" className="text-primary hover:underline">
              Home
            </Link>
            <span className="text-muted-foreground"> · </span>
            <Link href="/admin/users" className="text-primary hover:underline">
              Users
            </Link>
            <span className="text-muted-foreground"> · </span>
            <span className="text-foreground">New</span>
          </>
        }
        actions={
          <Link href="/admin/users" className={buttonOutlineLinkClassName("bg-card shadow-sm")}>
            Back to users
          </Link>
        }
      />
      {newUserFlashes.length ? (
        <FlashToastsBoundary items={newUserFlashes} stripParams={["error", "bal", "req"]} />
      ) : null}
      <Panel
        title="New account"
        className="overflow-hidden rounded-2xl border-border/60 bg-card/95 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
      >
        <NewUserForm
          resellers={resellers}
          tariffs={tariffs}
          validityOptions={validityOptions}
          customPlanId={customPlanId}
          addonPackages={addonPackages}
        />
      </Panel>
    </div>
  );
}

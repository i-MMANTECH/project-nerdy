import Link from "next/link";
import { redirect } from "next/navigation";
import { getDeductionsConfig, listStalkerTariffPlans, managerOwnsDealer } from "@/lib/data";
import { getStalkerCustomPackagePlanId, listStalkerPackagesForPlan } from "@/lib/repos/stalkerUserPackages";
import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/admin/PageHeader";
import { Panel } from "@/components/admin/Panel";
import { OperatorNewEndUserForm } from "@/components/portal/OperatorNewEndUserForm";
import { createManagerDealerEndUserAction } from "@/actions/forms";
import { buttonOutlineLinkClassName } from "@/components/ui/button";
import { FlashToastsBoundary } from "@/components/FlashToasts";
import { newEndUserCreationFlashItems } from "@/lib/urlFlashToasts";

type Props = {
  params: Promise<{ username: string }>;
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

export default async function ManagerDealerNewUserPage({ params, searchParams }: Props) {
  const s = await getSession();
  if (!s || s.type !== "MNGR") redirect("/login?error=forbidden");

  const { username: raw } = await params;
  const dealerLogin = decodeURIComponent(raw);
  if (!(await managerOwnsDealer(s.username, dealerLogin))) {
    redirect("/manager/dealers?error=forbidden");
  }

  const sp = (await searchParams) ?? {};
  const newUserFlashes = newEndUserCreationFlashItems(sp, "manager_dealer_nested");

  const usersListPath = `/manager/dealers/${encodeURIComponent(dealerLogin)}/users`;

  const [cfg, tariffs, customPlanId] = await Promise.all([
    getDeductionsConfig(),
    listStalkerTariffPlans(),
    getStalkerCustomPackagePlanId(),
  ]);
  const addonPackages =
    customPlanId != null && Number.isFinite(customPlanId) && customPlanId > 0
      ? await listStalkerPackagesForPlan(customPlanId)
      : [];
  const validityOptions = buildValidityOptions(cfg.monthFree);
  const panelClass =
    "overflow-hidden rounded-2xl border-border/60 bg-card/95 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]";

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      <PageHeader
        title="Add subscriber"
        breadcrumb={
          <nav className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5" aria-label="Breadcrumb">
            <Link href="/manager/dealers" className="text-primary hover:underline">
              Dealers
            </Link>
            <span aria-hidden className="text-border">
              /
            </span>
            <Link href={usersListPath} className="text-primary hover:underline">
              {dealerLogin}
            </Link>
            <span aria-hidden className="text-border">
              /
            </span>
            <span className="font-medium text-foreground">New</span>
          </nav>
        }
        showBack={false}
        actions={
          <Link href={usersListPath} className={buttonOutlineLinkClassName("bg-card shadow-sm")}>
            Back to list
          </Link>
        }
      />
      {newUserFlashes.length ? (
        <FlashToastsBoundary items={newUserFlashes} stripParams={["error", "bal", "req"]} />
      ) : null}
      <Panel title="New account" className={panelClass}>
        <OperatorNewEndUserForm
          formAction={createManagerDealerEndUserAction}
          cancelHref={usersListPath}
          idPrefix={`mgr-dlr-${dealerLogin.replace(/[^a-zA-Z0-9_-]/g, "")}`}
          validityOptions={validityOptions}
          tariffs={tariffs}
          customPlanId={customPlanId}
          addonPackages={addonPackages}
          showStatus
          ownedByDealer={dealerLogin}
        />
      </Panel>
    </div>
  );
}

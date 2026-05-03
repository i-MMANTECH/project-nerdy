import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getUserById,
  listResellersForSelect,
  listDealersForReseller,
  listStalkerTariffPlans,
} from "@/lib/data";
import { PageHeader } from "@/components/admin/PageHeader";
import { Panel } from "@/components/admin/Panel";
import { saveUserAction, sendUserMessageAction } from "@/actions/forms";
import { EditUserHierarchyFields } from "./EditUserHierarchyFields";
import { EndUserTransactionsTable } from "@/components/admin/EndUserTransactionsTable";
import { RenewRecoverCreditsForm } from "@/components/admin/RenewRecoverCreditsForm";
import { StbInfoSummary } from "@/components/admin/StbInfoSummary";
import { ResetStalkerDeviceBindingsForm } from "@/components/admin/ResetStalkerDeviceBindingsForm";
import { AdminDeleteEndUserAccountForm } from "@/components/admin/AdminDeleteEndUserAccountForm";
import { isBillingAccountExpired } from "@/lib/billingAccountExpiry";
import { FlashToastsBoundary } from "@/components/FlashToasts";
import { MacAddressInput } from "@/components/forms/MacAddressInput";
import { adminUserDetailFlashItems } from "@/lib/adminInlineFlashToasts";
import { Button, buttonOutlineLinkClassName } from "@/components/ui/button";
import { UserStatusFormSelect } from "@/components/admin/UserStatusFormSelect";

const formControlClass =
  "w-full rounded-lg border border-border/80 bg-background/80 px-3 py-2 text-sm text-foreground shadow-sm outline-none ring-offset-background transition-[border-color,box-shadow] focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ ok?: string; error?: string; bal?: string; req?: string; renew_acc?: string; max?: string }>;
};

export default async function EditUserPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const account = decodeURIComponent(id);
  const u = await getUserById(account);
  if (!u) notFound();

  let resellers = await listResellersForSelect();
  if (u.reseller && !resellers.some((r) => r.username === u.reseller)) {
    resellers = [{ username: u.reseller, name: u.reseller }, ...resellers];
  }
  const [tariffs, initialDealers] = await Promise.all([
    listStalkerTariffPlans(),
    u.reseller ? listDealersForReseller(u.reseller) : Promise.resolve([]),
  ]);

  const subscriptionExpired = isBillingAccountExpired(u.stb.expiry === "—" ? null : u.stb.expiry);
  const userFlashes = adminUserDetailFlashItems(sp);

  const asideCardClass =
    "overflow-hidden rounded-2xl border-border/60 bg-card/95 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_min(360px,100%)] lg:gap-8">
      <div>
        <PageHeader
          title="Edit user"
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
              <span className="text-foreground">{u.username}</span>
            </>
          }
        />
        {userFlashes.length ? (
          <FlashToastsBoundary
            items={userFlashes}
            stripParams={["ok", "error", "bal", "req", "renew_acc", "max"]}
          />
        ) : null}
        <Panel title="User details" className={asideCardClass}>
          <form action={saveUserAction} className="space-y-8">
            <input type="hidden" name="account" value={u.id} />
            <section>
              <h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Profile</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name" name="name" defaultValue={u.name} className={formControlClass} />
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Username</label>
                  <input
                    readOnly
                    className="w-full cursor-not-allowed rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
                    value={u.username}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Password</label>
                  <input
                    name="password"
                    type="text"
                    defaultValue={u.password}
                    className={`${formControlClass} font-mono`}
                  />
                </div>
                <Field label="MAC Address" name="mac" defaultValue={u.mac} className={formControlClass} />
                <Field label="Phone" name="phone" defaultValue={u.phone} className={formControlClass} />
              </div>
            </section>
            <section className="border-t border-border/60 pt-6">
              <h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Subscription & ownership</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="edit-user-status" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Status
                  </label>
                  <UserStatusFormSelect
                    id="edit-user-status"
                    name="status"
                    defaultValue={String(u.statusCode)}
                    className={`${formControlClass} h-10`}
                  />
                </div>
                <EditUserHierarchyFields
                  initialReseller={u.reseller}
                  initialDealer={u.dealer}
                  resellers={resellers}
                  initialDealers={initialDealers}
                  tariffs={tariffs}
                  initialTariffPlanId={u.tariffPlanId}
                  initialParentPin={u.parentPin}
                  customPackagePlanId={u.customPackagePlanId}
                  addonPackages={u.addonPackages}
                  subscribedPackageIds={u.subscribedPackageIds}
                />
              </div>
            </section>
            <section className="border-t border-border/60 pt-6">
              <h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Notes</h3>
              <label className="sr-only" htmlFor="subscriber-note">
                Comments
              </label>
              <textarea
                id="subscriber-note"
                name="note"
                rows={3}
                defaultValue={u.comments}
                className={formControlClass}
                placeholder="Internal comments…"
              />
            </section>
            <div className="flex flex-col-reverse gap-2 border-t border-border/60 pt-5 sm:flex-row sm:justify-end sm:gap-3">
              <Link href="/admin/users" className={buttonOutlineLinkClassName("min-h-11 w-full sm:w-auto")}>
                Cancel
              </Link>
              <Button type="submit" className="min-h-11 w-full font-semibold sm:w-auto">
                Save changes
              </Button>
            </div>
          </form>
        </Panel>
      </div>
      <aside className="space-y-4 lg:space-y-5">
        <StbInfoSummary u={{ id: u.id, packageLabel: u.packageLabel, parentPin: u.parentPin, stb: u.stb }}>
          <details className="group rounded-xl border border-border/50 bg-muted/10 open:bg-muted/15">
            <summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                <span className="text-primary" aria-hidden>
                  ⓘ
                </span>
                What “Reset STB / tokens” does
              </span>
            </summary>
            <div className="border-t border-border/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
              Clears Stalker fields <code className="rounded bg-muted/80 px-1 py-0.5 font-mono text-[11px]">device_id</code>,{" "}
              <code className="rounded bg-muted/80 px-1 py-0.5 font-mono text-[11px]">device_id2</code>, and{" "}
              <code className="rounded bg-muted/80 px-1 py-0.5 font-mono text-[11px]">access_token</code> on the{" "}
              <code className="rounded bg-muted/80 px-1 py-0.5 font-mono text-[11px]">users</code> row for this login (same as PHP{" "}
              <span className="font-mono text-foreground/80">Users::reset</span>).
            </div>
          </details>
          <ResetStalkerDeviceBindingsForm
            account={u.id}
            redirectPath={`/admin/users/${encodeURIComponent(u.id)}`}
            label="Reset STB / tokens"
            fullWidth
          />
        </StbInfoSummary>
        <details className={`group overflow-hidden ${asideCardClass}`}>
          <summary className="cursor-pointer list-none border-b border-border/80 bg-muted/10 px-4 py-3 transition-colors hover:bg-muted/20 sm:px-5 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Transaction history
              </span>
              <span className="rounded-full bg-muted/80 px-2 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-foreground">
                {u.transactions.length}
              </span>
            </span>
            <span className="mt-1 block text-[11px] text-muted-foreground group-open:hidden">
              Expand for the full billing ledger on this account.
            </span>
          </summary>
          <div className="border-t border-border/60 p-4 sm:p-5">
            <EndUserTransactionsTable rows={u.transactions} compact />
          </div>
        </details>
        <Panel title="Credits" subtleHeader className={asideCardClass}>
          <details className="mb-3 rounded-lg border border-border/40 bg-muted/10 text-xs open:border-primary/20">
            <summary className="cursor-pointer list-none px-3 py-2 font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
              How renew / recover maps to PHP
            </summary>
            <div className="border-t border-border/40 px-3 py-2 leading-relaxed text-muted-foreground">
              <span className="font-mono text-foreground/90">RENEW</span> uses validity (<span className="font-mono">FREE_TRIAL</span> or months; owner debit + Stalker{" "}
              <code className="rounded bg-muted/80 px-1 py-0.5 font-mono text-[11px]">cut_on</code> for paid months).{" "}
              <span className="font-mono text-foreground/90">RECOVER</span> returns credits (capped by{" "}
              <code className="rounded bg-muted/80 px-1 py-0.5 font-mono text-[11px]">max_credit_recoverable</code>).
            </div>
          </details>
          <RenewRecoverCreditsForm account={u.id} cancelHref="/admin/users" />
        </Panel>
        <Panel title="Send message" subtleHeader className={asideCardClass}>
          <p className="mb-3 text-xs text-muted-foreground">Queued to the device via the Stalker events table.</p>
          <form action={sendUserMessageAction} className="space-y-3">
            <input type="hidden" name="account" value={u.id} />
            <textarea
              name="message"
              rows={4}
              placeholder="Type your message…"
              className={formControlClass}
            />
            <Button type="submit" size="sm" className="font-semibold">
              Send to device
            </Button>
          </form>
          {u.messageEvents.length > 0 ? (
            <div className="mt-4 border-t border-border/60 pt-4">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Recent events</h3>
              <ul className="thin-scrollbar mt-2 max-h-52 space-y-2 overflow-y-auto text-xs text-foreground">
                {u.messageEvents.map((ev, idx) => (
                  <li
                    key={ev.id > 0 ? String(ev.id) : `ev-${idx}-${ev.addtime ?? ""}`}
                    className="rounded-lg border border-border/50 bg-muted/20 px-2.5 py-2"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-1">
                      <span className="font-mono font-semibold text-foreground">{ev.event}</span>
                      <span className="text-muted-foreground">{ev.addtime ? String(ev.addtime).slice(0, 19) : "—"}</span>
                    </div>
                    {ev.msg ? <p className="mt-1 break-words text-muted-foreground">{ev.msg.length > 200 ? `${ev.msg.slice(0, 200)}…` : ev.msg}</p> : null}
                    {ev.need_confirm != null ? (
                      <p className="mt-0.5 text-muted-foreground">Confirm: {ev.need_confirm === 1 ? "yes" : "no"}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : u.stalkerUserId ? (
            <p className="mt-4 border-t border-border/60 pt-4 text-xs text-muted-foreground">No events in Stalker for this user yet.</p>
          ) : (
            <p className="mt-4 border-t border-border/60 pt-4 text-xs text-muted-foreground">No Stalker user for this login — events list unavailable.</p>
          )}
        </Panel>
        <Panel title="Danger zone" subtleHeader className={asideCardClass}>
          <details className="mb-3 rounded-lg border border-destructive/20 bg-destructive/5 text-xs">
            <summary className="cursor-pointer list-none px-3 py-2 font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
              What delete does (PHP parity)
            </summary>
            <div className="border-t border-border/40 px-3 py-2 leading-relaxed text-muted-foreground">
              Removes the Stalker <span className="font-mono text-foreground/80">users</span> row, then the billing <span className="font-mono text-foreground/80">accounts</span> row.
              Active subscriptions require the same extra confirmation as the legacy list.
            </div>
          </details>
          <AdminDeleteEndUserAccountForm account={u.id} redirectPath="/admin/users" subscriptionExpired={subscriptionExpired} />
        </Panel>
      </aside>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  className = formControlClass,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  className?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</label>
      {name === "mac" ? (
        <MacAddressInput name={name} defaultValue={defaultValue} className={`${className} font-mono uppercase`} />
      ) : (
        <input name={name} type={type} defaultValue={defaultValue} className={className} />
      )}
    </div>
  );
}

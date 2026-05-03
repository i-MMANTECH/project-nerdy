"use client";

import Link from "next/link";
import { Panel } from "@/components/admin/Panel";
import { StbInfoSummary } from "@/components/admin/StbInfoSummary";
import { EndUserTransactionsTable } from "@/components/admin/EndUserTransactionsTable";
import { RenewRecoverCreditsForm } from "@/components/admin/RenewRecoverCreditsForm";
import { AdminDeleteEndUserAccountForm } from "@/components/admin/AdminDeleteEndUserAccountForm";
import { ResetStalkerDeviceBindingsForm } from "@/components/admin/ResetStalkerDeviceBindingsForm";
import { OperatorQuickOneMonthRenewForm } from "@/components/portal/OperatorQuickOneMonthRenewForm";
import {
  deleteOperatorEndUserAccountAction,
  renewOperatorUserAction,
  resetOperatorEndUserStalkerDevicesAction,
  setManagerUserStatusQuickAction,
  saveOperatorUserAction,
  sendUserMessageAction,
} from "@/actions/forms";
import { isBillingAccountExpired } from "@/lib/billingAccountExpiry";
import { FormSelect } from "@/components/forms/form-select";
import { MacAddressInput } from "@/components/forms/MacAddressInput";
import { Button, buttonOutlineLinkClassName } from "@/components/ui/button";
import { InlineConfirmAction } from "@/components/ui/InlineConfirmAction";

const END_USER_STATUS_OPTIONS = [
  { value: "0", label: "ACTIVE" },
  { value: "1", label: "INACTIVE" },
];

type OperatorUser = {
  id: string;
  name: string;
  username: string;
  password: string;
  mac: string;
  phone: string;
  statusCode: number;
  comments: string;
  packageLabel: string;
  parentPin: string;
  stb: { online: boolean; ip: string; firmware: string; expiry: string; watching: string };
  messageEvents: { id: number; event: string; msg: string | null; addtime: string | null; need_confirm: number | null }[];
  transactions: import("@/lib/repos/billing").AccountTransactionRow[];
};

export function OperatorUserEditPage({
  u,
  portalBase,
  portalRole,
  detailReturnPath,
  usersListReturnPath,
}: {
  u: OperatorUser;
  portalBase: "/manager" | "/reseller" | "/dealer";
  portalRole: "MNGR" | "SRSLR" | "RSLR";
  /** Return URL for +1 / reset flashes (this page). */
  detailReturnPath: string;
  /** After delete, redirect to users list (PHP `redirect('…/users')`). */
  usersListReturnPath: string;
}) {
  const subscriptionExpired = isBillingAccountExpired(u.stb.expiry === "—" ? null : u.stb.expiry);
  const showDeleteButton = portalRole === "MNGR" || subscriptionExpired;
  const managerCanToggle = portalRole === "MNGR" && !subscriptionExpired;
  const txnAsideClass =
    "overflow-hidden rounded-2xl border border-border/60 bg-card/95 text-card-foreground shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div>
        <Panel title="Edit user">
          <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-border pb-4 text-sm">
            <span className="mr-1 text-muted-foreground">Quick:</span>
            <OperatorQuickOneMonthRenewForm account={u.id} redirectPath={detailReturnPath} />
            <ResetStalkerDeviceBindingsForm
              account={u.id}
              redirectPath={detailReturnPath}
              label="Reset devices"
              action={resetOperatorEndUserStalkerDevicesAction}
            />
            {portalRole === "MNGR" ? (
              <>
                <InlineConfirmAction
                  action={setManagerUserStatusQuickAction}
                  title="Activate STB?"
                  description="Set this STB box to ACTIVE?"
                  confirmLabel="Activate"
                  confirmVariant="default"
                  className="inline"
                  trigger={(onOpen) => (
                    <button
                      type="button"
                      disabled={!managerCanToggle || u.statusCode === 0}
                      className="rounded border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                      title={subscriptionExpired ? "You can't activate expired box" : undefined}
                      onClick={onOpen}
                    >
                      Activate
                    </button>
                  )}
                >
                  <input type="hidden" name="account" value={u.id} />
                  <input type="hidden" name="redirect" value={detailReturnPath} />
                  <input type="hidden" name="mode" value="activate" />
                </InlineConfirmAction>
                <InlineConfirmAction
                  action={setManagerUserStatusQuickAction}
                  title="Block STB?"
                  description="Set this STB box to INACTIVE?"
                  confirmLabel="Block"
                  className="inline"
                  trigger={(onOpen) => (
                    <button
                      type="button"
                      disabled={!managerCanToggle || u.statusCode === 1}
                      className="rounded border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-50"
                      title={subscriptionExpired ? "You can't change expired box" : undefined}
                      onClick={onOpen}
                    >
                      Block
                    </button>
                  )}
                >
                  <input type="hidden" name="account" value={u.id} />
                  <input type="hidden" name="redirect" value={detailReturnPath} />
                  <input type="hidden" name="mode" value="block" />
                </InlineConfirmAction>
              </>
            ) : null}
            {showDeleteButton ? (
              <AdminDeleteEndUserAccountForm
                account={u.id}
                redirectPath={usersListReturnPath}
                subscriptionExpired={subscriptionExpired}
                compact
                action={deleteOperatorEndUserAccountAction}
                buttonLabel="Delete account"
              />
            ) : (
              <span
                className="inline-block rounded border border-border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
                title="You can't delete active user account"
              >
                Delete account
              </span>
            )}
          </div>
          <form action={saveOperatorUserAction} className="space-y-4">
            <input type="hidden" name="account" value={u.id} />
            <input type="hidden" name="redirect" value={usersListReturnPath} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" name="name" defaultValue={u.name} />
              <div>
                <label className="mb-1 block text-sm font-semibold text-foreground">Username</label>
                <input
                  readOnly
                  className="w-full cursor-not-allowed rounded border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
                  value={u.username}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-foreground">Password</label>
                <input
                  name="password"
                  type="text"
                  defaultValue={u.password}
                  className="w-full rounded border border-input bg-muted/50 px-3 py-2 font-mono text-sm"
                />
              </div>
              <Field label="MAC Address" name="mac" defaultValue={u.mac} />
              <Field label="Phone" name="phone" defaultValue={u.phone} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-foreground">Status</label>
              <FormSelect
                name="status"
                defaultValue={String(u.statusCode)}
                options={END_USER_STATUS_OPTIONS}
                className="border-input bg-muted/50"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-foreground">Comments</label>
              <textarea name="note" rows={3} defaultValue={u.comments} className="w-full rounded border border-input bg-muted/50 px-3 py-2" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit">Submit</Button>
              <Link href={usersListReturnPath} className={buttonOutlineLinkClassName("bg-card shadow-sm")}>
                Cancel
              </Link>
            </div>
          </form>
        </Panel>
      </div>
      <aside className="space-y-4">
        <StbInfoSummary u={{ id: u.id, packageLabel: u.packageLabel, parentPin: u.parentPin, stb: u.stb }} />
        <Panel title="Renew / recover">
          <RenewRecoverCreditsForm
            account={u.id}
            action={renewOperatorUserAction}
            cancelHref={usersListReturnPath}
            listRevalidatePath={usersListReturnPath}
          />
        </Panel>
        <Panel title="Send Message">
          <form action={sendUserMessageAction} className="space-y-2">
            <input type="hidden" name="account" value={u.id} />
            <textarea
              name="message"
              rows={4}
              placeholder="Type Your Message"
              className="w-full rounded border border-input bg-muted/50 px-3 py-2 text-sm"
            />
            <Button type="submit" size="sm">
              Send
            </Button>
          </form>
          {u.messageEvents.length > 0 ? (
            <div className="mt-4 border-t border-border pt-3">
              <h3 className="text-xs font-semibold text-foreground">Recent events</h3>
              <ul className="mt-2 max-h-52 space-y-2 overflow-y-auto text-xs text-foreground">
                {u.messageEvents.map((ev, idx) => (
                  <li key={ev.id > 0 ? String(ev.id) : `ev-${idx}-${ev.addtime ?? ""}`} className="rounded border border-border bg-muted/50 px-2 py-1.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-1">
                      <span className="font-mono font-semibold text-foreground">{ev.event}</span>
                      <span className="text-muted-foreground">{ev.addtime ? String(ev.addtime).slice(0, 19) : "—"}</span>
                    </div>
                    {ev.msg ? <p className="mt-1 break-words text-muted-foreground">{ev.msg.length > 200 ? `${ev.msg.slice(0, 200)}…` : ev.msg}</p> : null}
                    {ev.need_confirm != null ? <p className="mt-0.5 text-muted-foreground">Confirm: {ev.need_confirm === 1 ? "yes" : "no"}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>
        <details className={`group ${txnAsideClass}`}>
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
      </aside>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-foreground">{label}</label>
      {name === "mac" ? (
        <MacAddressInput
          name={name}
          defaultValue={defaultValue}
          className="w-full rounded border border-input bg-muted/50 px-3 py-2 font-mono text-sm uppercase"
        />
      ) : (
        <input name={name} type={type} defaultValue={defaultValue} className="w-full rounded border border-input bg-muted/50 px-3 py-2 text-sm" />
      )}
    </div>
  );
}


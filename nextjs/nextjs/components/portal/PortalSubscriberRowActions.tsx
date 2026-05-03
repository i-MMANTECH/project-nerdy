"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Mail, MoreVertical, Pencil } from "lucide-react";
import { FloatingMenuPortal } from "@/components/ui/FloatingMenuPortal";
import { ResetStalkerDeviceBindingsForm } from "@/components/admin/ResetStalkerDeviceBindingsForm";
import { AdminDeleteEndUserAccountForm } from "@/components/admin/AdminDeleteEndUserAccountForm";
import { OperatorQuickOneMonthRenewForm } from "@/components/portal/OperatorQuickOneMonthRenewForm";
import {
  deleteOperatorEndUserAccountAction,
  resetOperatorEndUserStalkerDevicesAction,
  setManagerUserStatusQuickAction,
  setResellerEndUserStatusQuickAction,
} from "@/actions/forms";
import { InlineConfirmAction } from "@/components/ui/InlineConfirmAction";

type PortalBase = "/manager" | "/reseller" | "/dealer";
type Variant = "manager" | "reseller" | "dealer";

/** Row ⋮ menu aligned with `AdminSubscriberRowActions` (Root), using portal routes and actions. */
export function PortalSubscriberRowActions({
  account,
  portalBase,
  listReturnPath,
  subscriptionExpired,
  variant,
  rowStatus,
  expired,
  resellerStatusQuickActions,
}: {
  account: string;
  portalBase: PortalBase;
  listReturnPath: string;
  subscriptionExpired: boolean;
  variant: Variant;
  rowStatus: number;
  expired: boolean;
  resellerStatusQuickActions: boolean;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  const editHref = `${portalBase}/users/${encodeURIComponent(account)}?list=${encodeURIComponent(listReturnPath)}`;
  const managerCanToggle = variant === "manager" && !expired;
  const resellerCanToggle = variant === "reseller" && resellerStatusQuickActions && !expired;
  const showDelete = variant === "manager" || subscriptionExpired;

  return (
    <div ref={anchorRef} className="inline-flex justify-center">
      <button
        type="button"
        className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-border/80 bg-card p-1.5 text-foreground/85 shadow-sm transition hover:bg-muted/70 hover:text-foreground dark:bg-muted/30 dark:hover:bg-muted/50"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Actions for ${account}`}
        onClick={() => setOpen((o) => !o)}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      <FloatingMenuPortal open={open} onOpenChange={setOpen} anchorRef={anchorRef}>
        <div onClick={(e) => e.stopPropagation()}>
          <Link
            href={editHref}
            className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted/50"
            onClick={() => setOpen(false)}
          >
            <Pencil className="h-4 w-4 shrink-0 opacity-70" />
            Edit
          </Link>
          <div className="px-3 py-2 hover:bg-muted/50">
            <OperatorQuickOneMonthRenewForm account={account} redirectPath={listReturnPath} buttonLabel="Renew" menuItem />
          </div>
          <Link
            href={`${portalBase}/message?account=${encodeURIComponent(account)}`}
            className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted/50"
            onClick={() => setOpen(false)}
          >
            <Mail className="h-4 w-4 shrink-0 opacity-70" />
            Send message
          </Link>

          {variant === "manager" && !expired ? (
            <div className="border-t border-border/50 px-3 py-2">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
              <div className="flex flex-col gap-1">
                <InlineConfirmAction
                  action={setManagerUserStatusQuickAction}
                  title="Activate STB?"
                  description="Set this STB box to ACTIVE?"
                  confirmLabel="Activate"
                  confirmVariant="default"
                  className="block w-full"
                  onPanelOpenChange={(o) => o && setOpen(false)}
                  trigger={(onOpen) => (
                    <button
                      type="button"
                      disabled={!managerCanToggle || rowStatus === 0}
                      className="w-full rounded-md border border-primary/30 bg-primary/5 px-2 py-1.5 text-left text-xs font-medium text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={onOpen}
                    >
                      Activate
                    </button>
                  )}
                >
                  <input type="hidden" name="account" value={account} />
                  <input type="hidden" name="redirect" value={listReturnPath} />
                  <input type="hidden" name="mode" value="activate" />
                </InlineConfirmAction>
                <InlineConfirmAction
                  action={setManagerUserStatusQuickAction}
                  title="Deactivate STB?"
                  description="Set this STB box to INACTIVE?"
                  confirmLabel="Deactivate"
                  className="block w-full"
                  onPanelOpenChange={(o) => o && setOpen(false)}
                  trigger={(onOpen) => (
                    <button
                      type="button"
                      disabled={!managerCanToggle || rowStatus === 1}
                      className="w-full rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-left text-xs font-medium text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={onOpen}
                    >
                      Deactivate
                    </button>
                  )}
                >
                  <input type="hidden" name="account" value={account} />
                  <input type="hidden" name="redirect" value={listReturnPath} />
                  <input type="hidden" name="mode" value="block" />
                </InlineConfirmAction>
              </div>
            </div>
          ) : null}

          {resellerCanToggle ? (
            <div className="border-t border-border/50 px-3 py-2">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">STB</p>
              <div className="flex flex-col gap-1">
                <InlineConfirmAction
                  action={setResellerEndUserStatusQuickAction}
                  title="Turn STB on?"
                  description="Set this STB box to ACTIVE?"
                  confirmLabel="On"
                  confirmVariant="default"
                  className="block w-full"
                  onPanelOpenChange={(o) => o && setOpen(false)}
                  trigger={(onOpen) => (
                    <button
                      type="button"
                      disabled={rowStatus === 0}
                      className="w-full rounded-md border border-primary/30 bg-primary/5 px-2 py-1.5 text-left text-xs font-medium text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={onOpen}
                    >
                      On
                    </button>
                  )}
                >
                  <input type="hidden" name="account" value={account} />
                  <input type="hidden" name="redirect" value={listReturnPath} />
                  <input type="hidden" name="mode" value="activate" />
                </InlineConfirmAction>
                <InlineConfirmAction
                  action={setResellerEndUserStatusQuickAction}
                  title="Turn STB off?"
                  description="Set this STB box to INACTIVE?"
                  confirmLabel="Off"
                  className="block w-full"
                  onPanelOpenChange={(o) => o && setOpen(false)}
                  trigger={(onOpen) => (
                    <button
                      type="button"
                      disabled={rowStatus === 1}
                      className="w-full rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-left text-xs font-medium text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={onOpen}
                    >
                      Off
                    </button>
                  )}
                >
                  <input type="hidden" name="account" value={account} />
                  <input type="hidden" name="redirect" value={listReturnPath} />
                  <input type="hidden" name="mode" value="block" />
                </InlineConfirmAction>
              </div>
            </div>
          ) : null}

          <div className="border-t border-border/50">
            <ResetStalkerDeviceBindingsForm
              account={account}
              redirectPath={listReturnPath}
              label="Reset device"
              action={resetOperatorEndUserStalkerDevicesAction}
              menuItem
              onPanelOpenChange={(o) => o && setOpen(false)}
            />
          </div>

          {showDelete ? (
            <div className="border-t border-border/50">
              <AdminDeleteEndUserAccountForm
                account={account}
                redirectPath={listReturnPath}
                subscriptionExpired={subscriptionExpired}
                compact
                menuItem
                action={deleteOperatorEndUserAccountAction}
                buttonLabel="Delete"
                onPanelOpenChange={(o) => o && setOpen(false)}
              />
            </div>
          ) : null}
        </div>
      </FloatingMenuPortal>
    </div>
  );
}

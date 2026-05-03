"use client";

import { Trash2 } from "lucide-react";
import { deleteAdminEndUserAccountAction } from "@/actions/forms";
import { Button } from "@/components/ui/button";
import { InlineConfirmAction } from "@/components/ui/InlineConfirmAction";
import { cn } from "@/lib/cn";

const MSG_ACTIVE =
  "This account is still active. Do you really want to delete this user account?";
const MSG_EXPIRED = "Permanently delete this user account (billing + Stalker)? This cannot be undone.";

export function AdminDeleteEndUserAccountForm({
  account,
  redirectPath,
  subscriptionExpired,
  compact,
  menuItem = false,
  action = deleteAdminEndUserAccountAction,
  buttonLabel,
  onPanelOpenChange,
}: {
  account: string;
  redirectPath: string;
  subscriptionExpired: boolean;
  /** Table row: small destructive button. */
  compact?: boolean;
  /** Row ⋮ menu: icon + label (use with `compact`). */
  menuItem?: boolean;
  action?: typeof deleteAdminEndUserAccountAction;
  buttonLabel?: string;
  onPanelOpenChange?: (open: boolean) => void;
}) {
  const description = subscriptionExpired ? MSG_EXPIRED : MSG_ACTIVE;
  const label = buttonLabel ?? "Delete";
  return (
    <InlineConfirmAction
      action={action}
      title="Delete user account?"
      description={description}
      confirmLabel="Delete"
      panelStyle="smooth"
      className={cn(menuItem ? "block w-full" : compact ? "inline" : "block")}
      onPanelOpenChange={onPanelOpenChange}
      trigger={(onOpen) =>
        menuItem ? (
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            onClick={onOpen}
          >
            <Trash2 className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            {label}
          </button>
        ) : (
          <Button
            type="button"
            variant="destructive"
            size={compact ? "sm" : "default"}
            className={cn(compact && "px-2 text-xs")}
            onClick={onOpen}
          >
            {label}
          </Button>
        )
      }
    >
      <input type="hidden" name="account" value={account} />
      <input type="hidden" name="redirect" value={redirectPath} />
    </InlineConfirmAction>
  );
}

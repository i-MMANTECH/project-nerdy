"use client";

import { renewAdminUserQuickOneMonthAction } from "@/actions/forms";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/** PHP list `+1` / `renewOneMonth` — one paid month (`validity` = 1), credits debited from account owner. */
export function AdminQuickOneMonthRenewForm({
  account,
  redirectPath,
  buttonLabel = "+1",
  menuItem = false,
}: {
  account: string;
  redirectPath: string;
  /** Shown on the submit control (e.g. row actions menu). */
  buttonLabel?: string;
  /** Full-width row in ⋮ menus (matches portal renew row). */
  menuItem?: boolean;
}) {
  return (
    <form action={renewAdminUserQuickOneMonthAction} className={cn(menuItem ? "block w-full" : "inline")}>
      <input type="hidden" name="account" value={account} />
      <input type="hidden" name="redirect" value={redirectPath} />
      <Button
        type="submit"
        size="sm"
        variant="secondary"
        title="Add 1 month (PHP renewOneMonth / validity=1)"
        className={cn("px-2 text-xs", menuItem && "h-9 w-full justify-start")}
      >
        {buttonLabel}
      </Button>
    </form>
  );
}

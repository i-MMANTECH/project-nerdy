"use client";

import { renewOperatorUserQuickOneMonthAction } from "@/actions/forms";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/** PHP portal user list `+1` / `renewOneMonth` — one month, credits debited from logged-in operator. */
export function OperatorQuickOneMonthRenewForm({
  account,
  redirectPath,
  buttonLabel = "+1",
  /** Full-width control for row actions menu (matches admin renew row). */
  menuItem = false,
}: {
  account: string;
  redirectPath: string;
  buttonLabel?: string;
  menuItem?: boolean;
}) {
  return (
    <form action={renewOperatorUserQuickOneMonthAction} className={cn(menuItem && "block w-full")}>
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

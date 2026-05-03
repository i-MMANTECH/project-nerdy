"use client";

import { RotateCcw } from "lucide-react";
import { resetAdminEndUserStalkerDevicesAction, resetOperatorEndUserStalkerDevicesAction } from "@/actions/forms";
import { Button } from "@/components/ui/button";
import { InlineConfirmAction } from "@/components/ui/InlineConfirmAction";
import { cn } from "@/lib/cn";

const MSG = "Clear Stalker device bindings for this account?";

export function ResetStalkerDeviceBindingsForm({
  account,
  redirectPath,
  label,
  className,
  fullWidth,
  menuItem = false,
  action = resetAdminEndUserStalkerDevicesAction,
  onPanelOpenChange,
}: {
  account: string;
  redirectPath: string;
  label: string;
  className?: string;
  /** Wide layout for subscriber edit sidebar. */
  fullWidth?: boolean;
  /** Row ⋮ menu: full-width control aligned with other items. */
  menuItem?: boolean;
  action?: typeof resetAdminEndUserStalkerDevicesAction | typeof resetOperatorEndUserStalkerDevicesAction;
  onPanelOpenChange?: (open: boolean) => void;
}) {
  const wide = Boolean(fullWidth);

  return (
    <InlineConfirmAction
      action={action}
      title="Confirm Stalker reset"
      description={MSG}
      confirmLabel="Confirm reset"
      cancelLabel="Cancel"
      confirmVariant="destructive"
      panelStyle="smooth"
      className={cn(menuItem ? "block w-full" : wide ? "block w-full max-w-full" : "inline", className)}
      onPanelOpenChange={onPanelOpenChange}
      trigger={(onOpen) =>
        menuItem ? (
          <button
            type="button"
            role="menuitem"
            className="flex h-9 w-full items-center gap-2 px-3 text-left text-sm font-medium text-foreground transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            onClick={onOpen}
          >
            <RotateCcw className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
            {label}
          </button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              wide ? "h-10 w-full rounded-lg border-primary/25 bg-primary/5 text-sm font-semibold text-primary hover:bg-primary/10" : "px-2",
            )}
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

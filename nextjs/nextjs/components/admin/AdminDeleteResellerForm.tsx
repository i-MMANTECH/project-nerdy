"use client";

import type { RefObject } from "react";
import { Trash2 } from "lucide-react";
import { deleteAdminResellerAction } from "@/actions/forms";
import { Button } from "@/components/ui/button";
import { InlineConfirmAction } from "@/components/ui/InlineConfirmAction";
import { cn } from "@/lib/cn";

export function AdminDeleteResellerForm({
  username,
  canDelete,
  redirectPath,
  buttonLabel = "Del",
  className,
  menuItem = false,
  onPanelOpenChange,
  defaultConfirmOpen = false,
  positionAnchorRef,
}: {
  username: string;
  canDelete: boolean;
  redirectPath: string;
  buttonLabel?: string;
  className?: string;
  menuItem?: boolean;
  onPanelOpenChange?: (open: boolean) => void;
  defaultConfirmOpen?: boolean;
  positionAnchorRef?: RefObject<HTMLElement | null>;
}) {
  if (!canDelete) {
    return (
      <span
        className={cn(
          "inline-flex cursor-not-allowed items-center justify-center rounded-md border border-border bg-muted px-2 py-1.5 text-xs font-medium text-muted-foreground",
          menuItem &&
            "w-full justify-start gap-2 border-0 bg-transparent px-3 py-2 text-sm text-muted-foreground opacity-60",
        )}
        title="You can't delete this reseller account"
      >
        {menuItem ? <Trash2 className="h-4 w-4 shrink-0 opacity-50" aria-hidden /> : null}
        {buttonLabel}
      </span>
    );
  }
  const detached = defaultConfirmOpen;
  return (
    <InlineConfirmAction
      action={deleteAdminResellerAction}
      title="Delete reseller account?"
      description="Delete this reseller account? This cannot be undone."
      confirmLabel="OK"
      defaultOpen={detached}
      positionSourceRef={positionAnchorRef}
      className={detached ? "sr-only" : "block w-full"}
      onPanelOpenChange={onPanelOpenChange}
      trigger={(onOpen) =>
        detached ? (
          <span className="sr-only">{buttonLabel}</span>
        ) : menuItem ? (
          <button
            type="button"
            role="menuitem"
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              className,
            )}
            onClick={onOpen}
          >
            <Trash2 className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            {buttonLabel}
          </button>
        ) : (
          <Button type="button" variant="destructive" size="sm" className={className ?? "px-2 text-xs"} onClick={onOpen}>
            {buttonLabel}
          </Button>
        )
      }
    >
      <input type="hidden" name="username" value={username} />
      <input type="hidden" name="redirect" value={redirectPath} />
    </InlineConfirmAction>
  );
}

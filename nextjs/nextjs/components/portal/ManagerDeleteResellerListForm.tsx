"use client";

import { deleteManagerResellerAction } from "@/actions/forms";
import { Button } from "@/components/ui/button";
import { InlineConfirmAction } from "@/components/ui/InlineConfirmAction";

/** PHP `reseller_action_buttons` Del — list row (manager portal). */
export function ManagerDeleteResellerListForm({ username, canDelete }: { username: string; canDelete: boolean }) {
  if (!canDelete) {
    return (
      <span
        className="inline-flex cursor-not-allowed items-center rounded border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
        title="You can't delete this reseller account"
      >
        Del
      </span>
    );
  }
  return (
    <InlineConfirmAction
      action={deleteManagerResellerAction}
      title="Delete reseller account?"
      description="Delete this reseller account? This cannot be undone."
      confirmLabel="Delete"
      className="inline"
      trigger={(onOpen) => (
        <Button type="button" variant="destructive" size="sm" className="px-2 text-xs" onClick={onOpen}>
          Del
        </Button>
      )}
    >
      <input type="hidden" name="username" value={username} />
    </InlineConfirmAction>
  );
}

"use client";

import { deleteResellerDealerAction } from "@/actions/forms";
import { Button } from "@/components/ui/button";
import { InlineConfirmAction } from "@/components/ui/InlineConfirmAction";

/** PHP `dealer_action_buttons` Del on reseller dealers index — disabled when dealer has users. */
export function ResellerDeleteDealerListForm({ username, canDelete }: { username: string; canDelete: boolean }) {
  if (!canDelete) {
    return (
      <span
        className="inline-flex cursor-not-allowed items-center rounded border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
        title="You can't delete this dealer while they have user accounts"
      >
        Del
      </span>
    );
  }
  return (
    <InlineConfirmAction
      action={deleteResellerDealerAction}
      title="Delete dealer account?"
      description="Delete this dealer account? This cannot be undone."
      confirmLabel="Delete"
      className="inline"
      trigger={(onOpen) => (
        <Button type="button" variant="destructive" size="sm" className="px-2 text-xs" onClick={onOpen}>
          Del
        </Button>
      )}
    >
      <input type="hidden" name="_from" value="list" />
      <input type="hidden" name="username" value={username} />
    </InlineConfirmAction>
  );
}

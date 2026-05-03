"use client";

import { deleteResellerDealerExpiredUserAction } from "@/actions/forms";
import { InlineConfirmAction } from "@/components/ui/InlineConfirmAction";

export function DeleteResellerDealerExpiredUserForm({ dealer, account }: { dealer: string; account: string }) {
  return (
    <InlineConfirmAction
      action={deleteResellerDealerExpiredUserAction}
      title="Delete expired account?"
      description={`Delete expired account ${account}?`}
      confirmLabel="Delete"
      className="inline"
      trigger={(onOpen) => (
        <button
          type="button"
          className="rounded border border-neutral-400 bg-muted px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
          onClick={onOpen}
        >
          Delete
        </button>
      )}
    >
      <input type="hidden" name="dealer_username" value={dealer} />
      <input type="hidden" name="account" value={account} />
    </InlineConfirmAction>
  );
}

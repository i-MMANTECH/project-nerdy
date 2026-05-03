"use client";

import { deleteResellerDealerAction } from "@/actions/forms";
import { Button } from "@/components/ui/button";
import { InlineConfirmAction } from "@/components/ui/InlineConfirmAction";

export function DeleteResellerDealerForm({ username }: { username: string }) {
  return (
    <InlineConfirmAction
      action={deleteResellerDealerAction}
      title="Delete dealer?"
      description="Delete this dealer? Only allowed when they have no end-user accounts."
      confirmLabel="Delete dealer"
      trigger={(onOpen) => (
        <Button type="button" variant="destructive" onClick={onOpen}>
          Delete dealer
        </Button>
      )}
    >
      <input type="hidden" name="username" value={username} />
    </InlineConfirmAction>
  );
}

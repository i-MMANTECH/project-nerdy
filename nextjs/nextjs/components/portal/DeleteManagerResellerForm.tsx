"use client";

import { deleteManagerResellerAction } from "@/actions/forms";
import { Button } from "@/components/ui/button";
import { InlineConfirmAction } from "@/components/ui/InlineConfirmAction";

export function DeleteManagerResellerForm({ username }: { username: string }) {
  return (
    <InlineConfirmAction
      action={deleteManagerResellerAction}
      title="Delete reseller?"
      description="Delete this reseller permanently?"
      confirmLabel="Delete reseller"
      trigger={(onOpen) => (
        <Button type="button" variant="destructive" onClick={onOpen}>
          Delete reseller
        </Button>
      )}
    >
      <input type="hidden" name="username" value={username} />
    </InlineConfirmAction>
  );
}

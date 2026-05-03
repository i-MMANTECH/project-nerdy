"use client";

import { deleteTicketAction } from "@/actions/forms";
import { Button } from "@/components/ui/button";
import { InlineConfirmAction } from "@/components/ui/InlineConfirmAction";

type DeleteAction = (formData: FormData) => void | Promise<void>;

export function DeleteTicketForm({ ticketId, subject, action }: { ticketId: number; subject: string; action?: DeleteAction }) {
  const submitAction = action ?? deleteTicketAction;
  return (
    <InlineConfirmAction
      action={submitAction}
      title="Delete ticket?"
      description="Are you sure you want to delete this ticket?"
      confirmLabel="Delete"
      className="inline"
      trigger={(onOpen) => (
        <Button type="button" variant="destructive" onClick={onOpen}>
          Delete
        </Button>
      )}
    >
      <input type="hidden" name="ticket_id" value={ticketId} />
      <input type="hidden" name="subject" value={subject} />
    </InlineConfirmAction>
  );
}

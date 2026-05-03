import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { Panel } from "@/components/admin/Panel";
import { TicketViewHtml } from "@/components/admin/TicketViewHtml";
import { DeleteTicketForm } from "@/components/admin/DeleteTicketForm";
import {
  getTicketById,
  getTicketOwnerUsername,
  listTicketComments,
  listTvGenres,
  priorityLabel,
  statusLabel,
  ticketProblemSummary,
} from "@/lib/repos/tickets";
import {
  addTicketCommentAction,
  markTicketCompleteAction,
  reopenTicketAction,
  updateTicketAdminAction,
} from "@/actions/forms";
import { FormSelect } from "@/components/forms/form-select";
import { TICKET_PRIORITY_OPTIONS, TICKET_STATUS_OPTIONS } from "@/lib/ticketFormSelectOptions";
import { Button, buttonOutlineLinkClassName } from "@/components/ui/button";
import { FlashToastsBoundary } from "@/components/FlashToasts";
import { ticketDetailFlashItems } from "@/lib/urlFlashToasts";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ ok?: string; error?: string }>;
};

function fmtUnix(t: number) {
  if (!t) return "—";
  return new Date(t * 1000).toLocaleString();
}

export default async function TicketDetailPage({ params, searchParams }: Props) {
  const { id: rawId } = await params;
  const id = Number(decodeURIComponent(rawId));
  if (!Number.isFinite(id) || id <= 0) notFound();

  const sp = (await searchParams) ?? {};
  const ticket = await getTicketById(id);
  if (!ticket) notFound();

  const comments = await listTicketComments(id);
  const commentsWithAuthors = await Promise.all(
    comments.map(async (c) => ({
      ...c,
      author: await getTicketOwnerUsername(c.user_id),
    })),
  );
  const ownerName = await getTicketOwnerUsername(ticket.user_id);
  const genres = await listTvGenres();
  const categoryTitle = genres.find((g) => g.id === ticket.category_id)?.title ?? "—";

  const ticketFlashes = ticketDetailFlashItems(sp);

  return (
    <div>
      <PageHeader
        title={`Tickets — ${ticket.subject}`}
        breadcrumb={`Home › Tickets › #${ticket.id}`}
        showBack={false}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/tickets/dashboard" className={buttonOutlineLinkClassName("bg-card shadow-sm")}>
              Dashboard
            </Link>
            <Link href="/admin/tickets" className={buttonOutlineLinkClassName("bg-muted/40 shadow-sm hover:bg-muted")}>
              Back to list
            </Link>
          </div>
        }
      />
      {ticketFlashes.length ? <FlashToastsBoundary items={ticketFlashes} stripParams={["ok", "error"]} /> : null}

      <Panel>
        <div className="mb-4 flex flex-wrap gap-2">
          {ticket.status_id === 2 ? (
            <form action={reopenTicketAction} className="inline">
              <input type="hidden" name="ticket_id" value={ticket.id} />
              <input type="hidden" name="subject" value={ticket.subject} />
              <Button type="submit">Reopen ticket</Button>
            </form>
          ) : (
            <form action={markTicketCompleteAction} className="inline">
              <input type="hidden" name="ticket_id" value={ticket.id} />
              <Button type="submit">Mark complete</Button>
            </form>
          )}
          <details id="edit-ticket" className="inline-block rounded-md border border-input bg-card shadow-sm">
            <summary className="inline-flex min-h-10 cursor-pointer list-none items-center px-4 text-sm font-medium text-foreground antialiased hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
              Edit priority &amp; status
            </summary>
            <form action={updateTicketAdminAction} className="space-y-3 border-t border-border p-3">
              <input type="hidden" name="ticket_id" value={ticket.id} />
              <input type="hidden" name="subject" value={ticket.subject} />
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Priority</label>
                <FormSelect
                  name="priority"
                  defaultValue={String(ticket.priority_id)}
                  options={TICKET_PRIORITY_OPTIONS}
                  className="w-full"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Status</label>
                <FormSelect
                  name="status"
                  defaultValue={String(ticket.status_id)}
                  options={TICKET_STATUS_OPTIONS}
                  className="w-full"
                />
              </div>
              <Button type="submit">Save</Button>
            </form>
          </details>
          <DeleteTicketForm ticketId={ticket.id} subject={ticket.subject} />
        </div>

        <div className="mb-6 grid gap-3 border border-border bg-muted/50/50 p-4 text-sm sm:grid-cols-2">
          <div className="space-y-1">
            <p>
              <span className="font-semibold text-foreground">Owner</span>: {ownerName}
            </p>
            <p>
              <span className="font-semibold text-foreground">Status</span>: {statusLabel(ticket.status_id)}
            </p>
            <p>
              <span className="font-semibold text-foreground">Priority</span>: {priorityLabel(ticket.priority_id)}
            </p>
            <p>
              <span className="font-semibold text-foreground">Options</span>: {ticketProblemSummary(ticket)}
            </p>
          </div>
          <div className="space-y-1">
            <p>
              <span className="font-semibold text-foreground">Category</span>: {categoryTitle}
            </p>
            <p>
              <span className="font-semibold text-foreground">Created</span>: {fmtUnix(ticket.created_at)}
            </p>
            <p>
              <span className="font-semibold text-foreground">Last update</span>: {fmtUnix(ticket.updated_at)}
            </p>
            <p>
              <span className="font-semibold text-foreground">Channel #</span>: {ticket.channel_number || "—"}
            </p>
          </div>
        </div>

        <h3 className="mb-2 text-sm font-semibold text-foreground">Description</h3>
        <TicketViewHtml html={ticket.html} className="mb-8 max-w-none border border-border bg-card p-4 text-sm leading-relaxed text-foreground [&_a]:text-primary [&_a]:underline" />

        <h3 className="mb-3 text-sm font-semibold text-foreground">Comments</h3>
        <div className="mb-6 space-y-3">
          {commentsWithAuthors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          ) : (
            commentsWithAuthors.map((c) => (
              <div key={c.id} className="overflow-hidden rounded border border-border bg-card">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border bg-muted px-3 py-2 text-sm">
                  <span className="font-medium text-foreground">{c.author}</span>
                  <span className="text-muted-foreground">{fmtUnix(c.updated_at)}</span>
                </div>
                <TicketViewHtml html={c.html} className="border-0 bg-card p-3 text-sm leading-relaxed text-foreground [&_a]:text-primary [&_a]:underline" />
              </div>
            ))
          )}
        </div>

        <h3 id="add-comment" className="mb-2 text-sm font-semibold text-foreground">
          Add comment
        </h3>
        <form action={addTicketCommentAction} className="max-w-2xl space-y-3">
          <input type="hidden" name="ticket_id" value={ticket.id} />
          <textarea name="comment" rows={5} className="w-full rounded border border-input bg-muted/50 px-3 py-2 text-sm" placeholder="Reply…" />
          <Button type="submit">Reply</Button>
        </form>
      </Panel>
    </div>
  );
}

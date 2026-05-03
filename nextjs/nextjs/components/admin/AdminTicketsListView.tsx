import Link from "next/link";
import { Ticket } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { FlashToastsBoundary } from "@/components/FlashToasts";
import {
  listTicketsForAdmin,
  priorityLabel,
  statusLabel,
  type AdminActiveTicketStatusFilter,
} from "@/lib/repos/tickets";
import { markTicketCompleteAction } from "@/actions/forms";
import { cn } from "@/lib/cn";
import { dataTableStickyTh } from "@/lib/ui/dataTableSticky";
import { buttonOutlineLinkClassName, buttonSolidChartLinkClassName } from "@/components/ui/button";

export type AdminTicketsListFilter = "active" | "completed";

function fmtUnix(t: number) {
  if (!t) return "—";
  return new Date(t * 1000).toLocaleString();
}

function resolveFlash(sp: { ok?: string; error?: string }) {
  const okMsg =
    sp.ok === "created"
      ? "Ticket was created."
      : sp.ok === "complete"
        ? "Ticket marked completed."
        : sp.ok === "reopened"
          ? "Ticket was reopened."
          : sp.ok === "updated"
            ? "Ticket was updated."
            : sp.ok === "deleted"
              ? "Ticket was deleted."
              : sp.ok === "1"
                ? "Ticket created."
                : null;
  const errMsg = sp.error === "ticket" ? "Invalid ticket." : null;
  return { okMsg, errMsg };
}

function tabPillClass(active: boolean) {
  return cn(
    "inline-flex min-h-9 items-center justify-center rounded-md px-3 py-2 text-sm font-medium antialiased transition-[color,background-color,box-shadow,border-color] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    active
      ? "border border-cyan-800/50 bg-chart-2 text-white shadow-sm hover:bg-cyan-700"
      : "border border-input bg-card text-foreground hover:bg-muted/50",
  );
}

function activeOpenStatusDescription(s: AdminActiveTicketStatusFilter): string {
  if (s === 1) return statusLabel(1);
  if (s === 3) return statusLabel(3);
  return "Other open statuses";
}

export async function AdminTicketsListView({
  filter,
  flash,
  activeOpenStatus,
}: {
  filter: AdminTicketsListFilter;
  flash: { ok?: string; error?: string };
  /** When `filter` is `active`, restrict rows to this open-ticket status (`status_id` 1 / 3, or not in 1–3). */
  activeOpenStatus?: AdminActiveTicketStatusFilter;
}) {
  const rows = await listTicketsForAdmin(filter, filter === "active" ? activeOpenStatus : undefined);
  const { okMsg, errMsg } = resolveFlash(flash);
  const ticketFlashes = [
    ...(okMsg ? [{ type: "success" as const, message: okMsg }] : []),
    ...(errMsg ? [{ type: "error" as const, message: errMsg }] : []),
  ];

  return (
    <div className="space-y-6 pb-10">
      {ticketFlashes.length ? <FlashToastsBoundary items={ticketFlashes} stripParams={["ok", "error"]} /> : null}
      <PageHeader
        title={filter === "completed" ? "Completed Tickets" : "Active Tickets"}
        breadcrumb="Home › Tickets"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/tickets/dashboard" className={buttonOutlineLinkClassName("bg-card shadow-sm")}>
              Dashboard
            </Link>
            <Link href="/admin/tickets/create" className={buttonSolidChartLinkClassName()}>
              Create New Ticket
            </Link>
          </div>
        }
      />
      <div className="min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-md ring-1 ring-black/[0.06] dark:bg-[hsl(222_47%_8%/0.92)] dark:ring-white/[0.08]">
        <div className="flex flex-wrap gap-2 border-b border-border/60 bg-muted/10 px-4 py-3 sm:px-5">
          <Link href="/admin/tickets" className={tabPillClass(filter === "active")}>
            Active Tickets
          </Link>
          <Link href="/admin/tickets/complete" className={tabPillClass(filter === "completed")}>
            Completed Tickets
          </Link>
        </div>

        {filter === "active" && activeOpenStatus ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 bg-muted/5 px-4 py-2.5 text-sm sm:px-5">
            <p className="text-muted-foreground">
              Filtered to <span className="font-semibold text-foreground">{activeOpenStatusDescription(activeOpenStatus)}</span>
            </p>
            <Link href="/admin/tickets" className="text-xs font-semibold text-primary hover:underline">
              Clear status filter
            </Link>
          </div>
        ) : null}

        <div className="p-4 sm:p-5 lg:p-6">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center sm:py-20">
              <Ticket className="h-11 w-11 text-muted-foreground/45" strokeWidth={1.25} aria-hidden />
              <p className="text-sm font-medium text-foreground">No tickets in this list.</p>
              <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                {filter === "active"
                  ? activeOpenStatus
                    ? "No open tickets match this status. Try clearing the filter or pick another status from the dashboard."
                    : "Open tickets will show up here. Create one to track a user issue."
                  : "Tickets you mark complete appear in this archive."}
              </p>
              {filter === "active" ? (
                <Link href="/admin/tickets/create" className={cn(buttonSolidChartLinkClassName(), "mt-2 w-full sm:w-auto")}>
                  Create New Ticket
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="app-data-table-scroll thin-scrollbar rounded-lg border border-border/50 bg-card/50">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className={dataTableStickyTh("whitespace-nowrap", "comfortable")}>ID</th>
                    <th className={dataTableStickyTh(undefined, "comfortable")}>Subject</th>
                    <th className={dataTableStickyTh("whitespace-nowrap", "comfortable")}>Category</th>
                    <th className={dataTableStickyTh("whitespace-nowrap", "comfortable")}>Priority</th>
                    <th className={dataTableStickyTh("whitespace-nowrap", "comfortable")}>Status</th>
                    <th className={dataTableStickyTh("whitespace-nowrap", "comfortable")}>Updated</th>
                    {filter === "active" ? (
                      <th scope="col" className={dataTableStickyTh("whitespace-nowrap text-right", "comfortable")}>
                        <span className="sr-only">Actions</span>
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/50 transition-colors last:border-0 hover:bg-muted/25">
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs">
                        <Link href={`/admin/tickets/${r.id}`} className="text-primary hover:underline">
                          {r.id}
                        </Link>
                      </td>
                      <td className="max-w-[220px] px-4 py-2.5">
                        <Link href={`/admin/tickets/${r.id}`} className="line-clamp-2 font-medium text-primary hover:underline">
                          {r.subject}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{r.categoryTitle}</td>
                      <td className="whitespace-nowrap px-4 py-2.5">{priorityLabel(r.priority_id)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5">{statusLabel(r.status_id)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">{fmtUnix(r.updated_at)}</td>
                      {filter === "active" ? (
                        <td className="whitespace-nowrap px-4 py-2.5 text-right">
                          <form action={markTicketCompleteAction} className="inline">
                            <input type="hidden" name="ticket_id" value={r.id} />
                            <button
                              type="submit"
                              className="inline-flex h-9 min-h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground antialiased shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                              Mark complete
                            </button>
                          </form>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

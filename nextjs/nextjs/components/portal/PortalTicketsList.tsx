import Link from "next/link";
import type { FlashToastItem } from "@/components/FlashToasts";
import { FlashToastsBoundary } from "@/components/FlashToasts";
import { PageHeader } from "@/components/admin/PageHeader";
import { Panel } from "@/components/admin/Panel";
import { markPortalTicketCompleteAction } from "@/actions/forms";
import { listTicketsForPortalUser, priorityLabel, statusLabel } from "@/lib/repos/tickets";
import { dataTableStickyTh } from "@/lib/ui/dataTableSticky";
import { buttonOutlineLinkClassName, buttonSolidChartLinkClassName } from "@/components/ui/button";
import type { PortalTicketRole } from "@/lib/repos/tickets";

function fmtUnix(t: number) {
  if (!t) return "—";
  return new Date(t * 1000).toLocaleString();
}

type Filter = "active" | "completed";

export async function PortalTicketsList({
  portalBase,
  role,
  username,
  filter,
  flashItems,
}: {
  portalBase: "/manager" | "/dealer";
  role: PortalTicketRole;
  username: string;
  filter: Filter;
  flashItems: FlashToastItem[];
}) {
  const rows = await listTicketsForPortalUser(username, role, filter);

  return (
    <div>
      <PageHeader
        title={filter === "completed" ? "Completed Tickets" : "Active Tickets"}
        breadcrumb={`Portal › Tickets`}
        showBack={false}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={`${portalBase}/tickets/dashboard`} className={buttonOutlineLinkClassName("bg-card shadow-sm")}>
              Dashboard
            </Link>
            <Link href={`${portalBase}/tickets/create`} className={buttonSolidChartLinkClassName()}>
              Create New Ticket
            </Link>
          </div>
        }
      />
      {flashItems.length ? <FlashToastsBoundary items={flashItems} stripParams={["ok", "error"]} /> : null}
      <Panel>
        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href={`${portalBase}/tickets`}
            className={`inline-flex min-h-9 items-center justify-center rounded-md px-3 py-2 text-sm font-medium antialiased transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
              filter === "active"
                ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                : "border border-input bg-card text-foreground hover:bg-muted/50"
            }`}
          >
            Active Tickets
          </Link>
          <Link
            href={`${portalBase}/tickets/complete`}
            className={`inline-flex min-h-9 items-center justify-center rounded-md px-3 py-2 text-sm font-medium antialiased transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
              filter === "completed"
                ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                : "border border-input bg-card text-foreground hover:bg-muted/50"
            }`}
          >
            Completed Tickets
          </Link>
        </div>
        <div className="app-data-table-scroll thin-scrollbar">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr>
                <th className={dataTableStickyTh("whitespace-nowrap p-2")}>ID</th>
                <th className={dataTableStickyTh("p-2")}>Subject</th>
                <th className={dataTableStickyTh("p-2")}>Category</th>
                <th className={dataTableStickyTh("p-2")}>Priority</th>
                <th className={dataTableStickyTh("p-2")}>Status</th>
                <th className={dataTableStickyTh("p-2")}>Updated</th>
                {filter === "active" ? <th className={dataTableStickyTh("p-2")}> </th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={filter === "active" ? 7 : 6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No tickets in this list.
                  </td>
                </tr>
              ) : null}
              {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border hover:bg-muted/50">
                    <td className="p-2 font-mono">
                      <Link href={`${portalBase}/tickets/${r.id}`} className="text-primary hover:underline">
                        {r.id}
                      </Link>
                    </td>
                    <td className="p-2">
                      <Link href={`${portalBase}/tickets/${r.id}`} className="text-primary hover:underline">
                        {r.subject}
                      </Link>
                    </td>
                    <td className="p-2">{r.categoryTitle}</td>
                    <td className="p-2">{priorityLabel(r.priority_id)}</td>
                    <td className="p-2">{statusLabel(r.status_id)}</td>
                    <td className="p-2 text-muted-foreground">{fmtUnix(r.updated_at)}</td>
                    {filter === "active" ? (
                      <td className="p-2 text-right">
                        <form action={markPortalTicketCompleteAction} className="inline">
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
      </Panel>
    </div>
  );
}

import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { Panel } from "@/components/admin/Panel";
import {
  getAdminTicketStatusOverview,
  getTicketDashboardStats,
  getTicketStatusOverviewForPortalUser,
  listTicketsTableRows,
  listTicketsTableRowsForPortalUser,
  listTvGenres,
} from "@/lib/repos/tickets";
import { buttonOutlineLinkClassName } from "@/components/ui/button";
import { PortalTicketsTableClient } from "@/components/portal/PortalTicketsTableClient";

export async function PortalTicketsDashboard({
  portalBase,
  filters,
  viewer,
}: {
  portalBase: "/manager" | "/dealer" | "/admin";
  viewer: { type: "ROOT" | "MNGR" | "RSLR"; username: string };
  filters?: {
    q?: string;
    status?: string;
    priority?: string;
    sort?: string;
  };
}) {
  const role = viewer.type === "MNGR" ? "MNGR" : viewer.type === "RSLR" ? "RSLR" : null;
  const [overview, ticketRows, genres, stats] = await Promise.all([
    role ? getTicketStatusOverviewForPortalUser(viewer.username, role) : getAdminTicketStatusOverview(),
    role ? listTicketsTableRowsForPortalUser(viewer.username, role) : listTicketsTableRows(),
    listTvGenres(),
    role ? Promise.resolve<{ totalTickets: number }>({ totalTickets: 0 }) : getTicketDashboardStats(),
  ]);
  const breadcrumb =
    portalBase === "/admin" ? "Home › Tickets › Dashboard" : "Portal › Tickets › Dashboard";
  const q = (filters?.q ?? "").trim();
  const statusFilter = (filters?.status ?? "").trim();
  const priorityFilter = (filters?.priority ?? "").trim();
  const sortFilter = (filters?.sort ?? "updated_desc").trim();
  const pct = (n: number) => {
    if (!overview.grandTotal) return "0%";
    return `${Math.round((n / overview.grandTotal) * 100)}%`;
  };
  const filteredRows = ticketRows.filter((row) => {
    if (statusFilter && String(row.status_id) !== statusFilter) return false;
    if (priorityFilter && String(row.priority_id) !== priorityFilter) return false;
    if (q) {
      const haystack =
        `${row.id} ${row.subject} ${row.user_id} ${row.categoryTitle} ${row.creatorUsername} ${row.agentUsername} ${row.content} ${row.latestComment} ${row.channel_number}`.toLowerCase();
      if (!haystack.includes(q.toLowerCase())) return false;
    }
    return true;
  });
  const sortedRows = [...filteredRows].sort((a, b) => {
    if (sortFilter === "id_asc") return a.id - b.id;
    if (sortFilter === "id_desc") return b.id - a.id;
    if (sortFilter === "created_asc") return a.created_at - b.created_at || a.id - b.id;
    if (sortFilter === "created_desc") return b.created_at - a.created_at || b.id - a.id;
    if (sortFilter === "updated_asc") return a.updated_at - b.updated_at || a.id - b.id;
    if (sortFilter === "updated_desc") return b.updated_at - a.updated_at || b.id - a.id;
    if (sortFilter === "priority_desc") return a.priority_id - b.priority_id || b.updated_at - a.updated_at;
    if (sortFilter === "priority_asc") return b.priority_id - a.priority_id || b.updated_at - a.updated_at;
    if (sortFilter === "status_asc") return a.status_id - b.status_id || b.updated_at - a.updated_at;
    if (sortFilter === "status_desc") return b.status_id - a.status_id || b.updated_at - a.updated_at;
    if (sortFilter === "subject_asc") return a.subject.localeCompare(b.subject) || b.updated_at - a.updated_at;
    if (sortFilter === "subject_desc") return b.subject.localeCompare(a.subject) || b.updated_at - a.updated_at;
    if (sortFilter === "category_asc") return a.categoryTitle.localeCompare(b.categoryTitle) || b.updated_at - a.updated_at;
    if (sortFilter === "category_desc") return b.categoryTitle.localeCompare(a.categoryTitle) || b.updated_at - a.updated_at;
    if (sortFilter === "comments_asc") return a.commentCount - b.commentCount || b.updated_at - a.updated_at;
    if (sortFilter === "comments_desc") return b.commentCount - a.commentCount || b.updated_at - a.updated_at;
    return b.updated_at - a.updated_at || b.id - a.id;
  });
  const buildSortHref = (nextSort: string) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (statusFilter) sp.set("status", statusFilter);
    if (priorityFilter) sp.set("priority", priorityFilter);
    sp.set("sort", nextSort);
    return `${portalBase}/tickets/dashboard?${sp.toString()}`;
  };
  const sortToggleHref = (ascKey: string, descKey: string) =>
    buildSortHref(sortFilter === descKey ? ascKey : descKey);
  const headerSortHrefs = {
    id: sortToggleHref("id_asc", "id_desc"),
    subject: sortToggleHref("subject_asc", "subject_desc"),
    category: sortToggleHref("category_asc", "category_desc"),
    priority: sortToggleHref("priority_asc", "priority_desc"),
    status: sortToggleHref("status_asc", "status_desc"),
    comments: sortToggleHref("comments_asc", "comments_desc"),
    created: sortToggleHref("created_asc", "created_desc"),
    updated: sortToggleHref("updated_asc", "updated_desc"),
  };
  const buildFilterHref = (nextStatus?: string) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (priorityFilter) sp.set("priority", priorityFilter);
    if (sortFilter) sp.set("sort", sortFilter);
    if (nextStatus) sp.set("status", nextStatus);
    const qs = sp.toString();
    return `${portalBase}/tickets/dashboard${qs ? `?${qs}` : ""}`;
  };

  return (
    <div>
      <PageHeader
        title="Tickets dashboard"
        breadcrumb={breadcrumb}
        showBack={false}
        actions={
          <Link href={`${portalBase}/tickets`} className={buttonOutlineLinkClassName("bg-card shadow-sm")}>
            Back to tickets
          </Link>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href={buildFilterHref()} className="block">
          <Panel title="Total" className={statusFilter === "" ? "ring-2 ring-cyan-500/35" : undefined}>
            <p className="text-3xl font-bold text-foreground">{role ? overview.grandTotal : stats.totalTickets}</p>
            <p className="text-xs text-muted-foreground">All tickets in billing DB (PHP parity).</p>
          </Panel>
        </Link>
        <Link href={buildFilterHref("1")} className="block">
          <Panel title="In progress" className={statusFilter === "1" ? "ring-2 ring-cyan-500/35" : undefined}>
            <p className="text-3xl font-bold text-cyan-300">{overview.inProgress}</p>
            <p className="text-xs text-muted-foreground">{pct(overview.inProgress)} of total</p>
          </Panel>
        </Link>
        <Link href={buildFilterHref("3")} className="block">
          <Panel title="Re-opened" className={statusFilter === "3" ? "ring-2 ring-cyan-500/35" : undefined}>
            <p className="text-3xl font-bold text-amber-300">{overview.reopened}</p>
            <p className="text-xs text-muted-foreground">{pct(overview.reopened)} of total</p>
          </Panel>
        </Link>
        <Link href={buildFilterHref("2")} className="block">
          <Panel title="Fixed" className={statusFilter === "2" ? "ring-2 ring-cyan-500/35" : undefined}>
            <p className="text-3xl font-bold text-emerald-300">{overview.fixed}</p>
            <p className="text-xs text-muted-foreground">{pct(overview.fixed)} of total</p>
          </Panel>
        </Link>
      </div>
      <Panel>
        <PortalTicketsTableClient
          rows={sortedRows}
          portalBase={portalBase}
          genres={genres}
          initialSearch={q}
          initialStatusFilter={statusFilter}
          initialPriorityFilter={priorityFilter}
          sortFilter={sortFilter}
          headerSortHrefs={headerSortHrefs}
        />
      </Panel>
    </div>
  );
}

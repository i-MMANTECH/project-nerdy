import Link from "next/link";
import {
  ArrowUpRight,
  Ban,
  Building2,
  MessageSquare,
  Store,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";
import { AdminDashboardCharts } from "@/components/dashboard/AdminDashboardCharts";
import { DashboardKpiCard } from "@/components/dashboard/DashboardKpiCard";
import {
  getCreditFlowByDayForUsername,
  getOperatorDashboardStats,
  getOperatorSubscriberTrendSeries,
  getScopedExpiringSoonCount,
  listOperatorRecentSubscribers,
} from "@/lib/data";
import type { PortalBase } from "@/lib/portal-nav";
import type { AdminRecentSubscriberRow } from "@/lib/repos/billing";
import type { AdminTicketRow } from "@/lib/repos/tickets";
import { countOpenTicketsForPortalUser, listTicketsForPortalUser } from "@/lib/repos/tickets";
import { cn } from "@/lib/cn";

const ACCOUNT_ON = 0;
const ACCOUNT_OFF = 1;

function formatInt(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

function subscriberBadge(row: AdminRecentSubscriberRow) {
  if (row.status === ACCOUNT_OFF) {
    return { label: "Inactive", className: "bg-rose-500/15 text-rose-300 ring-rose-500/25" };
  }
  const exp = row.expires ? new Date(row.expires.replace(" ", "T")) : null;
  const now = Date.now();
  if (exp && !Number.isNaN(exp.getTime())) {
    if (exp.getTime() <= now) {
      return { label: "Expired", className: "bg-rose-500/15 text-rose-300 ring-rose-500/25" };
    }
    const week = 7 * 24 * 60 * 60 * 1000;
    if (exp.getTime() - now <= week) {
      return { label: "Expiring soon", className: "bg-amber-500/15 text-amber-200 ring-amber-500/30" };
    }
  }
  return { label: "Active", className: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25" };
}

function subscriberContext(row: AdminRecentSubscriberRow): string {
  if (!row.expires) return "No expiry date";
  const exp = new Date(row.expires.replace(" ", "T"));
  if (Number.isNaN(exp.getTime())) return `Expiry ${row.expires}`;
  const pretty = exp.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (row.status === ACCOUNT_OFF) return `Inactive · expires ${pretty}`;
  if (exp.getTime() <= Date.now()) return `Expired on ${pretty}`;
  return `Expires ${pretty}`;
}

function subscriberCreatedAgo(row: AdminRecentSubscriberRow): string | null {
  if (!row.created) return null;
  const created = new Date(row.created.replace(" ", "T"));
  if (Number.isNaN(created.getTime())) return null;
  const diffMs = Date.now() - created.getTime();
  if (diffMs < 0) return "Created just now";
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < hour) return `Created ${Math.max(1, Math.floor(diffMs / minute))}m ago`;
  if (diffMs < day) return `Created ${Math.floor(diffMs / hour)}h ago`;
  if (diffMs < day * 30) return `Created ${Math.floor(diffMs / day)}d ago`;
  const month = Math.floor(diffMs / (day * 30));
  if (month < 12) return `Created ${month}mo ago`;
  return `Created ${Math.floor(month / 12)}y ago`;
}

function ticketStatusPill(t: AdminTicketRow) {
  if (t.status_id === 3) return { label: "Re-opened", className: "bg-amber-500/15 text-amber-200 ring-amber-500/25" };
  return { label: "Open", className: "bg-sky-500/15 text-sky-200 ring-sky-500/25" };
}

function ticketPriorityPill(priorityId: number) {
  if (priorityId === 1) return { label: "High", className: "bg-rose-500/15 text-rose-200 ring-rose-500/25" };
  if (priorityId === 3) return { label: "Low", className: "bg-amber-500/15 text-amber-200 ring-amber-500/30" };
  return { label: "Medium", className: "bg-sky-500/15 text-sky-200 ring-sky-500/25" };
}

type PortalTicketRole = "MNGR" | "RSLR";

export async function OperatorDashboardPage({
  ownerType,
  portalBase,
  operatorUsername,
}: {
  ownerType: "MNGR" | "SRSLR" | "RSLR";
  portalBase: PortalBase;
  operatorUsername: string;
}) {
  const u = operatorUsername.trim();
  let dashboardDataWarning: string | null = null;

  const stats = await getOperatorDashboardStats({ ownerType, ownerUsername: u });
  const trendFull = await getOperatorSubscriberTrendSeries({ ownerType, ownerUsername: u, monthCount: 12 }).catch(() => {
    dashboardDataWarning = "Some dashboard sections are unavailable right now. Check database connection and owner mapping.";
    return [];
  });
  const creditFlowFull = await getCreditFlowByDayForUsername(u, 30).catch(() => {
    dashboardDataWarning = "Some dashboard sections are unavailable right now. Check database connection and owner mapping.";
    return [];
  });
  const expiringSoonSubscribers = await getScopedExpiringSoonCount({
    ownerType,
    ownerUsername: u,
    withinDays: 7,
  }).catch(() => {
    dashboardDataWarning = "Some dashboard sections are unavailable right now. Check database connection and owner mapping.";
    return 0;
  });
  const recentSubs = await listOperatorRecentSubscribers({ ownerType, ownerUsername: u, limit: 8 }).catch(() => {
    dashboardDataWarning = "Some dashboard sections are unavailable right now. Check database connection and owner mapping.";
    return [] as AdminRecentSubscriberRow[];
  });
  const activeNonExpiringSubscribers = Math.max(0, stats.activeAccounts - expiringSoonSubscribers);

  const ticketsRole: PortalTicketRole | null = ownerType === "MNGR" || ownerType === "RSLR" ? ownerType : null;
  let openTickets = 0;
  let recentTickets: AdminTicketRow[] = [];
  if (ticketsRole) {
    try {
      openTickets = await countOpenTicketsForPortalUser(u, ticketsRole);
    } catch {
      openTickets = 0;
    }
    try {
      recentTickets = (await listTicketsForPortalUser(u, ticketsRole, "active")).slice(0, 8);
    } catch {
      recentTickets = [];
    }
  }

  const usersHref = `${portalBase}/users`;

  return (
    <div className="mx-auto w-full max-w-[min(100%,1920px)] space-y-8 pb-10">
      {dashboardDataWarning ? (
        <div className="-mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100" role="status">
          {dashboardDataWarning}
        </div>
      ) : null}

      <section aria-labelledby="portal-dash-kpis">
        <h2 id="portal-dash-kpis" className="sr-only">
          Key metrics
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <DashboardKpiCard
            title="Credit balance"
            value={formatInt(Math.round(stats.balance))}
            icon={Wallet}
            href={`${portalBase}/transactions`}
            tone="cyan"
          />
          <div className="sm:col-span-2 xl:col-span-2">
            <DashboardKpiCard
              title="Total users"
              value={formatInt(stats.totalAccounts)}
              icon={Users}
              href={usersHref}
              tone="slate"
              statusCharts={[
                {
                  title: "Expiry",
                  total: stats.totalAccounts,
                  segments: [
                    {
                      label: "Expiring",
                      value: expiringSoonSubscribers,
                      color: "rgb(250 204 21)",
                      dotClassName: "bg-yellow-300",
                      href: `${usersHref}?status=expiring`,
                    },
                    {
                      label: "Expired",
                      value: stats.expiredAccounts,
                      color: "rgb(249 115 22)",
                      dotClassName: "bg-orange-400",
                      href: `${usersHref}?status=expired`,
                    },
                  ],
                },
                {
                  title: "Activity",
                  total: stats.totalAccounts,
                  segments: [
                    {
                      label: "Active",
                      value: activeNonExpiringSubscribers,
                      color: "rgb(16 185 129)",
                      dotClassName: "bg-emerald-400",
                      href: `${usersHref}?status=active`,
                    },
                    {
                      label: "Inactive",
                      value: stats.inactiveAccounts,
                      color: "rgb(148 163 184)",
                      dotClassName: "bg-slate-400",
                      href: `${usersHref}?status=inactive`,
                    },
                  ],
                },
              ]}
            />
          </div>
          <DashboardKpiCard
            title="Inactive users"
            value={formatInt(stats.inactiveAccounts)}
            icon={Ban}
            href={`${usersHref}?status=inactive`}
            tone="amber"
          />
          {ownerType === "MNGR" && stats.resellerCount != null ? (
            <DashboardKpiCard
              title="Resellers"
              value={formatInt(stats.resellerCount)}
              icon={Store}
              href={`${portalBase}/resellers`}
              tone="violet"
            />
          ) : null}
          {stats.dealerCount != null ? (
            <DashboardKpiCard
              title="Dealers"
              value={formatInt(stats.dealerCount)}
              icon={Building2}
              href={`${portalBase}/dealers`}
              tone="slate"
            />
          ) : null}
          {ticketsRole ? (
            <DashboardKpiCard
              title="Open tickets"
              value={formatInt(openTickets)}
              icon={Ticket}
              href={`${portalBase}/tickets`}
              tone="amber"
            />
          ) : null}
          <DashboardKpiCard
            title="Messages"
            value="Compose"
            icon={MessageSquare}
            href={`${portalBase}/message`}
            tone="emerald"
            trend="Device messages to STB"
          />
        </div>
      </section>

      <section aria-labelledby="portal-dash-charts-heading">
        <h2 id="portal-dash-charts-heading" className="sr-only">
          Trends and credit flow
        </h2>
        <AdminDashboardCharts trendFull={trendFull} creditFlowFull={creditFlowFull} />
      </section>

      <section className="grid gap-5 lg:grid-cols-2" aria-labelledby="portal-dash-lists-heading">
        <h2 id="portal-dash-lists-heading" className="sr-only">
          Recent activity
        </h2>
        <div className="rounded-2xl border border-border/60 bg-card/95 p-5 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold tracking-tight text-foreground">Recent users</h3>
            <Link href={usersHref} className="text-xs font-semibold text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="app-data-table-scroll thin-scrollbar mt-4 overflow-hidden rounded-lg border border-border/60">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">User</th>
                  <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Expiry</th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Profile</th>
                </tr>
              </thead>
              <tbody>
                {recentSubs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      No users yet.
                    </td>
                  </tr>
                ) : (
                  recentSubs.map((row) => {
                    const badge = subscriberBadge(row);
                    const title = row.full_name?.trim() || row.account;
                    const context = subscriberContext(row);
                    const createdAgo = subscriberCreatedAgo(row);
                    return (
                      <tr key={row.account} className="border-t border-border/50 first:border-0">
                        <td className="px-3 py-2 align-middle">
                          <div className="block px-1 py-0.5">
                            <p className="truncate font-semibold text-foreground">{title}</p>
                            <p className="truncate text-[11px] text-muted-foreground">{row.account}</p>
                          </div>
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <span className="block truncate text-[11px] text-muted-foreground">{context}</span>
                          {createdAgo ? (
                            <span className="block truncate text-[10px] text-muted-foreground/80">{createdAgo}</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-right align-middle">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1",
                              badge.className,
                            )}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right align-middle">
                          <Link
                            href={`${usersHref}?query=${encodeURIComponent(row.account)}`}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-primary underline decoration-primary/40 underline-offset-2 transition hover:decoration-primary"
                          >
                            View profile
                            <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/95 p-5 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold tracking-tight text-foreground">Recent tickets</h3>
            {ticketsRole ? (
              <Link href={`${portalBase}/tickets`} className="text-xs font-semibold text-primary hover:underline">
                View all
              </Link>
            ) : null}
          </div>
          <ul className="mt-4 divide-y divide-border/60">
            {!ticketsRole ? (
              <li className="py-6 text-center text-sm text-muted-foreground">
                Ticket queues are available to managers and dealers. Resellers use Messages and Users.
              </li>
            ) : recentTickets.length === 0 ? (
              <li className="py-6 text-center text-sm text-muted-foreground">No open tickets.</li>
            ) : (
              recentTickets.map((t) => {
                const pr = ticketPriorityPill(t.priority_id);
                const st = ticketStatusPill(t);
                const when = new Date(t.updated_at * 1000).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <li key={t.id} className="py-3 first:pt-0">
                    <Link href={`${portalBase}/tickets`} className="block hover:opacity-90">
                      <p className="line-clamp-2 font-medium text-foreground">{t.subject || `Ticket #${t.id}`}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t.categoryTitle} · {when}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1",
                            pr.className,
                          )}
                        >
                          {pr.label}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1",
                            st.className,
                          )}
                        >
                          {st.label}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}



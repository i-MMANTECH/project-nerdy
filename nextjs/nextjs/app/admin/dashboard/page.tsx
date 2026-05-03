import Link from "next/link";
import { ArrowUpRight, Banknote, Cpu, Ticket, Users, UsersRound, Wallet } from "lucide-react";
import { AdminDashboardCharts } from "@/components/dashboard/AdminDashboardCharts";
import { DashboardKpiCard } from "@/components/dashboard/DashboardKpiCard";
import { QuickActionsLauncher } from "@/components/admin/QuickActionsLauncher";
import { SystemStatusStrip } from "@/components/admin/SystemStatusStrip";
import { ZoneHeader } from "@/components/admin/ZoneHeader";
import { getSession } from "@/lib/session";
import {
  DEFAULT_ADMIN_NOTIFICATION_PREFS,
  getAdminCreditFlowByDay,
  getAdminDevicesOnlineCount,
  getAdminExpiringSoonCount,
  getAdminNotificationPrefs,
  getAdminRevenueThisMonth,
  getAdminSubscriberTrendSeries,
  getAdminWalletCreditsTotal,
  getDashboardStats,
  getUsersSummary,
  listAdminRecentSubscribers,
} from "@/lib/data";
import { cn } from "@/lib/cn";
import { getAdminTicketStatusOverview, listRecentTicketsForAdmin } from "@/lib/repos/tickets";
import type { AdminRecentSubscriberRow } from "@/lib/repos/billing";
import type { AdminTicketRow } from "@/lib/repos/tickets";

const ACCOUNT_OFF = 1;

function formatInt(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function subscriberBadge(row: AdminRecentSubscriberRow) {
  if (row.status === ACCOUNT_OFF) {
    return { label: "Inactive", className: "bg-rose-500/15 text-rose-300 ring-rose-500/25" };
  }
  const exp = row.expires ? new Date(String(row.expires).replace(" ", "T")) : null;
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
  let exp: Date;
  try {
    exp = new Date(String(row.expires).replace(" ", "T"));
  } catch {
    return `Expiry ${row.expires}`;
  }
  if (Number.isNaN(exp.getTime())) return `Expiry ${row.expires}`;
  const pretty = exp.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (row.status === ACCOUNT_OFF) return `Inactive · expires ${pretty}`;
  if (exp.getTime() <= Date.now()) return `Expired on ${pretty}`;
  return `Expires ${pretty}`;
}

function ticketStatusPill(t: AdminTicketRow) {
  if (t.status_id === 2) return { label: "Fixed", className: "bg-emerald-500/15 text-emerald-200 ring-emerald-500/25" };
  if (t.status_id === 3) return { label: "Re-opened", className: "bg-amber-500/15 text-amber-200 ring-amber-500/25" };
  if (t.status_id === 1) return { label: "In progress", className: "bg-sky-500/15 text-sky-200 ring-sky-500/25" };
  return { label: "Other", className: "bg-slate-500/15 text-slate-200 ring-slate-500/25" };
}

function ticketPriorityPill(priorityId: number) {
  if (priorityId === 1) return { label: "High", className: "bg-rose-500/15 text-rose-200 ring-rose-500/25" };
  if (priorityId === 3) return { label: "Low", className: "bg-amber-500/15 text-amber-200 ring-amber-500/30" };
  return { label: "Medium", className: "bg-sky-500/15 text-sky-200 ring-sky-500/25" };
}

export default async function DashboardPage() {
  const session = await getSession();
  const notifyPrefs = await getAdminNotificationPrefs().catch(() => DEFAULT_ADMIN_NOTIFICATION_PREFS);

  const s = await getDashboardStats();
  const summary = await getUsersSummary();
  const [
    ticketStatusOverview,
    expiringSoonForStatus,
    walletCredits,
    revenueMonth,
    devicesOnline,
    trendFull,
    creditFlowFull,
    recentSubs,
    recentTickets,
  ] = await Promise.all([
    getAdminTicketStatusOverview().catch(() => ({ grandTotal: 0, inProgress: 0, fixed: 0, reopened: 0, other: 0 })),
    getAdminExpiringSoonCount(7).catch(() => 0),
    notifyPrefs.notifyLowCredit ? getAdminWalletCreditsTotal().catch(() => 0) : Promise.resolve(0),
    getAdminRevenueThisMonth().catch(() => 0),
    notifyPrefs.notifyDeviceOffline ? getAdminDevicesOnlineCount().catch(() => null as number | null) : Promise.resolve(null),
    getAdminSubscriberTrendSeries(12).catch(() => []),
    getAdminCreditFlowByDay(30).catch(() => []),
    listAdminRecentSubscribers(8).catch(() => [] as AdminRecentSubscriberRow[]),
    listRecentTicketsForAdmin(10).catch(() => [] as AdminTicketRow[]),
  ]);
  const activeNonExpiring = Math.max(0, summary.active - expiringSoonForStatus);
  const greetingName = session?.displayName?.trim() || session?.username || "Operator";

  const lastSyncLabel = `LAST SYNC ${new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;

  return (
    <div className="mx-auto w-full max-w-[min(100%,1920px)] space-y-6 pb-10">
      <SystemStatusStrip
        lastSyncLabel={lastSyncLabel}
        segments={[
          { label: "Subscribers", value: formatInt(s.totalUsers), tone: "cyan", icon: "users" },
          { label: "Active", value: formatInt(activeNonExpiring), tone: "green", icon: "shield" },
          { label: "Tickets", value: formatInt(ticketStatusOverview.inProgress), tone: "magenta", icon: "ticket" },
          { label: "Wallet", value: formatInt(walletCredits), tone: "gold", icon: "money" },
          { label: "Revenue MTD", value: formatMoney(revenueMonth), tone: "violet", icon: "activity" },
        ]}
      />

      <section className="fx-rise flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between" aria-labelledby="dash-hero">
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">IPTV Billing &mdash; Command Center</p>
          <h1 id="dash-hero" className="text-[clamp(1.5rem,3vw,2.25rem)] font-bold leading-tight tracking-tight">
            <span className="text-foreground">Welcome back, </span>
            <span className="fx-text-grad">{greetingName}</span>
          </h1>
          <p className="text-sm text-muted-foreground">Live operations report from the billing core.</p>
        </div>
        <QuickActionsLauncher />
      </section>

      <section className="space-y-4" aria-labelledby="dash-kpis">
        <ZoneHeader index="01" label="Overview" hint="Snapshot of every operational signal." tone="cyan" />
        <h2 id="dash-kpis" className="sr-only">Key metrics</h2>
        <div className="fx-rise-stagger grid min-h-0 grid-cols-1 items-stretch gap-4">
          <div className="fx-3d-tilt h-full min-h-[17rem] min-w-0 xl:min-h-[18rem]">
            <DashboardKpiCard
              className="fx-bevel h-full min-h-0"
              title="Total users"
              value={formatInt(s.totalUsers)}
              icon={Users}
              href="/admin/users"
              tone="cyan"
              metricsHint="Validity and activity breakdown"
              statusCharts={[
                {
                  title: "Expiry",
                  total: s.totalUsers,
                  panelHref: "/admin/users?status=expiry",
                  segments: [
                    { label: "Expiring", value: expiringSoonForStatus, color: "rgb(250 204 21)", dotClassName: "bg-yellow-300", href: "/admin/users?status=expiring" },
                    { label: "Expired", value: summary.expired, color: "rgb(249 115 22)", dotClassName: "bg-orange-400", href: "/admin/users?status=expired" },
                  ],
                },
                {
                  title: "Activity",
                  total: s.totalUsers,
                  panelHref: "/admin/users?status=activity",
                  segments: [
                    { label: "Active", value: activeNonExpiring, color: "rgb(16 185 129)", dotClassName: "bg-emerald-400", href: "/admin/users?status=active" },
                    { label: "Inactive", value: summary.inactive, color: "rgb(251 113 133)", dotClassName: "bg-rose-400", href: "/admin/users?status=inactive" },
                  ],
                },
              ]}
            />
          </div>
          <div className="fx-3d-tilt h-full min-h-[17rem] min-w-0 xl:min-h-[18rem]">
            <DashboardKpiCard
              className="fx-bevel-magenta h-full min-h-0"
              title="Team hierarchy"
              value={formatInt(s.totalManagers + s.totalResellers + s.totalDealers)}
              icon={UsersRound}
              href="/admin/managers"
              tone="violet"
              metricsHint="Staff by role"
              statusCharts={[
                {
                  title: "Organization",
                  total: s.totalManagers + s.totalResellers + s.totalDealers,
                  panelHref: "/admin/managers",
                  segments: [
                    { label: "Managers", value: s.totalManagers, color: "rgb(167 139 250)", dotClassName: "bg-violet-300", href: "/admin/managers" },
                    { label: "Resellers", value: s.totalResellers, color: "rgb(56 189 248)", dotClassName: "bg-sky-300", href: "/admin/managers" },
                    { label: "Dealers", value: s.totalDealers, color: "rgb(251 191 36)", dotClassName: "bg-amber-300", href: "/admin/managers" },
                  ],
                },
              ]}
            />
          </div>
          <div className="fx-3d-tilt h-full min-h-[17rem] min-w-0 xl:min-h-[18rem]">
            <DashboardKpiCard
              className="fx-bevel-green h-full min-h-0"
              title="Tickets"
              value={formatInt(ticketStatusOverview.grandTotal)}
              icon={Ticket}
              href="/admin/tickets"
              tone="amber"
              trend={notifyPrefs.notifyNewTickets ? undefined : "Header ticket badge off — Settings → Notifications"}
              metricsHint="All tickets by status"
              statusCharts={[
                {
                  title: "By status",
                  total: ticketStatusOverview.grandTotal,
                  panelHref: "/admin/tickets",
                  segmentGridClassName: "grid grid-cols-1 min-[420px]:grid-cols-2 gap-x-2 gap-y-2",
                  segments: [
                    { label: "In progress", value: ticketStatusOverview.inProgress, color: "rgb(56 189 248)", dotClassName: "bg-sky-300", href: "/admin/tickets?status=1" },
                    { label: "Re-opened", value: ticketStatusOverview.reopened, color: "rgb(245 158 11)", dotClassName: "bg-amber-400", href: "/admin/tickets?status=3" },
                    { label: "Fixed", value: ticketStatusOverview.fixed, color: "rgb(52 211 153)", dotClassName: "bg-emerald-400", href: "/admin/tickets/complete" },
                    { label: "Other", value: ticketStatusOverview.other, color: "rgb(148 163 184)", dotClassName: "bg-slate-400", href: "/admin/tickets?status=other" },
                  ],
                },
              ]}
            />
          </div>
        </div>

        <div className="fx-rise-stagger grid items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <DashboardKpiCard
            className="fx-bevel h-full min-h-[10.5rem]"
            title="Credits in wallets"
            value={notifyPrefs.notifyLowCredit ? formatInt(walletCredits) : "—"}
            icon={Wallet}
            href={notifyPrefs.notifyLowCredit ? "/admin/transactions" : undefined}
            tone="cyan"
            trend={notifyPrefs.notifyLowCredit ? undefined : "Off in Settings → Notifications"}
          />
          <DashboardKpiCard
            className="fx-bevel h-full min-h-[10.5rem]"
            title="Devices online"
            value={!notifyPrefs.notifyDeviceOffline ? "—" : devicesOnline === null ? "—" : formatInt(devicesOnline)}
            icon={Cpu}
            tone={!notifyPrefs.notifyDeviceOffline || devicesOnline === null ? "slate" : "cyan"}
            trend={
              !notifyPrefs.notifyDeviceOffline
                ? "Off in Settings → Notifications"
                : devicesOnline === null
                  ? "Set STALKER_DATABASE_NAME (same server as billing) for live count"
                  : "Stalker keep_alive within 4 min, matched to billing accounts"
            }
          />
          <DashboardKpiCard
            className="fx-bevel-green h-full min-h-[10.5rem]"
            title="Revenue this month"
            value={formatMoney(revenueMonth)}
            icon={Banknote}
            href="/admin/transactions"
            tone="emerald"
          />
        </div>
      </section>

      <section aria-labelledby="dash-charts-heading" className="space-y-4">
        <ZoneHeader index="02" label="Analytics" hint="The two charts that earn their keep — trends + credit flow." tone="magenta" />
        <h2 id="dash-charts-heading" className="sr-only">Trends and credit flow</h2>
        <AdminDashboardCharts trendFull={trendFull} creditFlowFull={creditFlowFull} />
      </section>

      <section className="space-y-4" aria-labelledby="dash-lists-heading">
        <ZoneHeader index="03" label="Operations" hint="Latest signups and the live ticket queue." tone="green" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <h2 id="dash-lists-heading" className="sr-only">Recent activity</h2>
        <div className="rounded-2xl border border-border/60 bg-card/95 p-5 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold tracking-tight">
              <span className="fx-text-grad">Recent users</span>
            </h3>
            <Link href="/admin/users" className="text-xs font-semibold text-primary hover:underline">View all</Link>
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
                  <tr><td colSpan={4} className="px-3 py-8 text-center text-sm text-muted-foreground">No users yet.</td></tr>
                ) : (
                  recentSubs.map((row) => {
                    const badge = subscriberBadge(row);
                    const title = row.full_name?.trim() || row.account;
                    const context = subscriberContext(row);
                    return (
                      <tr key={row.account} className="border-t border-border/50 first:border-0">
                        <td className="px-3 py-2 align-middle">
                          <p className="truncate font-semibold text-foreground">{title}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{row.account}</p>
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <span className="block truncate text-[11px] text-foreground">{context}</span>
                        </td>
                        <td className="px-3 py-2 text-right align-middle">
                          <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1", badge.className)}>{badge.label}</span>
                        </td>
                        <td className="px-3 py-2 text-right align-middle">
                          <Link href={`/admin/users/${encodeURIComponent(row.account)}`} className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-primary underline decoration-primary/40 underline-offset-2 transition hover:decoration-primary">
                            View profile <ArrowUpRight className="h-3 w-3" aria-hidden />
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
            <h3 className="text-lg font-semibold tracking-tight">
              <span className="fx-text-grad">Recent tickets</span>
            </h3>
            <Link href="/admin/tickets" className="text-xs font-semibold text-primary hover:underline">View all</Link>
          </div>
          <div className="app-data-table-scroll thin-scrollbar mt-4 overflow-hidden rounded-lg border border-border/60">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ticket</th>
                  <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Updated</th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Priority & status</th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Open</th>
                </tr>
              </thead>
              <tbody>
                {recentTickets.length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-8 text-center text-sm text-muted-foreground">No tickets yet.</td></tr>
                ) : (
                  recentTickets.map((t) => {
                    const pr = ticketPriorityPill(t.priority_id);
                    const st = ticketStatusPill(t);
                    const when = new Date(t.updated_at * 1000).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
                    const title = t.subject?.trim() || `Ticket #${t.id}`;
                    return (
                      <tr key={t.id} className="border-t border-border/50 first:border-0">
                        <td className="px-3 py-2 align-middle">
                          <p className="truncate font-semibold text-foreground">{title}</p>
                          <p className="truncate font-mono text-[11px] text-muted-foreground">#{t.id}</p>
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <span className="block truncate text-[11px] text-foreground">{t.categoryTitle}</span>
                          <span className="block truncate text-[10px] text-muted-foreground">{when}</span>
                        </td>
                        <td className="px-3 py-2 text-right align-middle">
                          <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                            <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1", pr.className)}>{pr.label}</span>
                            <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1", st.className)}>{st.label}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right align-middle">
                          <Link href={`/admin/tickets/${t.id}`} className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-primary underline decoration-primary/40 underline-offset-2 transition hover:decoration-primary">
                            Open ticket <ArrowUpRight className="h-3 w-3" aria-hidden />
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
        </div>
      </section>
    </div>
  );
}

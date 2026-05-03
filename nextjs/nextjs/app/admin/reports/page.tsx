import Link from "next/link";
import { Banknote, CircleDollarSign, Download, Eye, TrendingDown, TrendingUp, Users } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminReportsCharts } from "@/components/admin/AdminReportsCharts";
import { DashboardKpiCard } from "@/components/dashboard/DashboardKpiCard";
import { buttonOutlineLinkClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { dataTableStickyTh } from "@/lib/ui/dataTableSticky";
import { loadAdminReportsPayload, parseAdminReportRange } from "@/lib/data";
import type { AdminReportRange, AdminReportsPayload } from "@/lib/repos/adminReports";

type Props = { searchParams?: Promise<{ range?: string }> };

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function formatInt(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

function pctTrend(k: { pctVsPrevious: number | null }): string | undefined {
  if (k.pctVsPrevious == null) return "No prior-period baseline";
  const v = k.pctVsPrevious;
  const s = `${v >= 0 ? "+" : ""}${v.toFixed(1)}% vs prior period`;
  return s;
}

function emptyPayload(rangeDays: AdminReportRange): AdminReportsPayload {
  const z = { value: 0, previous: 0, pctVsPrevious: null as number | null };
  return {
    rangeDays,
    kpis: {
      rangeDays,
      revenueUsd: z,
      newSubscribers: z,
      churnRatePct: z,
      arpuUsd: z,
      activeUsers: 0,
    },
    growth: [],
    topDealers: [],
    expiring: [
      { label: "Next 24 hours", count: 0, potentialUsd: 0 },
      { label: "Next 3 days", count: 0, potentialUsd: 0 },
      { label: "Next 7 days", count: 0, potentialUsd: 0 },
      { label: "Next 30 days", count: 0, potentialUsd: 0 },
    ],
    packages: [],
  };
}

const RANGE_OPTS: { v: AdminReportRange; label: string }[] = [
  { v: 7, label: "Last 7 days" },
  { v: 30, label: "Last 30 days" },
  { v: 90, label: "Last 90 days" },
  { v: 365, label: "Last 12 months" },
];

export default async function AdminReportsPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const range = parseAdminReportRange(sp.range);
  let data: AdminReportsPayload;
  try {
    data = await loadAdminReportsPayload(range);
  } catch {
    data = emptyPayload(range);
  }

  const k = data.kpis;
  const churnDelta = k.churnRatePct.pctVsPrevious;
  const churnImproved = churnDelta != null && churnDelta < 0;

  return (
    <div className="mx-auto w-full max-w-[min(100%,1920px)] space-y-8 pb-10">
      <PageHeader
        title="Reports & analytics"
        breadcrumb="Revenue, subscribers, dealers, and renewals from your billing database."
        showBack={false}
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
            <div className="flex flex-wrap gap-1 rounded-lg border border-border/70 bg-muted/30 p-1">
              {RANGE_OPTS.map((o) => (
                <Link
                  key={o.v}
                  href={`/admin/reports?range=${o.v}`}
                  className={cn(
                    "rounded-md px-3 py-2 text-center text-xs font-semibold transition-colors sm:text-sm",
                    range === o.v ? "bg-card text-foreground shadow-sm ring-1 ring-border/60" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  {o.label}
                </Link>
              ))}
            </div>
            <a
              href={`/api/admin/reports/export?range=${range}`}
              className={buttonOutlineLinkClassName(
                "inline-flex min-h-11 w-full items-center justify-center gap-2 px-4 sm:w-auto sm:min-h-9 border-border/80 bg-muted/15 hover:bg-muted/30",
              )}
            >
              <Download className="h-4 w-4" aria-hidden />
              Export CSV
            </a>
          </div>
        }
      />

      <p className="-mt-4 text-xs leading-relaxed text-muted-foreground">
        Churn rate is an approximation: accounts whose <span className="font-medium text-foreground">expires</span> fell in the
        window, divided by current active subscribers. ARPU divides the same-window transaction revenue by active subscribers.
      </p>

      <section aria-labelledby="rep-kpis">
        <h2 id="rep-kpis" className="sr-only">
          Summary KPIs
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardKpiCard
            title="Total revenue (USD)"
            value={formatMoney(k.revenueUsd.value)}
            icon={Banknote}
            tone="emerald"
            trend={pctTrend(k.revenueUsd)}
          />
          <DashboardKpiCard
            title="New subscribers"
            value={formatInt(k.newSubscribers.value)}
            icon={Users}
            tone="cyan"
            trend={pctTrend(k.newSubscribers)}
          />
          <DashboardKpiCard
            title="Churn rate (approx.)"
            value={`${k.churnRatePct.value.toFixed(1)}%`}
            icon={churnImproved ? TrendingDown : TrendingUp}
            tone={churnImproved ? "emerald" : "rose"}
            trend={pctTrend(k.churnRatePct)}
          />
          <DashboardKpiCard
            title="Avg. revenue / active user"
            value={formatMoney(k.arpuUsd.value)}
            icon={CircleDollarSign}
            tone="violet"
            trend={pctTrend(k.arpuUsd)}
          />
        </div>
      </section>

      <AdminReportsCharts growth={data.growth} packages={data.packages} />

      <section className="grid gap-5 lg:grid-cols-1" aria-labelledby="rep-tables">
        <h2 id="rep-tables" className="sr-only">
          Tables
        </h2>
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/95 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
          <div className="border-b border-border/60 px-5 py-4 sm:px-6">
            <h3 className="text-base font-semibold text-foreground">Top dealers</h3>
            <p className="text-sm text-muted-foreground">By transaction revenue in the selected range (dealer billing login).</p>
          </div>
          <div className="app-data-table-scroll thin-scrollbar">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr>
                  <th className={dataTableStickyTh("px-5 py-3 sm:px-6")}>Rank</th>
                  <th className={dataTableStickyTh("px-5 py-3 sm:px-6")}>Dealer</th>
                  <th className={dataTableStickyTh("px-5 py-3 sm:px-6")}>Subscribers</th>
                  <th className={dataTableStickyTh("px-5 py-3 sm:px-6")}>Revenue</th>
                  <th className={dataTableStickyTh("px-5 py-3 sm:px-6")}>Growth</th>
                </tr>
              </thead>
              <tbody>
                {data.topDealers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground sm:px-6">
                      No dealer-linked revenue in this range.
                    </td>
                  </tr>
                ) : (
                  data.topDealers.map((r) => (
                    <tr key={r.dealer} className="border-b border-border/40 last:border-0">
                      <td className="px-5 py-3 tabular-nums text-muted-foreground sm:px-6">{r.rank}</td>
                      <td className="px-5 py-3 font-mono text-xs text-foreground sm:px-6">{r.dealer}</td>
                      <td className="px-5 py-3 tabular-nums sm:px-6">{formatInt(r.subscribers)}</td>
                      <td className="px-5 py-3 tabular-nums text-emerald-300 sm:px-6">{formatMoney(r.revenue)}</td>
                      <td className="px-5 py-3 sm:px-6">
                        {r.growthPct == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className={cn("font-medium tabular-nums", r.growthPct >= 0 ? "text-emerald-400" : "text-rose-400")}>
                            {r.growthPct >= 0 ? "+" : ""}
                            {r.growthPct.toFixed(1)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/95 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
          <div className="border-b border-border/60 px-5 py-4 sm:px-6">
            <h3 className="text-base font-semibold text-foreground">Expiring subscriptions</h3>
            <p className="text-sm text-muted-foreground">
              Active accounts with renewal date in the window. Potential = sum of billed amounts on those accounts (last 120 days).
            </p>
          </div>
          <div className="app-data-table-scroll thin-scrollbar">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr>
                  <th className={dataTableStickyTh("px-5 py-3 sm:px-6")}>Period</th>
                  <th className={dataTableStickyTh("px-5 py-3 sm:px-6")}>Count</th>
                  <th className={dataTableStickyTh("px-5 py-3 sm:px-6")}>Potential revenue</th>
                  <th className={dataTableStickyTh("px-5 py-3 sm:px-6")}>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.expiring.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-sm text-muted-foreground sm:px-6">
                      No expiring buckets in this range.
                    </td>
                  </tr>
                ) : null}
                {data.expiring.map((row) => (
                  <tr key={row.label} className="border-b border-border/40 last:border-0">
                    <td className="px-5 py-3 font-medium text-foreground sm:px-6">{row.label}</td>
                    <td className="px-5 py-3 tabular-nums sm:px-6">{formatInt(row.count)}</td>
                    <td className="px-5 py-3 tabular-nums text-amber-200 sm:px-6">{formatMoney(row.potentialUsd)}</td>
                    <td className="px-5 py-3 sm:px-6">
                      <Link
                        href="/admin/users?status=expiring"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden />
                        View subscribers
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

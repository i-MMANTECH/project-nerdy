"use client";

import { useId, useMemo, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AdminReportGrowthPoint, AdminReportPackageRow } from "@/lib/repos/adminReports";
import { cn } from "@/lib/cn";
import { dataTableStickyTh } from "@/lib/ui/dataTableSticky";

const MOTION = {
  isAnimationActive: true,
  animationDuration: 900,
  animationEasing: "ease-out" as const,
};

const AXIS_TICK = { fill: "hsl(215 16% 52%)", fontSize: 11, fontWeight: 500 as const };

function seriesStats(values: number[]) {
  const v = values.filter((x) => Number.isFinite(x));
  if (!v.length) return { total: 0, avg: 0, peak: 0, low: 0 };
  const total = v.reduce((a, b) => a + b, 0);
  return { total, avg: total / v.length, peak: Math.max(...v), low: Math.min(...v) };
}

function TabBar({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-border/60 bg-muted/30 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
            value === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function AdminReportsCharts({
  growth,
  packages,
}: {
  growth: AdminReportGrowthPoint[];
  packages: AdminReportPackageRow[];
}) {
  const uid = useId().replace(/:/g, "");
  const emeraldFill = `repEmerald-${uid}`;
  const [growthWindow, setGrowthWindow] = useState("all");
  const [showGrowthTable, setShowGrowthTable] = useState(false);
  const [showPkgTable, setShowPkgTable] = useState(false);

  const growthTabs = [
    { id: "14", label: "14D", take: 14 },
    { id: "30", label: "30D", take: 30 },
    { id: "all", label: "All", take: 9999 },
  ];

  const growthVisible = useMemo(() => {
    const n = growthTabs.find((x) => x.id === growthWindow)?.take ?? 9999;
    if (n >= growth.length) return growth;
    return growth.slice(-n);
  }, [growth, growthWindow]);

  const newStats = useMemo(() => seriesStats(growthVisible.map((d) => d.newAccounts)), [growthVisible]);
  const revStats = useMemo(() => seriesStats(growthVisible.map((d) => d.revenue)), [growthVisible]);

  const pkgData = useMemo(
    () => packages.map((p) => ({ name: p.name.length > 18 ? `${p.name.slice(0, 16)}…` : p.name, full: p.name, count: p.count })),
    [packages],
  );
  const pkgStats = useMemo(() => seriesStats(pkgData.map((d) => d.count)), [pkgData]);

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-2">
      <div className="relative min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card/95 p-5 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-foreground">User &amp; revenue growth</h3>
            <p className="text-xs text-muted-foreground">New accounts created vs transaction revenue by day (billing DB).</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TabBar tabs={growthTabs.map(({ id, label }) => ({ id, label }))} value={growthWindow} onChange={setGrowthWindow} />
            <button
              type="button"
              onClick={() => setShowGrowthTable((v) => !v)}
              className="rounded-lg border border-border/70 bg-muted/30 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted/50"
            >
              {showGrowthTable ? "Hide table" : "Show table"}
            </button>
          </div>
        </div>
        <div className="mt-4 h-[280px] w-full min-h-[280px] min-w-0 shrink-0">
          {growthVisible.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">No data in this window.</p>
          ) : (
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              minHeight={280}
              debounce={32}
              initialDimension={{ width: 640, height: 280 }}
            >
              <ComposedChart data={growthVisible} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id={emeraldFill} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22ff88" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#22ff88" stopOpacity={0} />
                  </linearGradient>
                  <filter id={`glow-${emeraldFill}`} x="-20%" y="-30%" width="140%" height="160%">
                    <feGaussianBlur stdDeviation="3" result="b" />
                    <feMerge>
                      <feMergeNode in="b" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 6" stroke="hsl(217 19% 27%)" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "hsl(217 19% 30%)", strokeOpacity: 0.8 }} interval="preserveStartEnd" />
                <YAxis yAxisId="left" width={36} tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" width={44} tick={AXIS_TICK} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: "rgb(148 163 184 / 0.05)", stroke: "transparent" }}
                  contentStyle={{
                    backgroundColor: "rgba(5,5,10,0.92)",
                    border: "1px solid rgba(0,240,255,0.25)",
                    borderRadius: 8,
                    fontSize: 12,
                    boxShadow: "0 8px 32px -10px rgba(0,240,255,0.35)",
                  }}
                  labelStyle={{ color: "#a8f1ff" }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4, color: "hsl(215 16% 65%)" }} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="newAccounts"
                  name="New users"
                  stroke="#22ff88"
                  strokeWidth={2.25}
                  fill={`url(#${emeraldFill})`}
                  dot={false}
                  filter={`url(#glow-${emeraldFill})`}
                  {...MOTION}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue (USD)"
                  stroke="#00f0ff"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: "#00f0ff", stroke: "rgba(0,240,255,0.35)", strokeWidth: 4 }}
                  filter={`url(#glow-${emeraldFill})`}
                  {...MOTION}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
        {showGrowthTable && growthVisible.length > 0 ? (
          <div className="app-data-table-scroll thin-scrollbar mt-3 rounded-lg border border-border/60">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th className={dataTableStickyTh("font-medium normal-case")}>Day</th>
                  <th className={dataTableStickyTh("font-medium normal-case")}>New</th>
                  <th className={dataTableStickyTh("font-medium normal-case")}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {growthVisible.map((row) => (
                  <tr key={row.key} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-2 text-foreground">{row.label}</td>
                    <td className="px-3 py-2 tabular-nums text-emerald-300">{row.newAccounts}</td>
                    <td className="px-3 py-2 tabular-nums text-cyan-200">{row.revenue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <div className="mt-4 grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-400/90">New users</p>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              {(["Total", "Avg", "Peak", "Low"] as const).map((k) => {
                const v = k === "Total" ? newStats.total : k === "Avg" ? newStats.avg : k === "Peak" ? newStats.peak : newStats.low;
                return (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-right font-medium tabular-nums text-emerald-300">{Number.isFinite(v) ? Math.round(v * 10) / 10 : 0}</dd>
                  </div>
                );
              })}
            </dl>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-300/90">Revenue (USD)</p>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              {(["Total", "Avg", "Peak", "Low"] as const).map((k) => {
                const v = k === "Total" ? revStats.total : k === "Avg" ? revStats.avg : k === "Peak" ? revStats.peak : revStats.low;
                return (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-right font-medium tabular-nums text-cyan-200">{Number.isFinite(v) ? Math.round(v * 100) / 100 : 0}</dd>
                  </div>
                );
              })}
            </dl>
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-border/50 bg-muted/25 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          <p className="mb-1 font-semibold text-foreground">Insights</p>
          <p>
            Revenue sums <span className="font-medium text-foreground">ABS(amount)</span> on billing transactions with amounts in the
            selected chart window. Aligns with dashboard transaction revenue, not bank settlements.
          </p>
        </div>
      </div>

      <div className="relative min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card/95 p-5 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-foreground">Package distribution</h3>
            <p className="text-xs text-muted-foreground">Stalker / Ministra users by tariff plan (when STALKER_DATABASE_NAME is set).</p>
          </div>
          <button
            type="button"
            onClick={() => setShowPkgTable((v) => !v)}
            className="rounded-lg border border-border/70 bg-muted/30 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted/50"
          >
            {showPkgTable ? "Hide table" : "Show table"}
          </button>
        </div>
        <div className="mt-4 h-[280px] w-full min-h-[280px] min-w-0 shrink-0">
          {pkgData.length === 0 ? (
            <p className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
              No Stalker connection or no users — set STALKER_DATABASE_NAME to populate this chart.
            </p>
          ) : (
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              minHeight={280}
              debounce={32}
              initialDimension={{ width: 640, height: 280 }}
            >
              <BarChart data={pkgData} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                <defs>
                  <linearGradient id={`pkgBar-${emeraldFill}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00f0ff" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#00f0ff" stopOpacity={0.40} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" stroke="hsl(217 19% 27%)" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="name" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "hsl(217 19% 30%)", strokeOpacity: 0.8 }} interval={0} angle={-28} textAnchor="end" height={56} />
                <YAxis width={40} tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "rgb(148 163 184 / 0.05)", stroke: "transparent" }}
                  contentStyle={{
                    backgroundColor: "rgba(5,5,10,0.92)",
                    border: "1px solid rgba(0,240,255,0.25)",
                    borderRadius: 8,
                    fontSize: 12,
                    boxShadow: "0 8px 32px -10px rgba(0,240,255,0.35)",
                  }}
                  labelStyle={{ color: "#a8f1ff" }}
                  formatter={(value, _name, item) => {
                    const full = (item?.payload as { full?: string } | undefined)?.full;
                    return [value, full ?? "Users"];
                  }}
                />
                <Bar dataKey="count" name="Users" fill={`url(#pkgBar-${emeraldFill})`} radius={[6, 6, 0, 0]} {...MOTION} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        {showPkgTable && pkgData.length > 0 ? (
          <div className="app-data-table-scroll thin-scrollbar mt-3 rounded-lg border border-border/60">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th className={dataTableStickyTh("font-medium normal-case")}>Package</th>
                  <th className={dataTableStickyTh("font-medium normal-case")}>Users</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((row) => (
                  <tr key={row.name} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-2 text-foreground">{row.name}</td>
                    <td className="px-3 py-2 tabular-nums text-cyan-200">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <div className="mt-4 border-t border-border/60 pt-4 text-xs text-muted-foreground">
          <p className="mb-1 font-semibold text-foreground">Totals</p>
          <p>
            Users across plans: <span className="font-medium tabular-nums text-cyan-200">{Math.round(pkgStats.total)}</span> ·
            Peak plan: <span className="font-medium tabular-nums text-cyan-200">{Math.round(pkgStats.peak)}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

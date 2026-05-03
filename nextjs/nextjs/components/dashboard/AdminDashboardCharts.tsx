"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
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
import type { DashboardDayCreditPoint, DashboardTrendPoint } from "@/lib/repos/billing";
import { cn } from "@/lib/cn";
import { dataTableStickyTh } from "@/lib/ui/dataTableSticky";
import { CornerBrackets } from "@/components/hud/CornerBracket";

/** Compact delta chip rendered next to a chart title. */
function DeltaChip({ percent, period, tone }: { percent: number; period: string; tone: "cyan" | "magenta" }) {
  const positive = percent >= 0;
  const color =
    tone === "cyan"
      ? positive
        ? "text-emerald-300 ring-emerald-400/35 bg-emerald-500/10"
        : "text-rose-300 ring-rose-400/35 bg-rose-500/10"
      : positive
        ? "text-pink-300 ring-pink-400/35 bg-pink-500/10"
        : "text-rose-300 ring-rose-400/35 bg-rose-500/10";
  return (
    <span className={cn("fx-segmented inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1", color)}>
      <span aria-hidden>{positive ? "▲" : "▼"}</span>
      {Math.abs(percent).toFixed(1)}%
      <span className="opacity-65">vs prior {period}</span>
    </span>
  );
}

const MOTION = {
  isAnimationActive: true,
  animationDuration: 900,
  animationEasing: "ease-out" as const,
};

const AXIS_TICK = { fill: "hsl(215 16% 60%)", fontSize: 11, fontWeight: 500 as const };

/** Cyberpunk neon palette — synced with globals.css chart tokens. Literal strings because recharts needs raw colors. */
const NEON = {
  cyan: "#00f0ff",
  magenta: "#ff00aa",
  violet: "#22ff88",
} as const;

/** Glassmorphic tooltip body — dark navy bg, soft cyan border, font-mono numbers. */
type TooltipPayload = { name: string; value: number; color: string; dataKey?: string };
function NeonTooltip({ active, label, payload }: { active?: boolean; label?: string; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-cyan-400/25 bg-slate-950/85 px-3 py-2 text-xs shadow-xl backdrop-blur-md">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-300/80">{label}</div>
      <ul className="grid gap-1">
        {payload.map((p) => (
          <li key={p.dataKey ?? p.name} className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-slate-300">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color, boxShadow: `0 0 6px ${p.color}` }} />
              {p.name}
            </span>
            <span className="font-mono text-slate-100 tabular-nums">{Number.isFinite(p.value) ? p.value : "—"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

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

function ChartFooterStats({
  leftTitle,
  rightTitle,
  left,
  right,
}: {
  leftTitle: string;
  rightTitle: string;
  left: ReturnType<typeof seriesStats>;
  right: ReturnType<typeof seriesStats>;
}) {
  const rows: [string, number, number][] = [
    ["Total", left.total, right.total],
    ["Avg", left.avg, right.avg],
    ["Peak", left.peak, right.peak],
    ["Low", left.low, right.low],
  ];
  return (
    <div className="mt-4 grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-300/90">{leftTitle}</p>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          {rows.map(([k, a]) => (
            <div key={`l-${k}`} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right font-medium tabular-nums text-cyan-200">{Number.isFinite(a) ? Math.round(a * 10) / 10 : 0}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-pink-300/90">{rightTitle}</p>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          {rows.map(([k, , b]) => (
            <div key={`r-${k}`} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right font-medium tabular-nums text-pink-200">{Number.isFinite(b) ? Math.round(b * 10) / 10 : 0}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function FlowFooterStats({ added, spent }: { added: ReturnType<typeof seriesStats>; spent: ReturnType<typeof seriesStats> }) {
  const rows: [string, number, number][] = [
    ["Total", added.total, spent.total],
    ["Avg", added.avg, spent.avg],
    ["Peak", added.peak, spent.peak],
    ["Low", added.low, spent.low],
  ];
  return (
    <div className="mt-4 grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-2">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-300/90">Credits added</p>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          {rows.map(([k, a]) => (
            <div key={`a-${k}`} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right font-medium tabular-nums text-cyan-200">{Number.isFinite(a) ? Math.round(a * 10) / 10 : 0}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-300/90">Credits spent</p>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          {rows.map(([k, , b]) => (
            <div key={`s-${k}`} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right font-medium tabular-nums text-violet-200">{Number.isFinite(b) ? Math.round(b * 10) / 10 : 0}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function InsightsBox({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 rounded-lg border border-border/50 bg-muted/25 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
      <p className="mb-1.5 font-semibold text-foreground">Insights</p>
      {children}
    </div>
  );
}

export function AdminDashboardCharts({
  trendFull,
  creditFlowFull,
}: {
  trendFull: DashboardTrendPoint[];
  creditFlowFull: DashboardDayCreditPoint[];
}) {
  const uid = useId().replace(/:/g, "");
  const trendGrad = `trendGrad-${uid}`;
  const trendGlow = `trendGlow-${uid}`;
  const flowAddGrad = `flowAdd-${uid}`;
  const flowSpendGrad = `flowSpend-${uid}`;

  const [trendRange, setTrendRange] = useState("6m");
  const [creditRange, setCreditRange] = useState("14d");
  const [showTrendTable, setShowTrendTable] = useState(false);
  const [showFlowTable, setShowFlowTable] = useState(false);

  const trendTabs = [
    { id: "3m", label: "3M", take: 3 },
    { id: "6m", label: "6M", take: 6 },
    { id: "12m", label: "1Y", take: 12 },
  ];

  const creditTabs = [
    { id: "7d", label: "7D", take: 7 },
    { id: "14d", label: "14D", take: 14 },
    { id: "30d", label: "30D", take: 30 },
  ];

  const trendVisible = useMemo(() => {
    const t = trendTabs.find((x) => x.id === trendRange)?.take ?? 6;
    return trendFull.slice(-t);
  }, [trendFull, trendRange]);

  const creditVisible = useMemo(() => {
    const n = creditTabs.find((x) => x.id === creditRange)?.take ?? 14;
    return creditFlowFull.slice(-n);
  }, [creditFlowFull, creditRange]);

  const newStats = useMemo(() => seriesStats(trendVisible.map((d) => d.newAccounts)), [trendVisible]);
  const exStats = useMemo(() => seriesStats(trendVisible.map((d) => d.expired)), [trendVisible]);
  const inStats = useMemo(() => seriesStats(creditVisible.map((d) => d.creditIn)), [creditVisible]);
  const outStats = useMemo(() => seriesStats(creditVisible.map((d) => d.creditOut)), [creditVisible]);

  const newMom =
    trendVisible.length >= 2
      ? ((trendVisible[trendVisible.length - 1].newAccounts - trendVisible[trendVisible.length - 2].newAccounts) /
          Math.max(trendVisible[trendVisible.length - 2].newAccounts, 1e-6)) *
        100
      : 0;
  const exMom =
    trendVisible.length >= 2
      ? ((trendVisible[trendVisible.length - 1].expired - trendVisible[trendVisible.length - 2].expired) /
          Math.max(trendVisible[trendVisible.length - 2].expired, 1e-6)) *
        100
      : 0;

  const flowChartData = useMemo(
    () =>
      creditVisible.map((d) => ({
        ...d,
        tick: new Date(d.key + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      })),
    [creditVisible],
  );

  return (
    <div className="fx-rise-stagger grid min-w-0 gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="fx-ring-grad fx-bevel relative min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card/95 p-5 ring-1 ring-black/[0.04] dark:ring-white/[0.06] sm:p-6">
        <CornerBrackets className="text-cyan-400/70" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold tracking-tight"><span className="fx-text-grad">User trends</span></h3>
              <DeltaChip percent={newMom} period={trendRange.toUpperCase()} tone="cyan" />
            </div>
            <p className="text-xs text-muted-foreground">New accounts vs expiries by month.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TabBar tabs={trendTabs.map(({ id, label }) => ({ id, label }))} value={trendRange} onChange={setTrendRange} />
            <button
              type="button"
              onClick={() => setShowTrendTable((v) => !v)}
              className="rounded-lg border border-border/70 bg-muted/30 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted/50"
            >
              {showTrendTable ? "Hide table" : "Show table"}
            </button>
          </div>
        </div>
        <div className="mt-4 h-[380px] w-full min-h-[380px] min-w-0 shrink-0">
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={380}
            debounce={32}
            initialDimension={{ width: 640, height: 280 }}
          >
            <ComposedChart data={trendVisible} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id={trendGrad} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={NEON.cyan} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={NEON.cyan} stopOpacity={0} />
                </linearGradient>
                <filter id={trendGlow} x="-20%" y="-30%" width="140%" height="160%">
                  <feGaussianBlur stdDeviation="3" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke="hsl(217 19% 27%)" strokeOpacity={0.5} vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "hsl(217 19% 30%)", strokeOpacity: 0.8 }} interval="preserveStartEnd" />
              <YAxis width={40} tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip cursor={{ fill: "rgb(148 163 184 / 0.05)", stroke: "transparent" }} content={<NeonTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4, color: "hsl(215 16% 65%)" }} />
              <Area
                type="monotone"
                dataKey="newAccounts"
                name="New accounts"
                stroke={NEON.cyan}
                strokeWidth={2.5}
                fill={`url(#${trendGrad})`}
                dot={false}
                filter={`url(#${trendGlow})`}
                {...MOTION}
              />
              <Line
                type="monotone"
                dataKey="expired"
                name="Expired"
                stroke={NEON.magenta}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: NEON.magenta, stroke: "rgba(244,114,182,0.35)", strokeWidth: 4 }}
                filter={`url(#${trendGlow})`}
                {...MOTION}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {showTrendTable ? (
          <div className="app-data-table-scroll thin-scrollbar mt-3 rounded-lg border border-border/60">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th className={dataTableStickyTh("font-medium normal-case")}>Month</th>
                  <th className={dataTableStickyTh("font-medium normal-case")}>New</th>
                  <th className={dataTableStickyTh("font-medium normal-case")}>Expired</th>
                </tr>
              </thead>
              <tbody>
                {trendVisible.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                      No trend rows in this range.
                    </td>
                  </tr>
                ) : null}
                {trendVisible.map((row) => (
                  <tr key={row.key} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-2 text-foreground">{row.label}</td>
                    <td className="px-3 py-2 tabular-nums text-cyan-300">{row.newAccounts}</td>
                    <td className="px-3 py-2 tabular-nums text-pink-300">{row.expired}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <ChartFooterStats leftTitle="New accounts" rightTitle="Expired" left={newStats} right={exStats} />
        <InsightsBox>
          <ul className="list-inside list-disc space-y-1">
            <li>
              New accounts moved <span className="font-medium text-cyan-300">{newMom >= 0 ? "+" : ""}{newMom.toFixed(1)}%</span> month over month at the window end.
            </li>
            <li>
              Expired volume shifted <span className="font-medium text-pink-300">{exMom >= 0 ? "+" : ""}{exMom.toFixed(1)}%</span> month over month at the window end.
            </li>
          </ul>
        </InsightsBox>
      </div>

      <div className="fx-ring-grad fx-bevel-magenta relative min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card/95 p-5 ring-1 ring-black/[0.04] dark:ring-white/[0.06] sm:p-6">
        <CornerBrackets className="text-pink-400/70" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold tracking-tight"><span className="fx-text-grad">Credit flow</span></h3>
              <DeltaChip
                percent={
                  inStats.total > 0 && outStats.total > 0
                    ? ((inStats.total - outStats.total) / Math.max(outStats.total, 1)) * 100
                    : 0
                }
                period={creditRange.toUpperCase()}
                tone="magenta"
              />
            </div>
            <p className="text-xs text-muted-foreground">Credits added vs spent per day (grouped).</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TabBar tabs={creditTabs.map(({ id, label }) => ({ id, label }))} value={creditRange} onChange={setCreditRange} />
            <button
              type="button"
              onClick={() => setShowFlowTable((v) => !v)}
              className="rounded-lg border border-border/70 bg-muted/30 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted/50"
            >
              {showFlowTable ? "Hide table" : "Show table"}
            </button>
          </div>
        </div>
        <div className="mt-4 h-[340px] w-full min-h-[340px] min-w-0 shrink-0">
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            minHeight={340}
            debounce={32}
            initialDimension={{ width: 640, height: 300 }}
          >
            <BarChart data={flowChartData} margin={{ top: 12, right: 12, left: 0, bottom: 4 }} barGap={4} barCategoryGap="18%">
              <defs>
                <linearGradient id={flowAddGrad} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={NEON.cyan} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={NEON.cyan} stopOpacity={0.45} />
                </linearGradient>
                <linearGradient id={flowSpendGrad} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={NEON.violet} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={NEON.violet} stopOpacity={0.45} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke="hsl(217 19% 27%)" strokeOpacity={0.5} vertical={false} />
              <XAxis dataKey="tick" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: "hsl(217 19% 30%)", strokeOpacity: 0.8 }} interval="preserveStartEnd" minTickGap={8} />
              <YAxis width={44} tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip cursor={{ fill: "rgb(148 163 184 / 0.05)", stroke: "transparent" }} content={<NeonTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4, color: "hsl(215 16% 65%)" }} />
              <Bar dataKey="creditIn" name="Added" fill={`url(#${flowAddGrad})`} radius={[6, 6, 0, 0]} maxBarSize={22} activeBar={false} {...MOTION} />
              <Bar dataKey="creditOut" name="Spent" fill={`url(#${flowSpendGrad})`} radius={[6, 6, 0, 0]} maxBarSize={22} activeBar={false} {...MOTION} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {showFlowTable ? (
          <div className="app-data-table-scroll thin-scrollbar mt-3 rounded-lg border border-border/60">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th className={dataTableStickyTh("font-medium normal-case")}>Day</th>
                  <th className={dataTableStickyTh("font-medium normal-case")}>Added</th>
                  <th className={dataTableStickyTh("font-medium normal-case")}>Spent</th>
                </tr>
              </thead>
              <tbody>
                {flowChartData.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                      No credit flow rows in this range.
                    </td>
                  </tr>
                ) : null}
                {flowChartData.map((row) => (
                  <tr key={row.key} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-2 text-foreground">{row.label}</td>
                    <td className="px-3 py-2 tabular-nums text-cyan-300">{row.creditIn}</td>
                    <td className="px-3 py-2 tabular-nums text-violet-300">{row.creditOut}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <FlowFooterStats added={inStats} spent={outStats} />
        <InsightsBox>
          <ul className="list-inside list-disc space-y-1">
            <li>
              Peak credits added <span className="font-medium text-cyan-300">{inStats.peak}</span> in a single day in this range.
            </li>
            <li>
              Peak credits spent <span className="font-medium text-violet-300">{outStats.peak}</span> in a single day in this range.
            </li>
          </ul>
        </InsightsBox>
      </div>
    </div>
  );
}

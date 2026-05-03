"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Filter,
  Info,
  Layers,
  Scale,
} from "lucide-react";
import { toast } from "sonner";
import type { AdminTransactionRow } from "@/lib/repos/billing";
import type { DashboardDayCreditPoint } from "@/lib/repos/billing";
import { formatTransactionRemarksForDisplay } from "@/lib/formatTransactionRemarks";
import { DashboardKpiCard } from "@/components/dashboard/DashboardKpiCard";
import { cn } from "@/lib/cn";
import { dataTableStickyTh } from "@/lib/ui/dataTableSticky";
import { Input } from "@/components/ui/input";
import {
  SelectRoot,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CREDIT_RANGE_TABS = [
  { id: "1d", take: 1 },
  { id: "1w", take: 7 },
  { id: "1m", take: 30 },
  { id: "1y", take: 366 },
] as const;

const MOTION = {
  isAnimationActive: true,
  animationDuration: 1000,
  animationEasing: "ease-out" as const,
};

const AXIS_TICK = { fill: "hsl(215 16% 52%)", fontSize: 11, fontWeight: 500 as const };

function formatInt(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(n));
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function padTxnId(raw: string) {
  return raw.padStart(8, "0");
}

function dash(v: string | null | undefined) {
  if (v == null || v === "") return "—";
  return v;
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
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300/90">Credits added</p>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          {rows.map(([k, a]) => (
            <div key={`a-${k}`} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right font-medium tabular-nums text-cyan-700 dark:text-cyan-200">
                {Number.isFinite(a) ? Math.round(a * 10) / 10 : 0}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300/90">Credits spent</p>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          {rows.map(([k, , b]) => (
            <div key={`s-${k}`} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right font-medium tabular-nums text-sky-700 dark:text-sky-200">
                {Number.isFinite(b) ? Math.round(b * 10) / 10 : 0}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function InsightsBox({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 flex gap-3 rounded-lg border border-sky-500/35 bg-sky-500/[0.06] px-4 py-3 text-xs leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="mb-1.5 font-semibold text-foreground">Insights</p>
        {children}
      </div>
    </div>
  );
}

function typeBadge(type: string) {
  const t = type.toUpperCase();
  if (t === "BONUS") {
    return (
      <span className="inline-block rounded-md border border-border bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
        BONUS
      </span>
    );
  }
  if (t === "DBIT") {
    return (
      <span className="inline-block rounded-md border border-cyan-500/35 bg-cyan-500/15 px-2 py-0.5 text-xs font-semibold text-cyan-700 dark:text-cyan-200">
        BUY
      </span>
    );
  }
  if (t === "CRDT") {
    return (
      <span className="inline-block rounded-md border border-teal-500/35 bg-teal-500/15 px-2 py-0.5 text-xs font-semibold text-teal-700 dark:text-teal-200">
        CREDIT
      </span>
    );
  }
  return (
    <span className="inline-block rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:text-rose-200">
      REVERSED
    </span>
  );
}

function monthsCell(type: string, freeMonth: number | null) {
  if (type.toUpperCase() === "DBIT") return "—";
  if (freeMonth != null && Number.isFinite(freeMonth) && freeMonth !== 0) return String(freeMonth);
  return "—";
}

function parseRowDate(ts: string | null): Date | null {
  if (!ts) return null;
  const d = new Date(ts.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

function inLastNDays(d: Date | null, n: number): boolean {
  if (!d) return false;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (n - 1));
  return d.getTime() >= start.getTime();
}

function amountCell(r: AdminTransactionRow) {
  const amtRaw = r.amount?.trim();
  if (amtRaw) {
    const n = Number(amtRaw.replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(n) && n !== 0) {
      const cls = n < 0 ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400";
      const sign = n > 0 ? "+" : "";
      return (
        <span className={cn("font-medium tabular-nums", cls)}>
          {sign}
          {formatMoney(n)}
        </span>
      );
    }
  }
  const p = r.periods;
  if (p === 0) return <span className="text-muted-foreground">—</span>;
  const cls = p < 0 ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400";
  return (
    <span className={cn("font-medium tabular-nums", cls)}>
      {p > 0 ? "+" : ""}
      {formatInt(p)} cr
    </span>
  );
}

function exportCsv(rows: AdminTransactionRow[], filename: string) {
  const headers = [
    "Transaction ID",
    "Timestamp",
    "Username",
    "Subscriber",
    "Type",
    "Amount (raw)",
    "Periods",
    "Coverage start",
    "Coverage end",
    "Remarks",
  ];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        `TXN-${padTxnId(r.transaction)}`,
        r.timestamp ?? "",
        r.created_by ?? r.username,
        r.account ?? "",
        r.type,
        r.amount ?? "",
        String(r.periods),
        r.coverage_start ?? "",
        r.coverage_end ?? "",
        formatTransactionRemarksForDisplay(r.remarks) ?? "",
      ]
        .map((x) => esc(String(x)))
        .join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportTransactionsCsvWithToast(rows: AdminTransactionRow[]) {
  const filename = `transactions-export-${new Date().toISOString().slice(0, 10)}.csv`;
  try {
    exportCsv(rows, filename);
    const n = rows.length;
    if (n === 0) {
      toast.info("CSV downloaded (headers only).", {
        description: "No transactions matched your filters.",
      });
    } else {
      toast.success(`Exported ${n} transaction${n === 1 ? "" : "s"}.`, { description: filename });
    }
  } catch {
    toast.error("Could not generate the export.");
  }
}

export function AdminTransactionsClient({
  rows,
  creditFlow,
}: {
  rows: AdminTransactionRow[];
  creditFlow: DashboardDayCreditPoint[];
}) {
  const uid = useId().replace(/:/g, "");
  const gradIn = `txIn-${uid}`;
  const gradOut = `txOut-${uid}`;

  const [range, setRange] = useState("1w");
  const [showFlowTable, setShowFlowTable] = useState(false);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [q, setQ] = useState("");

  const creditVisible = useMemo(() => {
    const take = CREDIT_RANGE_TABS.find((x) => x.id === range)?.take ?? 7;
    const full = creditFlow.length ? creditFlow : [];
    if (!full.length) return [];
    return full.slice(-take);
  }, [creditFlow, range]);

  const inStats = useMemo(() => seriesStats(creditVisible.map((d) => d.creditIn)), [creditVisible]);
  const outStats = useMemo(() => seriesStats(creditVisible.map((d) => d.creditOut)), [creditVisible]);

  const flowChartData = useMemo(
    () =>
      creditVisible.map((d) => ({
        ...d,
        tick: new Date(d.key + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      })),
    [creditVisible],
  );

  const last7 = useMemo(() => (creditFlow.length >= 7 ? creditFlow.slice(-7) : creditFlow), [creditFlow]);
  const prev7 = useMemo(() => {
    if (creditFlow.length < 14) return [];
    return creditFlow.slice(-14, -7);
  }, [creditFlow]);

  const sumIn = (chunk: DashboardDayCreditPoint[]) => chunk.reduce((s, d) => s + d.creditIn, 0);
  const sumOut = (chunk: DashboardDayCreditPoint[]) => chunk.reduce((s, d) => s + d.creditOut, 0);

  const kpiThisIn = sumIn(last7);
  const kpiThisOut = sumOut(last7);
  const kpiPrevIn = sumIn(prev7);
  const kpiPrevOut = sumOut(prev7);
  const inMom = prev7.length >= 7 ? ((kpiThisIn - kpiPrevIn) / Math.max(kpiPrevIn, 1e-6)) * 100 : 0;
  const outMom = prev7.length >= 7 ? ((kpiThisOut - kpiPrevOut) / Math.max(kpiPrevOut, 1e-6)) * 100 : 0;
  const inTrend = prev7.length >= 7 ? `${inMom >= 0 ? "+" : ""}${inMom.toFixed(1)}% vs prior week` : undefined;
  const spentTrend = prev7.length >= 7 ? `${outMom >= 0 ? "+" : ""}${outMom.toFixed(1)}% vs prior week` : undefined;

  const txCount7d = useMemo(() => {
    return rows.filter((r) => inLastNDays(parseRowDate(r.timestamp), 7)).length;
  }, [rows]);

  const addedMom =
    creditVisible.length >= 2
      ? ((creditVisible[creditVisible.length - 1].creditIn - creditVisible[creditVisible.length - 2].creditIn) /
          Math.max(creditVisible[creditVisible.length - 2].creditIn, 1e-6)) *
        100
      : 0;
  const spentMom =
    creditVisible.length >= 2
      ? ((creditVisible[creditVisible.length - 1].creditOut - creditVisible[creditVisible.length - 2].creditOut) /
          Math.max(creditVisible[creditVisible.length - 2].creditOut, 1e-6)) *
        100
      : 0;

  const filteredRows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== "ALL" && r.type.toUpperCase() !== typeFilter) return false;
      if (!needle) return true;
      const hay = [
        r.transaction,
        r.username,
        r.created_by ?? "",
        r.account ?? "",
        r.type,
        r.remarks ?? "",
        r.timestamp ?? "",
        String(r.periods),
        r.amount ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, typeFilter, q]);

  const totalCreditsFooter = filteredRows.reduce((sum, r) => sum + r.periods, 0);

  return (
    <div className="space-y-4.5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardKpiCard
          title="Credits in (7d)"
          value={formatInt(kpiThisIn)}
          icon={ArrowDownRight}
          tone="emerald"
          trend={inTrend}
        />
        <DashboardKpiCard
          title="Credits out (7d)"
          value={formatInt(kpiThisOut)}
          icon={ArrowUpRight}
          tone="cyan"
          trend={spentTrend}
        />
        <DashboardKpiCard
          title="Net (7d)"
          value={formatInt(kpiThisIn - kpiThisOut)}
          icon={Scale}
          tone="violet"
        />
        <DashboardKpiCard
          title="Transactions (7d)"
          value={formatInt(txCount7d)}
          icon={Layers}
          tone="slate"
        />
      </div>

      <div className="relative min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card/95 p-4.5 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06] sm:p-5">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.4] dark:opacity-100"
          style={{
            background:
              "radial-gradient(900px 180px at 50% -10%, rgba(6, 182, 212, 0.12), transparent 55%), radial-gradient(700px 140px at 100% 0%, rgba(14, 165, 233, 0.08), transparent 50%)",
          }}
          aria-hidden
        />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground">Credit activity</h2>
            <p className="text-xs text-muted-foreground">Credits added vs spent by day for your ledger account.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TabBar
              tabs={CREDIT_RANGE_TABS.map((x) => ({ id: x.id, label: x.id.toUpperCase() }))}
              value={range}
              onChange={setRange}
            />
            <button
              type="button"
              onClick={() => setShowFlowTable((v) => !v)}
              className="rounded-lg border border-border/70 bg-muted/30 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted/70 dark:hover:bg-muted/50"
            >
              {showFlowTable ? "Hide table" : "Show table"}
            </button>
            <button
              type="button"
              onClick={() => exportTransactionsCsvWithToast(filteredRows)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/30 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted/70 dark:hover:bg-muted/50"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              Export
            </button>
          </div>
        </div>

        <div className="relative mt-4 h-[300px] w-full min-h-[300px] min-w-0 shrink-0">
          {flowChartData.length === 0 ? (
            <div
              className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/15 px-6 py-10 text-center"
              role="status"
              aria-live="polite"
            >
              <Layers className="mb-3 h-9 w-9 text-muted-foreground/50" aria-hidden />
              <p className="text-sm font-medium text-foreground">No credit activity in this range</p>
              <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
                Try a longer window (1M / 1Y) or confirm this account has recent credit movements in the billing database.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300} debounce={32} initialDimension={{ width: 640, height: 300 }}>
              <ComposedChart data={flowChartData} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id={gradIn} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id={gradOut} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" stroke="hsl(217 19% 27%)" strokeOpacity={0.5} vertical={false} />
                <XAxis
                  dataKey="tick"
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={{ stroke: "hsl(217 19% 30%)", strokeOpacity: 0.8 }}
                  interval="preserveStartEnd"
                  minTickGap={8}
                />
                <YAxis width={44} tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "rgb(148 163 184 / 0.05)", stroke: "transparent" }}
                  contentStyle={{
                    backgroundColor: "hsl(222 47% 11% / 0.96)",
                    border: "1px solid hsl(217 33% 17%)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "hsl(214 32% 91%)" }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4 }} />
                <Area
                  type="monotone"
                  dataKey="creditIn"
                  name="Credits added"
                  stroke="#22d3ee"
                  strokeWidth={2.2}
                  fill={`url(#${gradIn})`}
                  dot={false}
                  {...MOTION}
                />
                <Line
                  type="monotone"
                  dataKey="creditOut"
                  name="Credits spent"
                  stroke="#7dd3fc"
                  strokeWidth={2.2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  {...MOTION}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {showFlowTable ? (
          flowChartData.length === 0 ? (
            <div
              className="relative mt-3 rounded-lg border border-dashed border-border/70 bg-muted/15 px-4 py-8 text-center sm:px-6"
              role="status"
              aria-live="polite"
            >
              <p className="text-sm font-medium text-foreground">No daily rows for this range</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Same data as the chart above — widen the date range if you expected movements here.
              </p>
            </div>
          ) : (
            <div className="relative mt-3 max-h-[min(40vh,22rem)] overflow-auto thin-scrollbar rounded-lg border border-border/60">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr>
                  <th className={dataTableStickyTh("whitespace-nowrap")}>Day</th>
                  <th className={dataTableStickyTh("whitespace-nowrap")}>Added</th>
                  <th className={dataTableStickyTh("whitespace-nowrap")}>Spent</th>
                  </tr>
                </thead>
                <tbody>
                  {flowChartData.map((row) => (
                    <tr key={row.key} className="border-b border-border/40 last:border-0">
                      <td className="px-3 py-1.5 text-foreground">{row.label}</td>
                      <td className="px-3 py-1.5 tabular-nums text-cyan-700 dark:text-cyan-300">{row.creditIn}</td>
                      <td className="px-3 py-1.5 tabular-nums text-sky-700 dark:text-sky-200">{row.creditOut}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}

        <FlowFooterStats added={inStats} spent={outStats} />

        <InsightsBox>
          <ul className="list-inside list-disc space-y-1">
            <li>
              Credits added moved{" "}
              <span className="font-medium text-cyan-700 dark:text-cyan-300">
                {addedMom >= 0 ? "+" : ""}
                {addedMom.toFixed(1)}%
              </span>{" "}
              day over day at the end of this range (single-day step).
            </li>
            <li>
              Credits spent moved{" "}
              <span className="font-medium text-sky-700 dark:text-sky-200">
                {spentMom >= 0 ? "+" : ""}
                {spentMom.toFixed(1)}%
              </span>{" "}
              day over day at the end of this range.
            </li>
          </ul>
        </InsightsBox>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/95 p-3.5 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06] sm:p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold tracking-tight text-foreground">Ledger</h2>
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <div className="relative flex min-w-0 items-center sm:max-w-[200px]">
              <Filter className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <SelectRoot value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger
                  className="h-10 w-full border-border/70 bg-muted/30 pl-9 sm:h-9"
                  aria-label="Filter by type"
                >
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="ALL">All types</SelectItem>
                  <SelectItem value="CRDT">CRDT</SelectItem>
                  <SelectItem value="DBIT">DBIT</SelectItem>
                  <SelectItem value="BONUS">BONUS</SelectItem>
                </SelectContent>
              </SelectRoot>
            </div>
            <div className="relative min-w-0 flex-1 sm:max-w-md">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by transaction ID, account, remarks…"
                className="h-10 bg-muted/30 sm:h-9"
              />
            </div>
            <button
              type="button"
              onClick={() => exportTransactionsCsvWithToast(filteredRows)}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-border/70 bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 sm:h-9"
            >
              <Download className="h-4 w-4" aria-hidden />
              Export
            </button>
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <div
            className="rounded-lg border border-dashed border-border/70 bg-muted/15 px-6 py-12 text-center"
            role="status"
            aria-live="polite"
          >
            <p className="text-sm font-medium text-foreground">No transactions match your filters</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Clear the search box or set the type filter to <span className="font-medium text-foreground/80">All types</span>, then
              try again.
            </p>
          </div>
        ) : (
          <div className="app-data-table-scroll thin-scrollbar rounded-lg border border-border/50">
            <table className="w-full min-w-[1000px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className={dataTableStickyTh("whitespace-nowrap")}>Transaction ID</th>
                  <th className={dataTableStickyTh("whitespace-nowrap")}>Timestamp</th>
                  <th className={dataTableStickyTh("whitespace-nowrap")}>Username</th>
                  <th className={dataTableStickyTh("whitespace-nowrap")}>Subscriber</th>
                  <th className={dataTableStickyTh("whitespace-nowrap")}>Type</th>
                  <th className={dataTableStickyTh("whitespace-nowrap")}>Amount</th>
                  <th className={dataTableStickyTh("whitespace-nowrap")}>Periods</th>
                  <th className={dataTableStickyTh("whitespace-nowrap")}>Coverage</th>
                  <th className={dataTableStickyTh()}>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r, i) => (
                  <tr key={`${r.transaction}-${i}`} className="border-b border-border/60 transition-colors hover:bg-primary/5 dark:hover:bg-muted/35">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-foreground">TXN-{padTxnId(r.transaction)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{dash(r.timestamp)}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{dash(r.created_by ?? r.username)}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{dash(r.account)}</td>
                    <td className="px-3 py-2">{typeBadge(r.type)}</td>
                    <td className="whitespace-nowrap px-3 py-2">{amountCell(r)}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono tabular-nums">{monthsCell(r.type, r.free_month)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-foreground">
                      {r.coverage_start || r.coverage_end ? (
                        <>
                          {dash(r.coverage_start)} <span className="text-muted-foreground">→</span> {dash(r.coverage_end)}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td
                      className="max-w-[280px] truncate px-3 py-2 text-foreground"
                      title={formatTransactionRemarksForDisplay(r.remarks) || undefined}
                    >
                      {dash(formatTransactionRemarksForDisplay(r.remarks))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/30 font-medium">
                  <td className="px-3 py-2 text-muted-foreground">{filteredRows.length} rows</td>
                  <td className="px-3 py-2" colSpan={5} />
                  <td className="whitespace-nowrap px-3 py-2 font-mono tabular-nums text-foreground">
                    Σ credits <span className="text-primary">{totalCreditsFooter}</span>
                  </td>
                  <td className="px-3 py-2" colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

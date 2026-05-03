"use client";

import { useId, useMemo, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardDayCreditPoint, DashboardMonthPoint } from "@/lib/repos/billing";
import type { StatusSlice } from "@/components/dashboard/dashboard-status";

const MOTION = {
  isAnimationActive: true,
  animationDuration: 1100,
  animationEasing: "ease-out" as const,
};

function ChartCard({
  title,
  description,
  heightClass,
  children,
}: {
  title: string;
  description: string;
  heightClass: string;
  children: ReactNode;
}) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card/95 shadow-sm ring-1 ring-black/[0.04] dark:bg-card dark:ring-white/[0.06]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.45] dark:opacity-100"
        style={{
          background:
            "radial-gradient(1200px 200px at 50% -20%, rgba(6, 182, 212, 0.14), transparent 55%), radial-gradient(800px 160px at 100% 0%, rgba(139, 92, 246, 0.06), transparent 50%)",
        }}
        aria-hidden
      />
      <div className="relative p-5 sm:p-6">
        <div className="mb-1 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
            <p className="mt-0.5 max-w-prose text-xs leading-relaxed text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className={`mt-4 w-full min-w-0 shrink-0 ${heightClass}`}>{children}</div>
      </div>
    </div>
  );
}

type TooltipContentProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: unknown; name?: unknown; color?: string }>;
  label?: string | number;
};

function GrowthTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0];
  const v = Number(row?.value ?? 0);
  return (
    <div className="rounded-lg border border-border/80 bg-popover/95 px-3 py-2.5 text-xs shadow-lg backdrop-blur-md">
      <p className="mb-1.5 font-medium text-muted-foreground">{label != null ? String(label) : ""}</p>
      <p className="text-lg font-semibold tabular-nums tracking-tight text-foreground">{v}</p>
      <p className="text-[11px] text-muted-foreground">New accounts this month</p>
    </div>
  );
}

function FlowTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/80 bg-popover/95 px-3 py-2.5 text-xs shadow-lg backdrop-blur-md">
      <p className="mb-2 font-medium text-muted-foreground">{label != null ? String(label) : ""}</p>
      <div className="space-y-1.5">
        {payload.map((entry, i) => (
          <div key={`${String(entry.name)}-${i}`} className="flex items-center justify-between gap-8 tabular-nums">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name != null ? String(entry.name) : ""}
            </span>
            <span className="font-semibold text-foreground">{Number(entry.value ?? 0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PieTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0] as { name?: unknown; value?: unknown; payload?: { total?: number } };
  const name = String(p.name ?? "");
  const v = Number(p.value ?? 0);
  const total = typeof p.payload?.total === "number" ? p.payload.total : null;
  const pct = total && total > 0 ? Math.round((v / total) * 100) : null;
  return (
    <div className="rounded-lg border border-border/80 bg-popover/95 px-3 py-2.5 text-xs shadow-lg backdrop-blur-md">
      <p className="mb-1 font-medium text-foreground">{name}</p>
      <p className="text-lg font-semibold tabular-nums text-foreground">{v}</p>
      {pct != null ? <p className="mt-0.5 text-[11px] text-muted-foreground">{pct}% of subscribers shown</p> : null}
    </div>
  );
}

const AXIS_TICK = { fill: "hsl(215 16% 52%)", fontSize: 11, fontWeight: 500 as const };

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/15 text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export function SubscriberGrowthChart({ data, title }: { data: DashboardMonthPoint[]; title: string }) {
  const uid = useId().replace(/:/g, "");
  const gradArea = `growthArea-${uid}`;
  const gradLine = `growthLine-${uid}`;

  if (!data.length) return <EmptyChart label="No signup history for this range." />;
  const hasSignal = data.some((d) => d.count > 0);
  if (!hasSignal) return <EmptyChart label="No new subscribers in the last few months." />;

  return (
    <ChartCard
      title={title}
      description="Monthly new accounts from billing (smoothed curve + area fill)."
      heightClass="h-[280px] min-h-[280px]"
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        minWidth={0}
        minHeight={280}
        debounce={32}
        initialDimension={{ width: 640, height: 280 }}
      >
        <ComposedChart data={data} margin={{ top: 12, right: 12, left: 4, bottom: 4 }}>
          <defs>
            <linearGradient id={gradArea} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00f0ff" stopOpacity={0.55} />
              <stop offset="55%" stopColor="#00f0ff" stopOpacity={0.15} />
              <stop offset="100%" stopColor="#00f0ff" stopOpacity={0} />
            </linearGradient>
            <linearGradient id={gradLine} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#00f0ff" />
              <stop offset="100%" stopColor="#22ff88" />
            </linearGradient>
            <filter id={`glow-${gradArea}`} x="-20%" y="-30%" width="140%" height="160%">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <CartesianGrid strokeDasharray="3 6" stroke="hsl(217 19% 27%)" strokeOpacity={0.55} vertical={false} />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: "hsl(217 19% 30%)", strokeOpacity: 0.8 }}
            tickMargin={10}
            interval="preserveStartEnd"
          />
          <YAxis
            width={42}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            tickMargin={8}
          />
          <Tooltip
            content={<GrowthTooltip />}
            cursor={{ fill: "rgb(148 163 184 / 0.05)", stroke: "transparent" }}
            animationDuration={200}
          />
          <Area
            type="monotone"
            dataKey="count"
            name="New accounts"
            stroke="transparent"
            strokeWidth={0}
            fill={`url(#${gradArea})`}
            fillOpacity={1}
            {...MOTION}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke={`url(#${gradLine})`}
            strokeWidth={2.75}
            dot={false}
            activeDot={{
              r: 6,
              strokeWidth: 2,
              stroke: "rgba(0,245,255,0.35)",
              fill: "#00f0ff",
            }}
            filter={`url(#glow-${gradArea})`}
            {...MOTION}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function CreditFlowBarChart({ data, title }: { data: DashboardDayCreditPoint[]; title: string }) {
  const uid = useId().replace(/:/g, "");
  const gIn = `flowIn-${uid}`;
  const gOut = `flowOut-${uid}`;

  const chartData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        tick: new Date(d.key + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      })),
    [data],
  );

  if (!chartData.length) return <EmptyChart label="No credit activity for this range." />;
  const hasSignal = chartData.some((d) => d.creditIn > 0 || d.creditOut > 0);
  if (!hasSignal) return <EmptyChart label="No credit movements in this window." />;

  return (
    <ChartCard
      title={title}
      description="Stacked daily volume: credits received vs spent (absolute periods)."
      heightClass="h-[300px] min-h-[300px]"
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        minWidth={0}
        minHeight={300}
        debounce={32}
        initialDimension={{ width: 640, height: 300 }}
      >
        <AreaChart data={chartData} margin={{ top: 12, right: 16, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id={gIn} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00f0ff" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#00f0ff" stopOpacity={0.30} />
            </linearGradient>
            <linearGradient id={gOut} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff00aa" stopOpacity={0.92} />
              <stop offset="100%" stopColor="#c026d3" stopOpacity={0.45} />
            </linearGradient>
            <filter id={`glow-${gIn}`} x="-20%" y="-30%" width="140%" height="160%">
              <feGaussianBlur stdDeviation="2.5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <CartesianGrid strokeDasharray="3 6" stroke="hsl(217 19% 27%)" strokeOpacity={0.55} vertical={false} />
          <XAxis
            dataKey="tick"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: "hsl(217 19% 30%)", strokeOpacity: 0.8 }}
            tickMargin={10}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis width={44} tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} tickMargin={8} />
          <Tooltip content={<FlowTooltip />} cursor={{ fill: "rgb(148 163 184 / 0.05)", stroke: "transparent" }} />
          <Legend
            verticalAlign="top"
            align="right"
            wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
            formatter={(value) => <span className="text-muted-foreground">{String(value)}</span>}
          />
          <Area
            type="monotone"
            dataKey="creditIn"
            name="Credits in"
            stackId="flow"
            stroke="#00f0ff"
            strokeWidth={1.75}
            fill={`url(#${gIn})`}
            filter={`url(#glow-${gIn})`}
            {...MOTION}
          />
          <Area
            type="monotone"
            dataKey="creditOut"
            name="Credits out"
            stackId="flow"
            stroke="#ff00aa"
            strokeWidth={1.75}
            fill={`url(#${gOut})`}
            filter={`url(#glow-${gIn})`}
            {...MOTION}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function StatusMixPieChart({ data, title }: { data: StatusSlice[]; title: string }) {
  const filtered = data.filter((d) => d.value > 0);
  if (!filtered.length) return <EmptyChart label="No subscriber status data." />;

  const total = filtered.reduce((s, d) => s + d.value, 0);
  const pieData = filtered.map((d) => ({ ...d, total }));

  return (
    <ChartCard title={title} description="Share of subscribers by billing state." heightClass="h-[280px] min-h-[280px]">
      <ResponsiveContainer
        width="100%"
        height="100%"
        minWidth={0}
        minHeight={280}
        debounce={32}
        initialDimension={{ width: 640, height: 280 }}
      >
        <PieChart>
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="48%"
            innerRadius="52%"
            outerRadius="78%"
            paddingAngle={2.5}
            cornerRadius={6}
            {...MOTION}
          >
            {pieData.map((entry) => (
              <Cell
                key={entry.name}
                fill={entry.color}
                stroke="hsl(222 47% 11%)"
                strokeWidth={2}
                style={{
                  filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.18))",
                  outline: "none",
                }}
              />
            ))}
          </Pie>
          <Tooltip content={<PieTooltip />} />
          <Legend
            layout="horizontal"
            verticalAlign="bottom"
            align="center"
            wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
            formatter={(value) => <span className="text-muted-foreground">{String(value)}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

const iconTone = {
  cyan: "bg-primary/12 text-primary ring-1 ring-primary/25",
  emerald: "bg-emerald-500/12 text-emerald-300 ring-1 ring-emerald-500/25",
  rose: "bg-rose-500/12 text-rose-300 ring-1 ring-rose-500/25",
  amber: "bg-amber-500/12 text-amber-300 ring-1 ring-amber-500/25",
  violet: "bg-violet-500/12 text-violet-300 ring-1 ring-violet-500/25",
  slate: "bg-muted/70 text-muted-foreground ring-1 ring-border/60",
} as const;

export function DashboardKpiCard({
  title,
  value,
  icon: Icon,
  href,
  trend,
  statusCharts,
  metricsHint,
  tone = "cyan",
  className,
}: {
  title: string;
  value: string | number;
  icon: LucideIcon;
  href?: string;
  /** e.g. "+12% vs last month" — green if starts with +, red if starts with − */
  trend?: string;
  /** Shown under the main value when `statusCharts` exist (default: "Status overview"). */
  metricsHint?: string;
  statusCharts?: Array<{
    title: string;
    total: number;
    /** Clicking the panel (outside segment shortcuts) navigates here. */
    panelHref?: string;
    /**
     * When set, segment shortcuts use this grid (e.g. tickets: `grid grid-cols-2 …` → 2×2).
     * Each cell stays one row: dot + label (left, truncates) · count + arrow (right), same as Team hierarchy shortcuts.
     */
    segmentGridClassName?: string;
    segments: Array<{
      label: string;
      value: number;
      color: string;
      dotClassName: string;
      href?: string;
    }>;
  }>;
  tone?: keyof typeof iconTone;
  className?: string;
}) {
  const trendPositive = trend?.trim().startsWith("+");
  const trendNegative = trend?.trim().startsWith("−") || trend?.trim().startsWith("-");
  const hasStatusCharts = Boolean(statusCharts && statusCharts.length > 0);
  const hintLine = hasStatusCharts ? (metricsHint ?? "Status overview") : null;

  const inner = (
    <div
      className={cn(
        "dashboard-kpi-surface group/card group relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/95 p-4 shadow-sm ring-1 ring-black/[0.04] transition-[box-shadow,border-color,background-color] duration-200 ease-out dark:ring-white/[0.06] sm:p-5",
        "before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/[0.03] before:to-transparent before:opacity-100 before:content-['']",
        /** With a card-level `href`, skip hit-testing on chrome so the underlay `Link` receives clicks. */
        href && "pointer-events-none",
        !href && "motion-safe:hover:border-primary/30 motion-safe:hover:shadow-md",
      )}
    >
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-[1.75rem]">{value}</p>
          {hintLine ? (
            <p className="mt-2 min-h-[1.25rem] text-[11px] leading-snug text-muted-foreground">{hintLine}</p>
          ) : trend ? (
            <p
              className={cn(
                "mt-1.5 min-h-[1.25rem] text-[11px] font-medium tabular-nums leading-5",
                trendPositive && "text-emerald-400",
                trendNegative && "text-rose-400",
                !trendPositive && !trendNegative && "text-muted-foreground",
              )}
            >
              {trend}
            </p>
          ) : (
            <p className="mt-1.5 min-h-[1.25rem] text-[11px] text-muted-foreground/70">Updated just now</p>
          )}
        </div>
        <div
          className={cn(
            "fx-icon-3d flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 motion-safe:group-hover:scale-[1.05] motion-safe:group-hover:rotate-3 sm:h-11 sm:w-11",
            iconTone[tone],
          )}
          aria-hidden
        >
          <Icon className="h-[1.125rem] w-[1.125rem] sm:h-5 sm:w-5" strokeWidth={1.75} />
        </div>
      </div>
      {statusCharts && statusCharts.length > 0 ? (
        <div
          className={cn(
            /** Re-enable hit-testing: parent `.pointer-events-none` (card `href`) inherits through otherwise, so only shortcut rows worked and everything else fell through to the full-card link. */
            "pointer-events-auto mt-4 grid min-h-0 flex-1 grid-cols-1 gap-3 items-stretch",
            statusCharts.length > 1 && "md:grid-cols-2",
          )}
        >
          {statusCharts.map((chart) => {
            const segmentCellsCompact = Boolean(chart.segmentGridClassName);
            return (
              <div
                key={chart.title}
                className={cn(
                  "kpi-chart-panel pointer-events-auto relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border/50 bg-background/35 p-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] transition-[border-color,box-shadow,background-color] duration-200 dark:bg-background/25",
                  chart.panelHref && "cursor-pointer",
                  "motion-safe:hover:border-primary/45 motion-safe:hover:bg-background/55 motion-safe:hover:shadow-sm",
                  "motion-safe:group-hover/card:border-border/75 motion-safe:group-hover/card:bg-background/48",
                )}
              >
                {chart.panelHref ? (
                  <Link
                    href={chart.panelHref}
                    aria-label={`${chart.title}: open overview`}
                    className="absolute inset-0 z-[2] rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-0"
                    tabIndex={-1}
                  />
                ) : null}
                <div
                  className={cn(
                    "relative z-[3] flex min-h-0 flex-1 flex-col",
                    chart.panelHref && "pointer-events-none",
                  )}
                >
                  <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/70">{chart.title}</p>
                  <div className="flex min-h-0 flex-1 flex-col items-stretch gap-3 min-[360px]:flex-row min-[360px]:items-start">
                    <div
                      className="relative mx-auto h-[3.25rem] w-[3.25rem] shrink-0 rounded-full p-[5px] min-[360px]:mx-0"
                      style={{ background: buildDonutGradient(chart.total, chart.segments) }}
                    >
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-card text-[10px] font-semibold tabular-nums text-foreground ring-1 ring-border/40">
                        {formatCompact(chart.total)}
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Shortcuts</p>
                      {chart.panelHref ? (
                        <Link
                          href={chart.panelHref}
                          aria-label={`${chart.title}: open full breakdown (${formatFull(chart.total)} total)`}
                          className="pointer-events-auto relative z-[5] -mx-0.5 inline-flex w-full items-center justify-between gap-2 rounded-md border-b border-border/30 px-0.5 pb-1.5 text-[10px] font-medium leading-4 text-muted-foreground transition motion-safe:hover:bg-primary/10 motion-safe:hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                        >
                          <span>Total</span>
                          <span className="inline-flex items-center gap-1 tabular-nums text-foreground">
                            {formatFull(chart.total)}
                            <ArrowUpRight className="h-3 w-3 shrink-0 text-muted-foreground opacity-70" aria-hidden />
                          </span>
                        </Link>
                      ) : (
                        <span className="inline-flex items-center justify-between gap-2 border-b border-border/30 pb-1.5 text-[10px] font-medium leading-4 text-muted-foreground">
                          <span>Total</span>
                          <span className="tabular-nums text-foreground">{formatFull(chart.total)}</span>
                        </span>
                      )}
                      <div
                        className={cn(
                          chart.segmentGridClassName ?? "flex flex-col gap-1.5",
                          segmentCellsCompact && "min-h-0 auto-rows-fr items-stretch",
                        )}
                      >
                        {chart.segments.map((segment) =>
                          segment.href ? (
                            <Link
                              key={`${chart.title}-${segment.label}`}
                              href={segment.href}
                              className={cn(
                                "pointer-events-auto relative z-[6] rounded-lg border border-border/50 bg-muted/15 px-2.5 py-2 text-[10px] font-medium leading-snug text-foreground transition motion-safe:hover:border-primary/45 motion-safe:hover:bg-primary/12 motion-safe:hover:shadow-sm motion-safe:hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                                segmentCellsCompact
                                  ? "group flex h-full min-h-0 min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 sm:flex-nowrap"
                                  : "flex flex-wrap items-center justify-between gap-x-2 gap-y-1 py-1.5",
                              )}
                              title={`Open filtered list: ${segment.label}`}
                            >
                              <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", segment.dotClassName)} aria-hidden />
                                <span className={cn(segmentCellsCompact ? "truncate" : "min-w-0 flex-1 break-words")}>
                                  {segment.label}
                                </span>
                              </span>
                              <span className="inline-flex shrink-0 items-center gap-1 tabular-nums">
                                {formatFull(segment.value)} ({formatPercent(segment.value, chart.total)})
                                <ArrowUpRight className="h-3 w-3 shrink-0 text-muted-foreground opacity-80 transition-colors group-hover:text-primary" aria-hidden />
                              </span>
                            </Link>
                          ) : (
                            <span
                              key={`${chart.title}-${segment.label}`}
                              className={cn(
                                "text-[10px] font-medium leading-snug",
                                segmentCellsCompact
                                  ? "flex h-full min-h-0 min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-lg border border-border/50 bg-muted/15 px-2.5 py-2 text-foreground sm:flex-nowrap"
                                  : "flex flex-wrap items-center justify-between gap-x-2 gap-y-1 py-1.5 text-muted-foreground",
                              )}
                            >
                              <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", segment.dotClassName)} aria-hidden />
                                <span className={cn(segmentCellsCompact ? "truncate" : "min-w-0 flex-1 break-words")}>
                                  {segment.label}
                                </span>
                              </span>
                              <span className="shrink-0 tabular-nums text-foreground">
                                {formatFull(segment.value)} ({formatPercent(segment.value, chart.total)})
                              </span>
                            </span>
                          ),
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="min-h-0 flex-1" aria-hidden />
      )}
    </div>
  );

  if (href) {
    return (
      <div className={cn("relative block h-full min-h-0", className)}>
        <Link
          href={href}
          aria-label={`Open ${title}`}
          className="peer absolute inset-0 z-[1] rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
        {/**
         * Wrapper must not capture hits — otherwise it blocks the underlay `Link`.
         * `peer` + `peer-hover:` styles the visible card when the hit target is the underlay (any “empty” area).
         * Chart / shortcut `Link`s use `pointer-events-auto` so they stay clickable.
         */}
        <div className="pointer-events-none relative z-[2] h-full min-h-0 peer-hover:[&_.dashboard-kpi-surface]:border-primary/35 peer-hover:[&_.dashboard-kpi-surface]:shadow-lg peer-hover:[&_.kpi-chart-panel]:border-primary/40 peer-hover:[&_.kpi-chart-panel]:bg-background/55">
          {inner}
        </div>
      </div>
    );
  }

  return <div className={cn("h-full min-h-0", className)}>{inner}</div>;
}

function buildDonutGradient(
  total: number,
  segments: Array<{ label: string; value: number; color: string; dotClassName: string }>,
) {
  const safeTotal = Math.max(0, total);
  if (safeTotal <= 0) return "conic-gradient(rgb(100 116 139 / 0.35) 0% 100%)";
  let offset = 0;
  const parts = segments
    .filter((segment) => segment.value > 0)
    .map((segment) => {
      const pct = (Math.max(0, segment.value) / safeTotal) * 100;
      const start = offset;
      offset += pct;
      return `${segment.color} ${start}% ${offset}%`;
    });
  if (offset < 100) {
    parts.push(`rgb(100 116 139 / 0.25) ${offset}% 100%`);
  }
  if (parts.length === 0) return "conic-gradient(rgb(100 116 139 / 0.35) 0% 100%)";
  return `conic-gradient(${parts.join(", ")})`;
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatFull(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.max(0, value));
}

function formatPercent(part: number, total: number) {
  if (total <= 0) return "0%";
  return `${Math.round((Math.max(0, part) / total) * 100)}%`;
}

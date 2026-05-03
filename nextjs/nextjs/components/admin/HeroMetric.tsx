"use client";

import { m } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { NeonStat } from "@/components/hud/NeonStat";
import { cn } from "@/lib/cn";

type Tone = "cyan" | "magenta" | "violet" | "green" | "gold";

const RING_TONE: Record<Tone, string> = {
  cyan: "stroke-[color:var(--neon-cyan)]",
  magenta: "stroke-[color:var(--neon-magenta)]",
  violet: "stroke-[color:var(--neon-violet)]",
  green: "stroke-[color:var(--neon-green)]",
  gold: "stroke-[color:var(--neon-gold)]",
};

const PILL_TONE: Record<Tone, string> = {
  cyan: "border-cyan-400/35 bg-cyan-500/[0.08] text-cyan-200",
  magenta: "border-pink-400/35 bg-pink-500/[0.08] text-pink-200",
  violet: "border-fuchsia-400/35 bg-fuchsia-500/[0.08] text-fuchsia-200",
  green: "border-emerald-400/35 bg-emerald-500/[0.08] text-emerald-200",
  gold: "border-amber-300/35 bg-amber-400/[0.08] text-amber-200",
};

/**
 * Centerpiece KPI — giant breathing number behind two slowly-counter-rotating
 * dashed rings (the "orbit"). Pure SVG + CSS keyframes; no JS animation loop.
 */
/**
 * Format hint passed from a Server Component. Functions cannot cross the
 * RSC → Client boundary, so we accept a serializable string discriminator
 * and apply the matching formatter inside the client tree.
 */
type FormatHint = "int" | "money" | "percent" | "raw";

const FMT: Record<FormatHint, (n: number) => string> = {
  int: (n) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n),
  money: (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n),
  percent: (n) => `${n.toFixed(1)}%`,
  raw: (n) => String(n),
};

export function HeroMetric({
  label,
  value,
  format = "int",
  unit,
  trendLabel,
  tone = "cyan",
  icon: Icon,
  className,
}: {
  label: string;
  value: number;
  format?: FormatHint;
  unit?: string;
  trendLabel?: string;
  tone?: Tone;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <m.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={cn("fx-hud relative isolate flex flex-col items-center justify-center gap-3 overflow-hidden p-6 sm:p-8", className)}
    >
      {/* Two orbiting dashed rings (counter-rotating) */}
      <svg
        aria-hidden
        viewBox="0 0 200 200"
        className="pointer-events-none absolute inset-0 -z-10 m-auto h-[min(80%,16rem)] w-[min(80%,16rem)]"
      >
        <g className="origin-center fx-ring-orbit">
          <circle cx="100" cy="100" r="92" className={cn("fill-none", RING_TONE[tone])} strokeWidth="1" strokeDasharray="3 6" opacity="0.55" />
        </g>
        <g className="origin-center fx-ring-orbit" style={{ animationDirection: "reverse", animationDuration: "22s" }}>
          <circle cx="100" cy="100" r="78" className={cn("fill-none", RING_TONE[tone])} strokeWidth="1" strokeDasharray="2 10" opacity="0.35" />
        </g>
        <circle cx="100" cy="100" r="64" className={cn("fill-none", RING_TONE[tone])} strokeWidth="0.6" opacity="0.25" />
      </svg>

      {/* Soft radial glow behind the value */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 m-auto h-3/5 w-3/5 rounded-full blur-3xl"
        style={{
          background: `radial-gradient(closest-side, color-mix(in oklab, var(${{
            cyan: "--neon-cyan",
            magenta: "--neon-magenta",
            violet: "--neon-violet",
            green: "--neon-green",
            gold: "--neon-gold",
          }[tone]}) 28%, transparent), transparent 70%)`,
        }}
      />

      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em]",
          PILL_TONE[tone],
        )}
      >
        {Icon ? <Icon className="h-3 w-3" aria-hidden /> : null}
        {label}
      </span>

      <div className="fx-breath flex items-baseline justify-center gap-2">
        <NeonStat value={value} format={FMT[format]} tone={tone} className="text-[clamp(3rem,8vw,5.25rem)] leading-none" duration={1100} />
        {unit ? <span className="text-xl font-bold text-muted-foreground">{unit}</span> : null}
      </div>

      {trendLabel ? <p className="text-xs text-muted-foreground">{trendLabel}</p> : null}
    </m.div>
  );
}

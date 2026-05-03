"use client";

import Link from "next/link";
import { m } from "framer-motion";
import {
  ArrowUpRight,
  Banknote,
  CircleDollarSign,
  Cpu,
  Gauge,
  type LucideIcon,
  Ticket,
  TrendingUp,
  UserPlus,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react";
import { NeonStat } from "@/components/hud/NeonStat";
import { CornerBrackets } from "@/components/hud/CornerBracket";
import { cn } from "@/lib/cn";

type Tone = "cyan" | "magenta" | "violet" | "green" | "gold";

/**
 * Icon registry — server passes a string key, client looks up the actual component.
 * This avoids the RSC serialization failure that happens when component references
 * are nested inside an array of plain objects passed across the boundary.
 */
export type IconId = "wallet" | "users" | "user-plus" | "users-round" | "ticket" | "banknote" | "credit" | "trending" | "gauge" | "cpu";
const ICONS: Record<IconId, LucideIcon> = {
  wallet: Wallet,
  users: Users,
  "user-plus": UserPlus,
  "users-round": UsersRound,
  ticket: Ticket,
  banknote: Banknote,
  credit: CircleDollarSign,
  trending: TrendingUp,
  gauge: Gauge,
  cpu: Cpu,
};

/** Serializable format hint — replaces a function prop so the array can cross the RSC → client boundary. */
type FormatHint = "int" | "money" | "percent" | "raw";
const FMT: Record<FormatHint, (n: number) => string> = {
  int: (n) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n),
  money: (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n),
  percent: (n) => `${n.toFixed(1)}%`,
  raw: (n) => String(n),
};

const TILE_TONE: Record<Tone, { ring: string; icon: string; bracket: string; bg: string }> = {
  cyan: { ring: "ring-cyan-400/25", icon: "text-cyan-300", bracket: "text-cyan-400/70", bg: "bg-cyan-500/[0.05]" },
  magenta: { ring: "ring-pink-400/25", icon: "text-pink-300", bracket: "text-pink-400/70", bg: "bg-pink-500/[0.05]" },
  violet: { ring: "ring-fuchsia-400/25", icon: "text-fuchsia-300", bracket: "text-fuchsia-400/70", bg: "bg-fuchsia-500/[0.05]" },
  green: { ring: "ring-emerald-400/25", icon: "text-emerald-300", bracket: "text-emerald-400/70", bg: "bg-emerald-500/[0.05]" },
  gold: { ring: "ring-amber-300/25", icon: "text-amber-300", bracket: "text-amber-400/70", bg: "bg-amber-500/[0.05]" },
};

export type Metric = {
  label: string;
  value: number;
  format?: FormatHint;
  hint?: string;
  tone: Tone;
  icon: IconId;
  href?: string;
};

/**
 * 3-up satellite KPI strip rendered as four animated holographic tiles. Each tile:
 *   - lifts on hover (framer-motion `whileHover`)
 *   - count-up animates the value on mount via `NeonStat`
 *   - shows L-bracket HUD corner markers for cyberpunk flair
 */
export function MetricsConstellation({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((mItem, idx) => {
        const Icon = ICONS[mItem.icon] ?? Users;
        const tone = TILE_TONE[mItem.tone];
        const Inner = (
          <m.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: idx * 0.07, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -4, transition: { duration: 0.18 } }}
            className={cn(
              "fx-hud fx-hud-corners relative h-full p-4 sm:p-5",
              tone.bg,
            )}
          >
            <CornerBrackets className={tone.bracket} />
            <div className="flex items-start justify-between gap-2">
              <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-md ring-1", tone.ring, tone.icon, "bg-card/40")}>
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              {mItem.href ? (
                <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden />
              ) : null}
            </div>
            <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{mItem.label}</p>
            <div className="mt-1">
              <NeonStat value={mItem.value} format={FMT[mItem.format ?? "int"]} tone={mItem.tone} className="text-2xl sm:text-3xl" />
            </div>
            {mItem.hint ? <p className="mt-1.5 text-[11px] text-muted-foreground">{mItem.hint}</p> : null}
          </m.div>
        );
        return mItem.href ? (
          <Link key={mItem.label} href={mItem.href} className="group block focus-visible:outline-none">
            {Inner}
          </Link>
        ) : (
          <div key={mItem.label}>{Inner}</div>
        );
      })}
    </div>
  );
}

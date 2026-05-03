"use client";

import { ArrowUpRight, Banknote, ShieldCheck, Ticket, Users } from "lucide-react";
import Link from "next/link";
import { m } from "framer-motion";
import { HudCard } from "@/components/hud/HudCard";
import { NeonBadge } from "@/components/hud/NeonBadge";
import { NeonStat } from "@/components/hud/NeonStat";
import { cn } from "@/lib/cn";

type ActivityRow = {
  id: string;
  primary: string;
  secondary: string;
  whenLabel: string;
  href?: string;
};

type StatTile = {
  label: string;
  value: number | string;
  hint?: string;
  tone: "cyan" | "magenta" | "violet" | "green" | "gold";
  icon: typeof Users;
};

/**
 * Admin context rail — adopts the Freepik template's right-side profile column
 * (avatar / name / big balance / 3 stat tiles / recent activity) in our cyberpunk theme.
 * Pure presentation; data is passed in by the dashboard page.
 */
export function UserContextRail({
  name,
  role,
  walletCredits,
  totalSubscribers,
  activeSubscribers,
  openTickets,
  recentActivity,
  className,
}: {
  name: string;
  role: string;
  walletCredits: number;
  totalSubscribers: number;
  activeSubscribers: number;
  openTickets: number;
  recentActivity: ActivityRow[];
  className?: string;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "A";

  const tiles: StatTile[] = [
    { label: "Subscribers", value: totalSubscribers, hint: "Total accounts", tone: "cyan", icon: Users },
    { label: "Active", value: activeSubscribers, hint: "Currently online", tone: "green", icon: ShieldCheck },
    { label: "Tickets", value: openTickets, hint: "In-progress queue", tone: "magenta", icon: Ticket },
  ];

  return (
    <aside className={cn("flex flex-col gap-4", className)} aria-labelledby="rail-heading">
      <h2 id="rail-heading" className="sr-only">Operator context</h2>

      <HudCard tone="cyan" className="p-5" motionIndex={0} brackets>
        <div className="flex items-center gap-3">
          <m.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="fx-ring-grad relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-card/70 text-2xl font-bold text-primary shadow-lg shadow-primary/20"
            aria-hidden
          >
            {initial}
          </m.div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">{name}</p>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 fx-pulse-dot" aria-hidden />
              {role} — Online
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-baseline justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Wallet credits</p>
            <NeonStat value={walletCredits} tone="gold" className="text-3xl" />
          </div>
          <Link
            href="/admin/transactions"
            className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
          >
            Ledger
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </HudCard>

      <div className="grid grid-cols-1 gap-3">
        {tiles.map((t, i) => {
          const Icon = t.icon;
          return (
            <HudCard key={t.label} tone={t.tone} className="p-3.5" motionIndex={i + 1}>
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-md ring-1",
                    t.tone === "cyan" && "bg-cyan-500/10 text-cyan-300 ring-cyan-400/30",
                    t.tone === "green" && "bg-emerald-500/10 text-emerald-300 ring-emerald-400/30",
                    t.tone === "magenta" && "bg-pink-500/10 text-pink-300 ring-pink-400/30",
                    t.tone === "violet" && "bg-fuchsia-500/10 text-fuchsia-300 ring-fuchsia-400/30",
                    t.tone === "gold" && "bg-amber-400/10 text-amber-300 ring-amber-400/30",
                  )}
                  aria-hidden
                >
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t.label}</p>
                  <NeonStat value={typeof t.value === "number" ? t.value : 0} tone={t.tone} className="text-lg" />
                </div>
              </div>
              {t.hint ? <p className="mt-1.5 text-[11px] text-muted-foreground">{t.hint}</p> : null}
            </HudCard>
          );
        })}
      </div>

      <HudCard tone="violet" className="p-4" motionIndex={4}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Recent activity</p>
          <NeonBadge tone="violet" pulse>
            <Banknote className="h-3 w-3" aria-hidden /> live
          </NeonBadge>
        </div>
        {recentActivity.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted-foreground">No recent activity.</p>
        ) : (
          <ul className="space-y-3">
            {recentActivity.slice(0, 4).map((row) => (
              <li key={row.id} className="flex items-start gap-3">
                <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary fx-glow-dot" aria-hidden />
                <div className="min-w-0 flex-1">
                  {row.href ? (
                    <Link
                      href={row.href}
                      className="block truncate text-sm font-medium text-foreground transition-colors hover:text-primary"
                    >
                      {row.primary}
                    </Link>
                  ) : (
                    <p className="truncate text-sm font-medium text-foreground">{row.primary}</p>
                  )}
                  <p className="truncate text-[11px] text-muted-foreground">
                    {row.secondary}
                    <span className="text-muted-foreground/70"> · {row.whenLabel}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </HudCard>
    </aside>
  );
}

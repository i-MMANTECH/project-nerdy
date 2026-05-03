import { Activity, Banknote, ShieldCheck, TicketCheck, Users } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Slim live-status header strip rendered above the dashboard greeting.
 *
 * Pure server component — no `"use client"`, no hooks, no event handlers.
 * Numbers come pre-formatted as strings so we never cross the RSC boundary
 * with a function or component reference (a class of bug we hit before).
 *
 * Visual: glass surface with five segmented "readouts" separated by neon
 * dividers, a pulsing LIVE dot on the left, and a slow-shifting gradient
 * underline that subtly signals "system online".
 */

type Segment = {
  label: string;
  value: string;
  tone: "cyan" | "magenta" | "green" | "gold" | "violet";
  icon: "activity" | "users" | "shield" | "ticket" | "money";
};

/** String-keyed icon registry — keeps server payload serializable. */
const ICONS = {
  activity: Activity,
  users: Users,
  shield: ShieldCheck,
  ticket: TicketCheck,
  money: Banknote,
} as const;

const TONE_TEXT = {
  cyan: "text-cyan-300",
  magenta: "text-pink-300",
  green: "text-emerald-300",
  gold: "text-amber-300",
  violet: "text-fuchsia-300",
} as const;

const TONE_DOT = {
  cyan: "bg-cyan-400",
  magenta: "bg-pink-400",
  green: "bg-emerald-400",
  gold: "bg-amber-400",
  violet: "bg-fuchsia-400",
} as const;

export function SystemStatusStrip({ segments, lastSyncLabel }: { segments: Segment[]; lastSyncLabel?: string }) {
  return (
    <div className="fx-rise relative overflow-hidden rounded-xl border border-border/60 bg-card/60 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 sm:px-5">
        <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-rose-300">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-rose-400/70" />
            <span className="relative inline-block h-2 w-2 rounded-full bg-rose-400" />
          </span>
          Live
        </span>

        <ul className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
          {segments.map((seg, i) => {
            const Icon = ICONS[seg.icon];
            return (
              <li key={`${seg.label}-${i}`} className="inline-flex items-center gap-2">
                <span className={cn("inline-flex h-1.5 w-1.5 shrink-0 rounded-full", TONE_DOT[seg.tone])} aria-hidden />
                <Icon className={cn("h-3.5 w-3.5", TONE_TEXT[seg.tone])} aria-hidden />
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{seg.label}</span>
                <span className={cn("fx-segmented font-mono font-semibold tabular-nums", TONE_TEXT[seg.tone])}>{seg.value}</span>
              </li>
            );
          })}
        </ul>

        {lastSyncLabel ? (
          <span className="ml-auto text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
            {lastSyncLabel}
          </span>
        ) : null}
      </div>
      <div className="fx-progress-bar absolute inset-x-0 bottom-0 h-px opacity-70" aria-hidden />
    </div>
  );
}

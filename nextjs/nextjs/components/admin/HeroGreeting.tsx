"use client";

import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

type Period = "today" | "7d" | "30d" | "all";

const PERIOD_LABEL: Record<Period, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  all: "All time",
};

/**
 * Dashboard hero — adopts the Freepik template's greeting + filter pill structure,
 * rendered in our cyberpunk theme (gradient name, gold filter pill, glow ring).
 * Period is local state for now; wire up downstream when the rest of the page can react to it.
 */
export function HeroGreeting({
  name,
  subtitle = "Here's the live operations report.",
  defaultPeriod = "30d",
  onPeriodChange,
}: {
  name: string;
  subtitle?: string;
  defaultPeriod?: Period;
  onPeriodChange?: (p: Period) => void;
}) {
  const [period, setPeriod] = useState<Period>(defaultPeriod);
  const [open, setOpen] = useState(false);

  return (
    <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between" aria-labelledby="dash-hero">
      <div className="space-y-1.5">
        <h1 id="dash-hero" className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold leading-tight tracking-tight">
          <span className="text-foreground">Hi </span>
          <span className="fx-text-grad">{name}!</span>
        </h1>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
          {subtitle}
        </p>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "fx-neon-outline inline-flex h-10 items-center gap-2 rounded-full bg-card/60 px-4 text-sm font-semibold text-foreground backdrop-blur",
            "transition-transform duration-200 hover:-translate-y-px",
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          {PERIOD_LABEL[period]}
          <ChevronDown className={cn("h-4 w-4 text-primary transition-transform duration-200", open && "rotate-180")} aria-hidden />
        </button>
        {open ? (
          <ul
            role="listbox"
            className="absolute right-0 top-12 z-30 w-44 overflow-hidden rounded-lg border border-border/60 bg-card/95 p-1 shadow-2xl shadow-primary/15 backdrop-blur-md"
          >
            {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
              <li key={p}>
                <button
                  type="button"
                  role="option"
                  aria-selected={period === p}
                  onClick={() => {
                    setPeriod(p);
                    setOpen(false);
                    onPeriodChange?.(p);
                  }}
                  className={cn(
                    "w-full rounded px-3 py-2 text-left text-sm transition-colors",
                    period === p ? "bg-primary/15 text-primary" : "text-foreground hover:bg-muted/40",
                  )}
                >
                  {PERIOD_LABEL[p]}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

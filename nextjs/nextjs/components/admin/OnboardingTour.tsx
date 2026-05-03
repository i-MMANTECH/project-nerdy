"use client";

import { useEffect, useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Command,
  Sparkles,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

type Step = {
  title: string;
  body: string;
  icon: LucideIcon;
  tone: "cyan" | "magenta" | "violet" | "green" | "gold";
  cta?: string;
};

const STEPS: Step[] = [
  {
    title: "Welcome aboard",
    body: "You're inside the new mission-control panel. Everything you do is logged, encrypted, and available across resellers, dealers, and managers — all in one screen.",
    icon: Sparkles,
    tone: "cyan",
    cta: "Quick tour →",
  },
  {
    title: "Press ⌘K from anywhere",
    body: "The command palette jumps you to any page, lets you create users / dealers / resellers, and runs quick actions. On mobile, tap the Quick Actions button on the dashboard.",
    icon: Command,
    tone: "violet",
    cta: "Got it",
  },
  {
    title: "Live operations report",
    body: "Vital metrics auto-sync from your billing core. The ticker streams real events — new signups, ticket updates, credit transactions — as they happen.",
    icon: Activity,
    tone: "green",
    cta: "Continue",
  },
  {
    title: "Your network at a glance",
    body: "The right rail shows your wallet credits, active subscribers, and recent activity. Tap any card to drill into the full ledger.",
    icon: Users,
    tone: "gold",
    cta: "Start exploring",
  },
];

const STORAGE_KEY = "billing.onboarding.v1.seen";

const TONE_RING: Record<Step["tone"], string> = {
  cyan: "ring-cyan-400/40 text-cyan-300 bg-cyan-500/10",
  magenta: "ring-pink-400/40 text-pink-300 bg-pink-500/10",
  violet: "ring-fuchsia-400/40 text-fuchsia-300 bg-fuchsia-500/10",
  green: "ring-emerald-400/40 text-emerald-300 bg-emerald-500/10",
  gold: "ring-amber-300/40 text-amber-300 bg-amber-500/10",
};

const TONE_DOT: Record<Step["tone"], string> = {
  cyan: "bg-cyan-400",
  magenta: "bg-pink-400",
  violet: "bg-fuchsia-400",
  green: "bg-emerald-400",
  gold: "bg-amber-400",
};

/**
 * First-visit onboarding tour. Centered card carousel — works identically on
 * mobile and desktop without DOM-coordinate spotlights (which break on
 * resize). State is persisted to localStorage; users can re-trigger with the
 * `?tour=1` query param if needed.
 */
export function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const force = url.searchParams.get("tour") === "1";
    const seen = window.localStorage.getItem(STORAGE_KEY);
    if (force || !seen) {
      // Defer to avoid colliding with the dashboard's own entrance animation.
      const t = setTimeout(() => setOpen(true), 700);
      return () => clearTimeout(t);
    }
  }, []);

  function close() {
    setOpen(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // localStorage may be unavailable (private mode) — silently degrade.
    }
  }

  function next() {
    if (step >= STEPS.length - 1) close();
    else setStep((s) => s + 1);
  }

  if (!open) return null;
  const cur = STEPS[step];
  const Icon = cur.icon;

  return (
    <AnimatePresence>
      <m.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[140] bg-black/60 backdrop-blur-md"
        onClick={close}
        aria-hidden
      />
      <div
        className="fixed inset-0 z-[150] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Welcome tour"
      >
        <m.div
          key={`step-${step}`}
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="fx-ring-grad relative w-full max-w-md overflow-hidden rounded-2xl border border-border/60 bg-card/95 p-6 shadow-2xl shadow-primary/15 backdrop-blur-xl sm:p-7"
        >
          <button
            type="button"
            onClick={close}
            className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-background/40 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            aria-label="Skip tour"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>

          <div className={cn("mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ring-1", TONE_RING[cur.tone])}>
            <Icon className="h-6 w-6" aria-hidden />
          </div>

          <h2 className="text-xl font-bold leading-tight tracking-tight sm:text-2xl">
            <span className="fx-text-grad">{cur.title}</span>
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">{cur.body}</p>

          <div className="mt-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
              {STEPS.map((s, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 w-6 rounded-full transition-all duration-300",
                    i === step ? TONE_DOT[cur.tone] : "bg-muted-foreground/25",
                  )}
                />
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={close}
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={next}
                className="fx-shine inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:-translate-y-px"
              >
                {cur.cta ?? "Next"}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </div>
        </m.div>
      </div>
    </AnimatePresence>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "cyan" | "magenta" | "violet" | "green" | "gold" | "neutral";

const TONE: Record<Tone, string> = {
  cyan: "border-cyan-400/40 bg-cyan-500/[0.08] text-cyan-200 shadow-[inset_0_0_18px_-6px_rgba(0,245,255,0.40)]",
  magenta: "border-pink-400/40 bg-pink-500/[0.08] text-pink-200 shadow-[inset_0_0_18px_-6px_rgba(255,0,170,0.40)]",
  violet: "border-fuchsia-400/40 bg-fuchsia-500/[0.08] text-fuchsia-200 shadow-[inset_0_0_18px_-6px_rgba(192,38,211,0.40)]",
  green: "border-emerald-400/40 bg-emerald-500/[0.08] text-emerald-200 shadow-[inset_0_0_18px_-6px_rgba(34,255,136,0.40)]",
  gold: "border-amber-300/40 bg-amber-400/[0.08] text-amber-200 shadow-[inset_0_0_18px_-6px_rgba(255,215,0,0.40)]",
  neutral: "border-border/60 bg-muted/30 text-muted-foreground",
};

export function NeonBadge({
  children,
  tone = "cyan",
  pulse = false,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        TONE[tone],
        className,
      )}
    >
      {pulse ? <span className="fx-pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}

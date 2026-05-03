import type { ReactNode } from "react";
import { CornerBrackets } from "@/components/hud/CornerBracket";
import { cn } from "@/lib/cn";

type Tone = "cyan" | "magenta" | "violet" | "green" | "gold";

const TONE_TEXT: Record<Tone, string> = {
  cyan: "text-cyan-300",
  magenta: "text-pink-300",
  violet: "text-fuchsia-300",
  green: "text-emerald-300",
  gold: "text-amber-300",
};

const TONE_LINE: Record<Tone, string> = {
  cyan: "from-cyan-400/60 via-cyan-400/15",
  magenta: "from-pink-400/60 via-pink-400/15",
  violet: "from-fuchsia-400/60 via-fuchsia-400/15",
  green: "from-emerald-400/60 via-emerald-400/15",
  gold: "from-amber-400/60 via-amber-400/15",
};

const TONE_BRACKET: Record<Tone, string> = {
  cyan: "text-cyan-400/70",
  magenta: "text-pink-400/70",
  violet: "text-fuchsia-400/70",
  green: "text-emerald-400/70",
  gold: "text-amber-400/70",
};

/**
 * HUD-style section divider used to demarcate the dashboard's zones
 * (Overview / Analytics / Operations). Pure server component — no JS.
 *
 * Layout: a thin rule with a coloured tag on the left, optional badge / actions
 * on the right, and four faint L-bracket markers framing the whole row.
 */
export function ZoneHeader({
  index,
  label,
  hint,
  tone = "cyan",
  trailing,
  className,
}: {
  /** Zero-padded order indicator, e.g. `01` / `02` / `03`. */
  index: string;
  label: string;
  hint?: string;
  tone?: Tone;
  /** Right-side slot for actions, badges, or a NeonBadge. */
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("relative flex flex-wrap items-center gap-3 py-2", className)}>
      <CornerBrackets className={TONE_BRACKET[tone]} />

      <span
        className={cn(
          "fx-segmented inline-flex shrink-0 items-baseline gap-2 rounded-md border bg-card/40 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.22em] backdrop-blur",
          TONE_TEXT[tone],
        )}
        style={{ borderColor: "color-mix(in oklab, currentColor 35%, transparent)" }}
      >
        <span className="opacity-60">{index}</span>
        <span aria-hidden className="opacity-50">/</span>
        <span>{label}</span>
      </span>

      {hint ? (
        <span className="hidden text-[11px] text-muted-foreground sm:inline">{hint}</span>
      ) : null}

      <div
        className={cn(
          "ml-1 hidden h-px flex-1 bg-gradient-to-r to-transparent sm:block",
          TONE_LINE[tone],
        )}
        aria-hidden
      />

      {trailing ? <div className="ml-auto shrink-0 sm:ml-0">{trailing}</div> : null}
    </header>
  );
}

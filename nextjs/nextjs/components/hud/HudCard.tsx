"use client";

import { forwardRef, type ReactNode } from "react";
import { m } from "framer-motion";
import { cn } from "@/lib/cn";
import { CornerBrackets } from "./CornerBracket";

type Tone = "cyan" | "magenta" | "violet" | "green" | "gold";

const TONE_BORDER: Record<Tone, string> = {
  cyan: "hover:border-[color:var(--neon-cyan)]/45 hover:shadow-[0_0_0_1px_rgba(0,245,255,0.20),0_18px_48px_-14px_rgba(0,245,255,0.40)]",
  magenta: "hover:border-[color:var(--neon-magenta)]/45 hover:shadow-[0_0_0_1px_rgba(255,0,170,0.20),0_18px_48px_-14px_rgba(255,0,170,0.40)]",
  violet: "hover:border-[color:var(--neon-violet)]/45 hover:shadow-[0_0_0_1px_rgba(192,38,211,0.20),0_18px_48px_-14px_rgba(192,38,211,0.40)]",
  green: "hover:border-[color:var(--neon-green)]/45 hover:shadow-[0_0_0_1px_rgba(34,255,136,0.20),0_18px_48px_-14px_rgba(34,255,136,0.40)]",
  gold: "hover:border-[color:var(--neon-gold)]/45 hover:shadow-[0_0_0_1px_rgba(255,215,0,0.20),0_18px_48px_-14px_rgba(255,215,0,0.35)]",
};

const TONE_BRACKET: Record<Tone, string> = {
  cyan: "text-[color:var(--neon-cyan)]/70",
  magenta: "text-[color:var(--neon-magenta)]/70",
  violet: "text-[color:var(--neon-violet)]/70",
  green: "text-[color:var(--neon-green)]/70",
  gold: "text-[color:var(--neon-gold)]/70",
};

type HudCardProps = {
  children: ReactNode;
  className?: string;
  tone?: Tone;
  /** Cut the top-left + bottom-right corners (clip-path). */
  cornersCut?: boolean;
  /** Render four small L-bracket HUD markers in the corners. */
  brackets?: boolean;
  /** Stagger entrance via framer-motion. Caller can pass `index` for per-card delay. */
  motionIndex?: number;
};

export const HudCard = forwardRef<HTMLDivElement, HudCardProps>(function HudCard(
  { children, className, tone = "cyan", cornersCut = false, brackets = false, motionIndex = 0 },
  ref,
) {
  return (
    <m.div
      ref={ref}
      initial={{ opacity: 0, y: 14, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, delay: Math.min(motionIndex, 8) * 0.06, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
      className={cn(
        "fx-hud relative rounded-xl border text-card-foreground transition-[box-shadow,transform,border-color] duration-300 ease-out",
        TONE_BORDER[tone],
        cornersCut && "fx-hud-corners",
        className,
      )}
    >
      {brackets ? <CornerBrackets className={TONE_BRACKET[tone]} /> : null}
      {children}
    </m.div>
  );
});

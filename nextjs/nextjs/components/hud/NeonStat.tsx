"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

type Tone = "cyan" | "magenta" | "violet" | "green" | "gold";

const TONE: Record<Tone, string> = {
  cyan: "fx-text-grad",
  magenta: "text-pink-300 [text-shadow:0_0_20px_rgba(255,0,170,0.45)]",
  violet: "text-fuchsia-300 [text-shadow:0_0_20px_rgba(192,38,211,0.45)]",
  green: "fx-credit-up",
  gold: "fx-credit-gold",
};

/**
 * KPI value with a short count-up animation on first paint.
 * Pass a numeric `value` (cents/credits/integers); pre-formatted strings render instantly without animation.
 */
export function NeonStat({
  value,
  format,
  tone = "cyan",
  className,
  duration = 800,
}: {
  value: number | string;
  format?: (n: number) => string;
  tone?: Tone;
  className?: string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(() => (typeof value === "number" ? 0 : value));
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  const toRef = useRef(typeof value === "number" ? value : 0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      setDisplay(value);
      return;
    }
    fromRef.current = 0;
    toRef.current = value;
    startRef.current = null;

    const tick = (t: number) => {
      if (startRef.current == null) startRef.current = t;
      const elapsed = t - startRef.current;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = fromRef.current + (toRef.current - fromRef.current) * eased;
      setDisplay(progress >= 1 ? toRef.current : next);
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  const text = typeof display === "number" ? (format ? format(display) : Math.round(display).toLocaleString()) : display;

  return <span className={cn("font-bold tabular-nums tracking-tight", TONE[tone], className)}>{text}</span>;
}

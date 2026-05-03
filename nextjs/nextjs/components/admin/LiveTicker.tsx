"use client";

import { Activity, ArrowDown, ArrowUp, Radio } from "lucide-react";
import { m } from "framer-motion";
import { cn } from "@/lib/cn";

export type TickerItem = {
  id: string;
  kind: "credit-in" | "credit-out" | "signup" | "ticket" | "alert";
  primary: string;
  secondary: string;
};

const KIND_TONE: Record<TickerItem["kind"], string> = {
  "credit-in": "text-emerald-300 [text-shadow:0_0_8px_rgba(34,255,136,0.45)]",
  "credit-out": "text-pink-300 [text-shadow:0_0_8px_rgba(255,0,170,0.45)]",
  signup: "text-cyan-300 [text-shadow:0_0_8px_rgba(0,245,255,0.45)]",
  ticket: "text-amber-300 [text-shadow:0_0_8px_rgba(255,215,0,0.45)]",
  alert: "text-fuchsia-300 [text-shadow:0_0_8px_rgba(192,38,211,0.45)]",
};

function KindIcon({ kind }: { kind: TickerItem["kind"] }) {
  const c = "h-3.5 w-3.5";
  if (kind === "credit-in") return <ArrowUp className={c} />;
  if (kind === "credit-out") return <ArrowDown className={c} />;
  return <Activity className={c} />;
}

/**
 * Marquee bar — recent events scroll right-to-left across the top of the page.
 * CSS-driven (transform-only, GPU). Pauses on hover for inspection.
 */
export function LiveTicker({ items }: { items: TickerItem[] }) {
  const safe = items.length > 0 ? items : [
    { id: "stub-1", kind: "alert" as const, primary: "Awaiting live billing events", secondary: "Hook a websocket or poll every 60s to populate" },
  ];
  const doubled = [...safe, ...safe];
  return (
    <m.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="fx-hud relative flex h-9 items-center gap-3 overflow-hidden rounded-full px-4"
    >
      <div className="flex shrink-0 items-center gap-1.5 pr-3 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-400 fx-pulse-dot" aria-hidden />
        <Radio className="h-3.5 w-3.5" aria-hidden />
        <span>Live</span>
      </div>
      <div className="relative flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]">
        <div className="flex w-max animate-[ticker_45s_linear_infinite] items-center gap-8 will-change-transform group-hover:[animation-play-state:paused]">
          {doubled.map((item, idx) => (
            <span
              key={`${item.id}-${idx}`}
              className={cn("inline-flex shrink-0 items-center gap-2 text-xs", KIND_TONE[item.kind])}
            >
              <KindIcon kind={item.kind} />
              <span className="font-semibold">{item.primary}</span>
              <span className="text-muted-foreground">— {item.secondary}</span>
            </span>
          ))}
        </div>
      </div>
    </m.div>
  );
}

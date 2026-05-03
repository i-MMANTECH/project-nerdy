import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Section panel — glassmorphic HUD surface with neon hover. Drop-in replacement
 * for the original; consumers don't need to change usage. Pass `tone` to vary
 * the hover-glow color, `cornersCut` for the cyberpunk clip-path notches.
 */
type Tone = "cyan" | "magenta" | "violet" | "green" | "gold" | "default";

const HOVER_TONE: Record<Tone, string> = {
  default: "",
  cyan: "hover:border-cyan-400/45 hover:shadow-[0_0_0_1px_rgba(0,245,255,0.20),0_18px_48px_-14px_rgba(0,245,255,0.40)]",
  magenta: "hover:border-pink-400/45 hover:shadow-[0_0_0_1px_rgba(255,0,170,0.20),0_18px_48px_-14px_rgba(255,0,170,0.40)]",
  violet: "hover:border-fuchsia-400/45 hover:shadow-[0_0_0_1px_rgba(192,38,211,0.20),0_18px_48px_-14px_rgba(192,38,211,0.40)]",
  green: "hover:border-emerald-400/45 hover:shadow-[0_0_0_1px_rgba(34,255,136,0.20),0_18px_48px_-14px_rgba(34,255,136,0.40)]",
  gold: "hover:border-amber-300/45 hover:shadow-[0_0_0_1px_rgba(255,215,0,0.20),0_18px_48px_-14px_rgba(255,215,0,0.35)]",
};

export function Panel({
  title,
  className,
  subtleHeader,
  headerRight,
  children,
  tone = "cyan",
  cornersCut = false,
}: {
  title?: string;
  className?: string;
  /** Sidebar-style card: compact uppercase title. */
  subtleHeader?: boolean;
  headerRight?: ReactNode;
  children: ReactNode;
  tone?: Tone;
  cornersCut?: boolean;
}) {
  return (
    <section
      className={cn(
        "fx-hud relative rounded-xl border text-card-foreground transition-[box-shadow,border-color,transform] duration-300 ease-out",
        HOVER_TONE[tone],
        cornersCut && "fx-hud-corners",
        className,
      )}
    >
      {title ? (
        <header
          className={cn(
            "border-b border-border/60 px-4 py-3 sm:px-5",
            subtleHeader ? "bg-muted/[0.05]" : "bg-muted/[0.10]",
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <h2
              className={cn(
                subtleHeader
                  ? "text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground"
                  : "text-base font-semibold tracking-tight",
                !subtleHeader && "fx-text-grad",
              )}
            >
              {title}
            </h2>
            {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
          </div>
        </header>
      ) : null}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

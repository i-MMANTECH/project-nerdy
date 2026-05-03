import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

const accents = {
  default: "border-border/70 bg-card/90 text-foreground",
  primary: "border-primary/35 bg-primary/[0.07] text-foreground",
  accent: "border-chart-3/35 bg-chart-3/10 text-foreground",
  warn: "border-amber-500/35 bg-amber-500/[0.08] text-foreground",
  danger: "border-destructive/40 bg-destructive/[0.08] text-foreground",
  muted: "border-border/60 bg-muted/40 text-foreground",
} as const;

export function StatInsightCard({
  title,
  value,
  hint,
  icon: Icon,
  href,
  accent = "default",
  className,
}: {
  title: string;
  value: number | string;
  hint?: string;
  icon: LucideIcon;
  href?: string;
  accent?: keyof typeof accents;
  className?: string;
}) {
  const shell = cn(
    "group relative overflow-hidden rounded-xl border p-4 shadow-sm transition-[box-shadow,transform,background-color] duration-200 ease-out",
    "hover:shadow-md motion-safe:hover:-translate-y-0.5",
    "focus-within:ring-2 focus-within:ring-ring/50 focus-within:ring-offset-2 focus-within:ring-offset-background",
    accents[accent],
    href && "cursor-pointer",
    className,
  );

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-background/60 text-primary",
            "transition-colors group-hover:border-primary/40 group-hover:bg-primary/10",
          )}
          aria-hidden
        >
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
      </div>
      {href ? (
        <span className="mt-3 inline-flex text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
          View details →
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={shell}>
        {body}
      </Link>
    );
  }

  return <div className={shell}>{body}</div>;
}

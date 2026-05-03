import * as React from "react";
import { cn } from "@/lib/cn";

/** Centered auth / narrow form surface (matches temp-figma card density). */
export function FormCard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "w-full max-w-md rounded-xl border border-border/90 bg-card p-6 text-card-foreground shadow-md shadow-black/[0.04] ring-1 ring-black/[0.03] transition-shadow duration-300 dark:shadow-black/20 dark:ring-white/[0.06] sm:p-8",
        className,
      )}
      {...props}
    />
  );
}

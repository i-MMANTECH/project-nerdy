import * as React from "react";
import { cn } from "@/lib/cn";

/**
 * Main scroll region under chrome: full width, mobile-first horizontal padding,
 * optional max width so tables/forms do not sprawl on ultra-wide displays.
 * `fx-rise` gives every page a subtle entrance animation when it mounts.
 */
export function AppMain({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "fx-rise relative mx-auto w-full min-w-0 max-w-[min(100%,1920px)] flex-1 px-3 py-4 sm:px-5 sm:py-5 lg:px-8 lg:py-6",
        className,
      )}
      {...props}
    />
  );
}

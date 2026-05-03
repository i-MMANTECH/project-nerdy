import { cn } from "@/lib/cn";

const stickyBase =
  "sticky top-0 z-[1] border-b border-border/60 bg-muted/95 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm";

/**
 * Sticky `<th>` for tables inside `.app-data-table-scroll` (or any scroll container with max-height).
 * @param className — alignment (`text-right`), `whitespace-nowrap`, etc.
 * @param density — `default` px-3 py-2 (staff lists), `comfortable` px-4 py-3 (tickets-style)
 */
export function dataTableStickyTh(className?: string, density: "default" | "comfortable" = "default") {
  return cn(stickyBase, density === "comfortable" ? "px-4 py-3" : "px-3 py-2", className);
}

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Primary / secondary actions under a form (mobile-first full-width buttons). */
export function FormActions({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap sm:items-center", className)}>{children}</div>
  );
}

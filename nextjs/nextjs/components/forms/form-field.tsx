import * as React from "react";
import { cn } from "@/lib/cn";
import { Label } from "@/components/ui/label";

export type FormFieldProps = {
  id?: string;
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  className?: string;
  /** Merges into the label (e.g. uppercase micro-labels on dense admin forms). */
  labelClassName?: string;
  /** Tighter vertical rhythm for dense admin / portal stacks. */
  density?: "default" | "compact";
  /** Field layout direction. */
  layout?: "stacked" | "horizontal";
  children: React.ReactNode;
};

/**
 * Vertical rhythm for label + control + helper text (mobile-first stack).
 */
export function FormField({
  id,
  label,
  htmlFor,
  hint,
  error,
  className,
  labelClassName,
  density = "default",
  layout = "stacked",
  children,
}: FormFieldProps) {
  const fid = htmlFor ?? id;
  const compact = density === "compact";
  const horizontal = layout === "horizontal";
  return (
    <div
      className={cn(
        horizontal
          ? compact
            ? "grid grid-cols-[8rem_minmax(0,1fr)] items-start gap-x-2 gap-y-1"
            : "grid grid-cols-[9rem_minmax(0,1fr)] items-start gap-x-2.5 gap-y-1.5"
          : compact
            ? "grid gap-1"
            : "grid gap-1.5",
        className,
      )}
    >
      <Label
        htmlFor={fid}
        className={cn(
          compact ? "text-xs font-semibold tracking-tight text-foreground" : "text-sm font-semibold tracking-tight text-foreground",
          horizontal ? "pt-2" : "",
          labelClassName,
        )}
      >
        {label}
      </Label>
      {horizontal ? (
        <div className={cn(compact ? "space-y-1" : "space-y-1.5")}>
          {children}
          {hint ? (
            <p className={cn("leading-snug text-muted-foreground", compact ? "text-[11px]" : "text-xs")}>{hint}</p>
          ) : null}
          {error ? <p className={cn("font-medium text-destructive", compact ? "text-[11px]" : "text-xs")}>{error}</p> : null}
        </div>
      ) : (
        <>
          {children}
          {hint ? (
            <p className={cn("leading-snug text-muted-foreground", compact ? "text-[11px]" : "text-xs")}>{hint}</p>
          ) : null}
          {error ? <p className={cn("font-medium text-destructive", compact ? "text-[11px]" : "text-xs")}>{error}</p> : null}
        </>
      )}
    </div>
  );
}

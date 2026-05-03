import * as React from "react";
import { cn } from "@/lib/cn";

type AlertVariant = "default" | "destructive";

const styles: Record<AlertVariant, string> = {
  default: "border-border bg-muted/50 text-foreground",
  destructive: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function Alert({
  variant = "default",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { variant?: AlertVariant }) {
  return (
    <div
      role="alert"
      className={cn("rounded-lg border px-3 py-2 text-sm transition-[background-color,border-color] duration-200 ease-out", styles[variant], className)}
      {...props}
    >
      {children}
    </div>
  );
}

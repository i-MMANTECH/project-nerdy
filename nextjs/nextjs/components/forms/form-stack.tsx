import * as React from "react";
import { cn } from "@/lib/cn";

/** Consistent vertical spacing between form fields (tighter on narrow screens). */
export function FormStack({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-4 sm:gap-5", className)} {...props} />;
}

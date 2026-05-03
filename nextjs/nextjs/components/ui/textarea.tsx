import * as React from "react";
import { cn } from "@/lib/cn";

export type TextareaProps = React.ComponentProps<"textarea">;

function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "min-h-[5.5rem] w-full rounded-md border border-input bg-input-background px-3 py-2 text-base text-foreground outline-none transition-[color,box-shadow,border-color] duration-200 ease-out md:text-sm",
        "placeholder:text-muted-foreground",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };

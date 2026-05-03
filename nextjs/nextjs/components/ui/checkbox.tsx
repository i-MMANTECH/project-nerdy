import * as React from "react";
import { cn } from "@/lib/cn";

export type CheckboxProps = Omit<React.ComponentProps<"input">, "type"> & {
  type?: "checkbox" | "radio";
};

/** Native checkbox / radio styling aligned with design tokens. */
function Checkbox({ className, type = "checkbox", ...props }: CheckboxProps) {
  return (
    <input
      type={type}
      className={cn(
        "size-4 shrink-0 cursor-pointer border border-input bg-input-background text-primary accent-primary",
        "transition-[border-color,box-shadow] duration-200 ease-out",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        type === "checkbox" && "rounded",
        type === "radio" && "rounded-full",
        className,
      )}
      {...props}
    />
  );
}

export { Checkbox };

"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

const SelectRoot = SelectPrimitive.Root;

const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-10 min-h-[2.5rem] w-full min-w-0 max-w-full items-center justify-between gap-2 rounded-lg border border-input bg-input-background px-3 py-2 text-left text-sm font-medium text-foreground shadow-sm outline-none transition-[border-color,box-shadow,background-color] duration-200 ease-out sm:text-base",
      "hover:bg-muted/30 hover:border-border",
      "data-[placeholder]:text-muted-foreground",
      "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "[&>span]:line-clamp-1",
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground opacity-80" aria-hidden />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      sideOffset={4}
      collisionPadding={12}
      className={cn(
        "relative z-[200] max-h-[min(18rem,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-lg ring-1 ring-black/[0.04] dark:bg-popover dark:ring-white/[0.06]",
        position === "popper" && "motion-safe:transition-[opacity,transform] motion-safe:duration-150",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.Viewport className={cn("thin-scrollbar max-h-[inherit] overflow-y-auto p-1", position === "popper" && "w-full")}>
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label ref={ref} className={cn("px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground", className)} {...props} />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex min-h-8 w-full cursor-default select-none items-center rounded-md py-1.5 pl-7 pr-2.5 text-sm font-medium leading-snug text-foreground outline-none transition-colors",
      "data-[highlighted]:bg-muted data-[highlighted]:text-foreground",
      "data-[state=checked]:bg-muted/70",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
      className,
    )}
    {...props}
  >
    <span className="absolute left-1.5 flex h-4 w-4 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} aria-hidden />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

/** Native `<select>` with app styling (use for huge option lists, e.g. 2000+ rows). */
const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-10 w-full min-w-0 cursor-pointer appearance-none rounded-lg border border-input bg-input-background bg-[length:1rem] bg-[right_0.65rem_center] bg-no-repeat py-2 pl-3 pr-10 text-sm font-medium text-foreground shadow-sm outline-none transition-[border-color,box-shadow,background-color] duration-200 ease-out sm:text-base",
      "hover:border-border hover:bg-muted/20",
      "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "[&>option]:bg-card [&>option]:text-foreground",
      className,
    )}
    style={{
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
    }}
    {...props}
  />
));
NativeSelect.displayName = "NativeSelect";

export type SelectProps = React.ComponentProps<typeof NativeSelect>;

export {
  SelectRoot,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  NativeSelect,
  /** Backward-compatible native `<select>` (id, name, children `<option>`). */
  NativeSelect as Select,
};

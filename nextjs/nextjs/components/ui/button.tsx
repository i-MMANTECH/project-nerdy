import * as React from "react";
import { cn } from "@/lib/cn";

type ButtonVariant =
  | "default"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "link"
  /** Underlined text + icon row actions: still a real `<button>`, not navigation. */
  | "ctaLink"
  /** Muted underlined dismiss-style control (pair with `size="inline"`). */
  | "ctaLinkMuted"
  /** Destructive underlined confirm (pair with `size="inline"`). */
  | "ctaLinkDestructive";

type ButtonSize = "default" | "sm" | "lg" | "inline";

const variantClass: Record<ButtonVariant, string> = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  outline: "border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
  link: "text-primary underline-offset-4 hover:underline",
  ctaLink:
    "border-0 bg-transparent text-primary underline decoration-primary/40 underline-offset-4 shadow-none hover:bg-transparent hover:text-primary hover:decoration-primary active:brightness-100",
  ctaLinkMuted:
    "border-0 bg-transparent text-muted-foreground underline decoration-muted-foreground/40 underline-offset-4 shadow-none hover:bg-transparent hover:text-foreground hover:decoration-foreground/40 active:brightness-100",
  ctaLinkDestructive:
    "border-0 bg-transparent text-destructive underline decoration-destructive/40 underline-offset-4 shadow-none hover:bg-transparent hover:text-destructive hover:decoration-destructive active:brightness-100",
};

const sizeClass: Record<ButtonSize, string> = {
  default: "h-11 min-h-[2.75rem] rounded-md px-4 py-2 text-base font-medium md:h-10 md:min-h-0",
  sm: "h-9 min-h-9 rounded-md px-3 text-sm font-medium md:h-8",
  lg: "h-12 min-h-12 rounded-md px-6 text-base font-medium md:h-11",
  inline: "h-auto min-h-0 rounded-none px-0 py-1 text-sm font-semibold md:h-auto md:min-h-0",
};

export type ButtonProps = React.ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const baseClass =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium antialiased outline-none transition-[color,background-color,border-color,box-shadow] duration-200 ease-out focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 active:brightness-[0.97]";

/** Class names for a `<button>` that should read like a text link (use with icons in children). */
function buttonCtaLinkClassName(tone: "primary" | "muted" | "destructive" = "primary", className?: string) {
  const v =
    tone === "muted" ? variantClass.ctaLinkMuted : tone === "destructive" ? variantClass.ctaLinkDestructive : variantClass.ctaLink;
  return cn(baseClass, v, sizeClass.inline, className);
}

function Button({ className, variant = "default", size = "default", type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(baseClass, variantClass[variant], sizeClass[size], className)} {...props} />;
}

/** Use on `<Link>` for secondary actions (same look as `variant="outline"`). */
function buttonOutlineLinkClassName(className?: string) {
  return cn(baseClass, variantClass.outline, sizeClass.default, className);
}

/** Tickets / accent CTAs: solid chart tone, defined border, comfortable tap target (same height as outline links). */
function buttonSolidChartLinkClassName(className?: string) {
  return cn(
    baseClass,
    sizeClass.default,
    "border border-cyan-800/55 bg-chart-2 text-white shadow-sm hover:bg-cyan-700 hover:border-cyan-600/50",
    className,
  );
}

export { Button, buttonCtaLinkClassName, buttonOutlineLinkClassName, buttonSolidChartLinkClassName };

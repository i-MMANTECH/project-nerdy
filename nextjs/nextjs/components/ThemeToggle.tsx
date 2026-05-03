"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/cn";

type ThemeToggleProps = {
  /** Circular icon button (login / marketing surfaces). */
  variant?: "default" | "fab";
  className?: string;
};

const headerIconBtn =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-[color,background-color] duration-200 ease-out hover:bg-muted hover:text-foreground";

export function ThemeToggle({ variant = "default", className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const label = theme === "light" ? "Switch to dark mode" : "Switch to light mode";

  if (variant === "fab") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full border-2 border-border bg-card text-primary shadow-lg transition-[transform,border-color,box-shadow] duration-200 ease-out hover:scale-105 hover:border-primary hover:shadow-md",
          className,
        )}
        aria-label={label}
      >
        {theme === "light" ? <Moon className="h-5 w-5" strokeWidth={2} /> : <Sun className="h-5 w-5" strokeWidth={2} />}
      </button>
    );
  }

  return (
    <button type="button" onClick={toggleTheme} className={cn(headerIconBtn, className)} aria-label={label}>
      {theme === "light" ? <Moon className="h-5 w-5" strokeWidth={2} /> : <Sun className="h-5 w-5" strokeWidth={2} />}
    </button>
  );
}

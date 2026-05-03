"use client";

import { Toaster } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";

/** Global toast stack (Sonner), theme follows billing light/dark toggle. */
export function AppToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      theme={theme}
      richColors
      closeButton
      position="bottom-right"
      duration={6000}
      toastOptions={{
        classNames: {
          toast: "border border-border/80 bg-card text-foreground shadow-lg",
          title: "font-semibold",
          description: "text-muted-foreground",
        },
      }}
    />
  );
}

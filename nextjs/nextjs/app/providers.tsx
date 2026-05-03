"use client";

import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AppToaster } from "@/components/ui/sonner";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { getQueryClient } from "@/lib/queryClient";

export function Providers({ children }: { children: ReactNode }) {
  // Stable per-render — `useState` so HMR doesn't churn the cache.
  const [queryClient] = useState(() => getQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <MotionProvider>
        <ThemeProvider>
          {children}
          <AppToaster />
        </ThemeProvider>
      </MotionProvider>
    </QueryClientProvider>
  );
}

"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Lightweight global UI state. Anything server-driven (data, auth) lives in
 * TanStack Query — this store is for ephemeral client-only flags that need to
 * survive route changes within a tab.
 */

type CommandPalette = "open" | "closed";

type UIState = {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebar: (collapsed: boolean) => void;

  commandPalette: CommandPalette;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;

  density: "comfortable" | "compact";
  setDensity: (d: "comfortable" | "compact") => void;
};

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebar: (collapsed) => set({ sidebarCollapsed: collapsed }),

      commandPalette: "closed",
      openCommandPalette: () => set({ commandPalette: "open" }),
      closeCommandPalette: () => set({ commandPalette: "closed" }),

      density: "comfortable",
      setDensity: (density) => set({ density }),
    }),
    {
      name: "billing.ui.v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        density: s.density,
      }),
    },
  ),
);

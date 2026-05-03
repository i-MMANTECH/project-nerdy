"use client";

import { QueryClient } from "@tanstack/react-query";

/**
 * Single QueryClient per browser tab. Defaults are tuned for a billing
 * dashboard: data is rarely live-updating, so we keep stale data on screen
 * during refetches and only refetch on mount, not on every focus.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, err) => {
          const msg = String((err as Error)?.message ?? "");
          if (msg.includes("401") || msg.includes("403") || msg.includes("404")) return false;
          return failureCount < 2;
        },
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

let browserClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }
  if (!browserClient) browserClient = makeQueryClient();
  return browserClient;
}

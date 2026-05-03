"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AdminErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] route error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-16 text-center">
      <h1 className="text-lg font-semibold text-foreground">This admin page failed to load</h1>
      <p className="rounded-md border border-rose-500/40 bg-rose-500/5 px-3 py-2 text-left font-mono text-xs leading-relaxed text-rose-200">
        {error.message || "Unknown error"}
      </p>
      {error.stack ? (
        <details className="w-full text-left">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Stack trace
          </summary>
          <pre className="mt-2 max-h-64 overflow-auto rounded-md border border-border/60 bg-muted/30 p-3 text-left font-mono text-[10px] leading-relaxed text-muted-foreground">
            {error.stack}
          </pre>
        </details>
      ) : null}
      {error.digest ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
          digest: {error.digest}
        </p>
      ) : null}
      <Button type="button" variant="outline" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}

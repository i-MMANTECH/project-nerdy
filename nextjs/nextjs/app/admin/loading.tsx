import { CornerBrackets } from "@/components/hud/CornerBracket";

/**
 * Instant skeleton shown the moment a sidebar link is clicked, while the
 * server renders the next route segment. Pure server component (no JS),
 * sized to match the typical admin page (status strip, hero, KPI grid).
 *
 * Why this matters: without `loading.tsx`, Next.js leaves the previous page
 * on screen until the new one is fully streamed — which feels like the
 * sidebar is unresponsive. With this file, the user sees a HUD-styled
 * frame instantly, removing the "is it broken?" pause.
 */

function SkeletonLine({ className }: { className?: string }) {
  return (
    <div
      className={`relative h-3 overflow-hidden rounded bg-muted/30 ${className ?? ""}`}
      aria-hidden
    >
      <div className="fx-progress-bar absolute inset-0 opacity-40" />
    </div>
  );
}

function SkeletonCard({ height = "h-44", tone = "cyan" }: { height?: string; tone?: "cyan" | "magenta" | "green" }) {
  const ring =
    tone === "magenta"
      ? "border-pink-400/15"
      : tone === "green"
        ? "border-emerald-400/15"
        : "border-cyan-400/15";
  return (
    <div className={`fx-bevel relative overflow-hidden rounded-2xl border ${ring} bg-card/60 p-5 backdrop-blur-md ${height}`}>
      <CornerBrackets className="text-cyan-400/40" />
      <div className="space-y-3">
        <SkeletonLine className="w-24" />
        <SkeletonLine className="h-6 w-32" />
        <SkeletonLine className="w-full" />
      </div>
    </div>
  );
}

export default function AdminLoading() {
  return (
    <div className="mx-auto w-full max-w-[min(100%,1920px)] space-y-6 pb-10" aria-busy="true" aria-label="Loading admin page">
      {/* Status strip placeholder */}
      <div className="h-9 overflow-hidden rounded-xl border border-border/40 bg-card/40 backdrop-blur">
        <div className="fx-progress-bar h-full opacity-30" />
      </div>

      {/* Hero greeting placeholder */}
      <div className="space-y-2">
        <SkeletonLine className="w-40" />
        <SkeletonLine className="h-7 w-72" />
        <SkeletonLine className="w-96" />
      </div>

      {/* KPI rows */}
      <div className="space-y-4">
        <SkeletonCard height="h-64" tone="cyan" />
        <SkeletonCard height="h-64" tone="magenta" />
        <SkeletonCard height="h-64" tone="green" />
      </div>

      {/* Charts row */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <SkeletonCard height="h-96" tone="cyan" />
        <SkeletonCard height="h-96" tone="magenta" />
      </div>
    </div>
  );
}

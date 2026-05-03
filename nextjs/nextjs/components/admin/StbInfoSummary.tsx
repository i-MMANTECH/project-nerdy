import type { ReactNode } from "react";
import { Panel } from "@/components/admin/Panel";
import { cn } from "@/lib/cn";

export type StbInfoSummarySlice = {
  id: string;
  packageLabel: string;
  parentPin: string;
  stb: { online: boolean; ip: string; firmware: string; expiry: string; watching: string };
};

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 border-b border-border/40 pb-3 last:border-b-0 last:pb-0">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1.5 min-w-0 text-sm leading-snug text-foreground">{children}</div>
    </div>
  );
}

function Value({ children, mono }: { children: ReactNode; mono?: boolean }) {
  return <div className={cn("break-words", mono && "font-mono text-xs sm:text-sm")}>{children}</div>;
}

/**
 * STB / receiver snapshot for the subscriber edit sidebar. Uses a vertical stack so
 * long timestamps (expiry) never squeeze into a one-character column (common flex bug in narrow cards).
 */
export function StbInfoSummary({
  u,
  title = "STB info",
  children,
  className,
}: {
  u: StbInfoSummarySlice;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const pkg = u.packageLabel?.trim() || "—";
  const pin = u.parentPin?.trim() || "—";

  return (
    <Panel
      title={title}
      subtleHeader
      className={cn("overflow-hidden rounded-2xl border-border/60 bg-card/95 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]", className)}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <span className="text-xs font-medium text-muted-foreground">Account</span>
        <span className="max-w-full break-all font-mono text-sm font-semibold text-foreground">{u.id}</span>
      </div>

      <div className="space-y-0">
        <Stat label="Receiver">
          <span
            className={cn(
              "inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1",
              u.stb.online
                ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                : "bg-rose-500/15 text-rose-300 ring-rose-500/30",
            )}
          >
            {u.stb.online ? "Online" : "Offline"}
          </span>
        </Stat>
        <Stat label="Package">
          <Value>{pkg}</Value>
        </Stat>
        <Stat label="IP">
          <Value mono>{u.stb.ip}</Value>
        </Stat>
        <Stat label="Expiry">
          <Value mono>{u.stb.expiry}</Value>
        </Stat>
        <Stat label="Firmware">
          <Value mono>{u.stb.firmware}</Value>
        </Stat>
        <Stat label="Watching">
          <Value>{u.stb.watching}</Value>
        </Stat>
        <Stat label="Parent PIN">
          <Value mono>{pin}</Value>
        </Stat>
      </div>

      {children ? <div className="mt-4 space-y-3 border-t border-border/60 pt-4">{children}</div> : null}
    </Panel>
  );
}

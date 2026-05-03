import Link from "next/link";
import { Search } from "lucide-react";
import type { FlashToastItem } from "@/components/FlashToasts";
import { FlashToastsBoundary } from "@/components/FlashToasts";
import { PageHeader } from "@/components/admin/PageHeader";
import { ManagerResellerRowActions } from "@/components/portal/ManagerResellerRowActions";
import { listResellersOwnedByManager } from "@/lib/data";
import { cn } from "@/lib/cn";
import { dataTableStickyTh } from "@/lib/ui/dataTableSticky";

const FLASH_STRIP = ["ok", "error"] as const;

function firstString(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function resellerListFlashes(sp: Record<string, string | string[] | undefined>): FlashToastItem[] {
  const ok = firstString(sp.ok);
  const err = firstString(sp.error);
  const items: FlashToastItem[] = [];
  if (ok === "created") {
    items.push({ type: "success", message: "Reseller created", description: "They can sign in with the username and password you set." });
  }
  if (ok === "deleted") {
    items.push({ type: "success", message: "Reseller deleted" });
  }
  if (err === "forbidden") {
    items.push({ type: "error", message: "You do not have access to that action." });
  }
  if (err === "missing") {
    items.push({ type: "error", message: "Required fields were missing." });
  }
  if (err === "delete") {
    items.push({ type: "error", message: "This reseller could not be deleted (still has dealers or subscribers)." });
  }
  return items;
}

function formatInt(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

function hasPositiveCount(value: number | string | null | undefined) {
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") return Number.parseInt(value, 10) > 0;
  return false;
}

export async function ManagerResellersPage({
  managerUsername,
  searchParams: sp,
}: {
  managerUsername: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const qRaw = (firstString(sp.q) ?? "").trim().toLowerCase();
  const all = await listResellersOwnedByManager(managerUsername);
  const rows = qRaw
    ? all.filter((r) => {
        const statusLabel = r.status === "A" ? "active" : "inactive";
        const hay = [r.username, r.name, String(r.dealerCount), String(r.userCount), String(r.credits), statusLabel].join(" ").toLowerCase();
        return hay.includes(qRaw);
      })
    : all;

  const flashes = resellerListFlashes(sp);
  const td = "px-3 py-2 align-middle text-base text-foreground";

  return (
    <div className="mx-auto w-full max-w-[min(100%,1920px)] space-y-6 pb-10">
      {flashes.length ? <FlashToastsBoundary items={flashes} stripParams={[...FLASH_STRIP]} /> : null}
      <PageHeader
        title="Resellers"
        breadcrumb="Reseller accounts under your manager login."
        showBack={false}
        actions={
          <form action="/manager/resellers" method="get" className="w-full min-w-0 sm:max-w-md">
            <label className="sr-only" htmlFor="mgr-reseller-q">
              Search resellers
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                id="mgr-reseller-q"
                name="q"
                type="search"
                defaultValue={firstString(sp.q) ?? ""}
                placeholder="Search name, username, counts…"
                className="h-10 w-full rounded-lg border border-border/80 bg-background/80 py-2 pl-10 pr-3 text-sm text-foreground shadow-inner outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </form>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <Link
          href="/manager/resellers/new"
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
        >
          + Add reseller
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/95 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
        <p className="border-b border-border/50 px-4 pb-3 pt-4 text-xs text-muted-foreground sm:px-5 sm:pt-5">
          Showing <span className="font-medium text-foreground">{rows.length}</span> of{" "}
          <span className="font-medium text-foreground">{all.length}</span> reseller{all.length === 1 ? "" : "s"}
          {qRaw ? ` matching “${(firstString(sp.q) ?? "").trim()}”.` : "."}
        </p>
        <div className="app-data-table-scroll thin-scrollbar">
          <table className="w-full min-w-[820px] border-collapse">
            <thead>
              <tr>
                <th className={dataTableStickyTh()}>Name</th>
                <th className={dataTableStickyTh()}>Username</th>
                <th className={dataTableStickyTh("text-right")}>Dealers</th>
                <th className={dataTableStickyTh("text-right")}>Subscribers</th>
                <th className={dataTableStickyTh("text-right")}>Credits</th>
                <th className={dataTableStickyTh("text-center")}>Status</th>
                <th className={dataTableStickyTh("text-center")}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <p className="text-sm font-medium text-foreground">
                      {qRaw ? "No resellers match your search" : "No resellers under this manager yet"}
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {qRaw ? "Clear the search or try another keyword." : "Use Add reseller to create the first account."}
                    </p>
                  </td>
                </tr>
              ) : null}
              {rows.map((r) => (
                <tr key={r.username} className="border-b border-border/40 transition-colors last:border-0 hover:bg-muted/15">
                  <td className={`${td} font-medium`}>{r.name || "—"}</td>
                  <td className={td}>
                    <Link
                      href={`/manager/resellers/${encodeURIComponent(r.username)}`}
                      className="font-mono text-sm font-semibold text-primary hover:underline"
                    >
                      {r.username}
                    </Link>
                  </td>
                  <td className={cn(td, "text-right tabular-nums")}>
                    {hasPositiveCount(r.dealerCount) ? (
                      <Link
                        href={`/manager/dealers?reseller=${encodeURIComponent(r.username)}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {formatInt(r.dealerCount)}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{formatInt(r.dealerCount)}</span>
                    )}
                  </td>
                  <td className={cn(td, "text-right tabular-nums")}>
                    {hasPositiveCount(r.userCount) ? (
                      <Link
                        href={`/manager/users?reseller=${encodeURIComponent(r.username)}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {formatInt(r.userCount)}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{formatInt(r.userCount)}</span>
                    )}
                  </td>
                  <td className={cn(td, "text-right font-mono tabular-nums")}>{formatInt(r.credits)}</td>
                  <td className={`${td} text-center`}>
                    {r.status === "A" ? (
                      <span className="inline-flex rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-semibold text-rose-300 ring-1 ring-rose-500/30">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className={`${td} text-center`}>
                    <ManagerResellerRowActions username={r.username} displayName={r.name || r.username} canDelete={r.canDelete} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

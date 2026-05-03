import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { getResellers } from "@/lib/data";
import { AdminResellerRowActions } from "@/components/admin/AdminResellerRowActions";
import { cn } from "@/lib/cn";
import { dataTableStickyTh } from "@/lib/ui/dataTableSticky";
import { FlashToastsBoundary } from "@/components/FlashToasts";
import { adminStaffListFlashItems } from "@/lib/adminInlineFlashToasts";

type Props = { searchParams?: Promise<{ ok?: string; error?: string; q?: string }> };

function resellersListPath(sp: { q?: string }) {
  const q = sp.q?.trim();
  if (!q) return "/admin/resellers";
  return `/admin/resellers?q=${encodeURIComponent(q)}`;
}

function formatInt(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

function hasPositiveCount(value: number | string | null | undefined) {
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") return Number.parseInt(value, 10) > 0;
  return false;
}

export default async function ResellersPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const qRaw = (sp.q ?? "").trim().toLowerCase();
  const all = await getResellers();
  const rows = qRaw
    ? all.filter((r) => {
        const statusLabel = r.status === "A" ? "active" : "inactive";
        const hay = [
          r.username,
          r.manager,
          r.name,
          String(r.dealerCount),
          String(r.userCount),
          String(r.credits),
          statusLabel,
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(qRaw);
      })
    : all;

  const redirectPath = resellersListPath(sp);
  const listFlashes = adminStaffListFlashItems(sp, "reseller");

  const td = "px-3 py-2 align-middle text-base text-foreground";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Resellers</h1>
          <p className="mt-1 text-sm text-muted-foreground">Resellers under managers; each can add dealers and user accounts.</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
          <form method="get" action="/admin/resellers" className="w-full min-w-0 sm:max-w-md lg:max-w-lg">
            <label htmlFor="staff-reseller-search" className="sr-only">
              Search resellers
            </label>
            <input
              id="staff-reseller-search"
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Search name, username, manager, counts…"
              className="h-11 w-full rounded-xl border border-border/80 bg-background/80 px-4 text-sm text-foreground shadow-sm outline-none ring-offset-background transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring"
            />
          </form>
          <Link
            href="/admin/resellers/new"
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            + Add reseller
          </Link>
        </div>
      </div>

      {listFlashes.length ? <FlashToastsBoundary items={listFlashes} stripParams={["ok", "error"]} /> : null}

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/95 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
        <p className="border-b border-border/50 px-4 pb-3 pt-4 text-xs text-muted-foreground sm:px-5 sm:pt-5">
          Showing <span className="font-medium text-foreground">{rows.length}</span> of{" "}
          <span className="font-medium text-foreground">{all.length}</span> reseller{all.length === 1 ? "" : "s"}
          {qRaw ? ` matching “${(sp.q ?? "").trim()}”.` : "."}
        </p>
        <div className="app-data-table-scroll thin-scrollbar">
          <table className="w-full min-w-[920px] border-collapse">
            <thead>
              <tr>
                <th className={dataTableStickyTh()}>Manager</th>
                <th className={dataTableStickyTh()}>Name</th>
                <th className={dataTableStickyTh()}>Username</th>
                <th className={dataTableStickyTh("text-right")}>Dealers</th>
                <th className={dataTableStickyTh("text-right")}>Users</th>
                <th className={dataTableStickyTh("text-right")}>Credits</th>
                <th className={dataTableStickyTh("text-center")}>Status</th>
                <th className={dataTableStickyTh("text-center")}>
                  <span className="inline-flex items-center justify-center" aria-hidden>
                    <MoreHorizontal className="h-4 w-4" />
                  </span>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <p className="text-sm font-medium text-foreground">
                      {qRaw ? "No resellers match your search" : "No reseller accounts yet"}
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {qRaw
                        ? "Clear the search box or try another name, username, or count keyword."
                        : "Create one with Add reseller when you are ready to onboard partners."}
                    </p>
                  </td>
                </tr>
              ) : null}
              {rows.map((r) => (
                <tr key={r.username} className="border-b border-border/40 transition-colors last:border-0 hover:bg-muted/15">
                  <td className={td}>
                    {r.manager ? (
                      <Link
                        href={`/admin/managers/${encodeURIComponent(r.manager)}`}
                        className="font-mono text-xs font-semibold text-primary hover:underline"
                      >
                        {r.manager}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className={`${td} font-medium`}>{r.name || "—"}</td>
                  <td className={td}>
                    <Link
                      href={`/admin/resellers/${encodeURIComponent(r.username)}`}
                      className="font-mono text-sm font-semibold text-primary hover:underline"
                    >
                      {r.username}
                    </Link>
                  </td>
                  <td className={cn(td, "text-right tabular-nums")}>
                    {hasPositiveCount(r.dealerCount) ? (
                      <Link
                        href={`/admin/dealers?reseller=${encodeURIComponent(r.username)}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {formatInt(r.dealerCount)}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{formatInt(r.dealerCount)}</span>
                    )}
                  </td>
                  <td className={cn(td, "text-right tabular-nums text-muted-foreground")}>{formatInt(r.userCount)}</td>
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
                    <AdminResellerRowActions
                      username={r.username}
                      displayName={r.name || r.username}
                      canDelete={r.canDelete}
                      redirectPath={redirectPath}
                      status={r.status}
                      managerLogin={r.manager}
                      credits={r.credits}
                      dealerCount={r.dealerCount}
                      activeUsers={r.activeUserCount}
                      expiredUsers={r.expiredUserCount}
                      totalUsers={r.userCount}
                      stateCurrentLogin={r.currentLoginTime}
                      transactions={[]}
                    />
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

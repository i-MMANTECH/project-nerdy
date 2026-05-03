import Link from "next/link";
import { getDealers } from "@/lib/data";
import { AdminDealerRowActions } from "@/components/admin/AdminDealerRowActions";
import { cn } from "@/lib/cn";
import { dataTableStickyTh } from "@/lib/ui/dataTableSticky";
import { FlashToastsBoundary } from "@/components/FlashToasts";
import { adminStaffListFlashItems } from "@/lib/adminInlineFlashToasts";

type Props = { searchParams?: Promise<{ reseller?: string; q?: string; ok?: string; error?: string }> };

function dealersListPath(sp: { reseller?: string; q?: string }) {
  const params = new URLSearchParams();
  const r = sp.reseller?.trim();
  const q = sp.q?.trim();
  if (r) params.set("reseller", r);
  if (q) params.set("q", q);
  const s = params.toString();
  return s ? `/admin/dealers?${s}` : "/admin/dealers";
}

function formatInt(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

export default async function DealersPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const reseller = sp.reseller?.trim();
  const qRaw = (sp.q ?? "").trim().toLowerCase();
  const all = await getDealers(reseller ? { resellerUsername: reseller } : undefined);
  const rows = qRaw
    ? all.filter((r) => {
        const statusLabel = r.status === "A" ? "active" : "inactive";
        const hay = [
          r.username,
          r.manager,
          r.reseller,
          r.name,
          String(r.userCount),
          String(r.credits),
          statusLabel,
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(qRaw);
      })
    : all;

  const redirectPath = dealersListPath(sp);
  const listFlashes = adminStaffListFlashItems(sp, "dealer");

  const td = "px-3 py-2 align-middle text-base text-foreground";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Dealers</h1>
          <p className="mt-1 text-sm text-muted-foreground">Dealers under resellers; they manage end-user subscriber accounts.</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
          <form method="get" action="/admin/dealers" className="w-full min-w-0 sm:max-w-md lg:max-w-lg">
            {reseller ? <input type="hidden" name="reseller" value={reseller} /> : null}
            <label htmlFor="staff-dealer-search" className="sr-only">
              Search dealers
            </label>
            <input
              id="staff-dealer-search"
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Search name, username, hierarchy…"
              className="h-11 w-full rounded-xl border border-border/80 bg-background/80 px-4 text-sm text-foreground shadow-sm outline-none ring-offset-background transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring"
            />
          </form>
          <Link
            href="/admin/dealers/new"
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            + Add dealer
          </Link>
        </div>
      </div>

      {listFlashes.length ? <FlashToastsBoundary items={listFlashes} stripParams={["ok", "error"]} /> : null}

      {reseller ? (
        <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-foreground">
          Filtered to dealers under reseller{" "}
          <Link href={`/admin/resellers/${encodeURIComponent(reseller)}`} className="font-mono font-semibold text-primary hover:underline">
            {reseller}
          </Link>
          .{" "}
          <Link
            href={sp.q?.trim() ? `/admin/dealers?q=${encodeURIComponent(sp.q.trim())}` : "/admin/dealers"}
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Clear reseller filter
          </Link>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/95 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
        <p className="border-b border-border/50 px-4 pb-3 pt-4 text-xs text-muted-foreground sm:px-5 sm:pt-5">
          Showing <span className="font-medium text-foreground">{rows.length}</span> of{" "}
          <span className="font-medium text-foreground">{all.length}</span> dealer{all.length === 1 ? "" : "s"}
          {reseller ? " (reseller filter)" : ""}
          {qRaw ? ` matching “${(sp.q ?? "").trim()}”.` : "."}
        </p>
        <div className="app-data-table-scroll thin-scrollbar">
          <table className="w-full min-w-[960px] border-collapse">
            <thead>
              <tr>
                <th className={dataTableStickyTh()}>Manager</th>
                <th className={dataTableStickyTh()}>Reseller</th>
                <th className={dataTableStickyTh()}>Name</th>
                <th className={dataTableStickyTh()}>Username</th>
                <th className={dataTableStickyTh("text-right")}>Subscribers</th>
                <th className={dataTableStickyTh("text-right")}>Credits</th>
                <th className={dataTableStickyTh("text-center")}>Status</th>
                <th className={dataTableStickyTh("text-center")}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <p className="text-sm font-medium text-foreground">
                      {qRaw ? "No dealers match your search" : "No dealer accounts yet"}
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {qRaw
                        ? "Clear the search box or try another name, username, or hierarchy keyword."
                        : "Add a dealer from the resellers view or use Add dealer when you are ready."}
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
                  <td className={td}>
                    {r.reseller ? (
                      <Link
                        href={`/admin/resellers/${encodeURIComponent(r.reseller)}`}
                        className="font-mono text-xs font-semibold text-primary hover:underline"
                      >
                        {r.reseller}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className={`${td} font-medium`}>{r.name || "—"}</td>
                  <td className={td}>
                    <Link
                      href={`/admin/dealers/${encodeURIComponent(r.username)}`}
                      className="font-mono text-sm font-semibold text-primary hover:underline"
                    >
                      {r.username}
                    </Link>
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
                    <AdminDealerRowActions
                      username={r.username}
                      displayName={r.name || r.username}
                      canDelete={r.canDelete}
                      redirectPath={redirectPath}
                      status={r.status}
                      managerLogin={r.manager}
                      resellerLogin={r.reseller}
                      credits={r.credits}
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

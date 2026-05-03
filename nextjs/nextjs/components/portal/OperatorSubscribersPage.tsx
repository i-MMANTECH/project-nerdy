import Link from "next/link";
import { Plus, SlidersHorizontal } from "lucide-react";
import { FlashToastsBoundary } from "@/components/FlashToasts";
import { PageHeader } from "@/components/admin/PageHeader";
import { PortalUsersTableWithBulkRenew } from "@/components/portal/PortalUsersTableWithBulkRenew";
import { getDeductionsConfig, getUsersSummaryScoped, listAccountsPagedScoped } from "@/lib/data";
import {
  PORTAL_SUBSCRIBER_LIST_FLASH_KEYS,
  portalSubscriberListFlashItems,
} from "@/lib/portalSubscriberListFlashes";
import { buildMonthDeductionChargedMap } from "@/lib/repos/accountCreate";
import type { PortalBase } from "@/lib/portal-nav";
import { FormSelect } from "@/components/forms/form-select";
import { Button } from "@/components/ui/button";
import { PAGE_SIZE_OPTIONS, SUBSCRIBER_STATUS_FILTER_OPTIONS } from "@/lib/subscriberFilterSelectOptions";

const PORTAL_SUBSCRIBER_STATUS_OPTIONS = SUBSCRIBER_STATUS_FILTER_OPTIONS.filter(
  (o) => !o.value || o.value === "active" || o.value === "expired" || o.value === "inactive",
);

const STATUS_FILTERS = ["active", "expired", "inactive"] as const;

type OwnerType = "MNGR" | "SRSLR" | "RSLR";

function buildQs(parts: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(parts)) {
    if (v !== undefined && v !== "") p.set(k, v);
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

function formatInt(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

type SearchSp = {
  query?: string;
  /** MNGR: filter users to accounts under this reseller login. */
  reseller?: string;
  /** MNGR / SRSLR: filter to accounts billed under this dealer login (`accounts.username`). */
  dealer?: string;
  ok?: string;
  error?: string;
  bal?: string;
  req?: string;
  renew_acc?: string;
  status?: string;
  page?: string;
  pageSize?: string;
  sort?: string;
  dir?: string;
};

export async function OperatorSubscribersPage({
  ownerType,
  portalBase,
  usersPath,
  operatorUsername,
  searchParams: sp,
  /** When set (e.g. `/reseller/dealers/[dealer]/users`), scope is locked to this dealer login. */
  dealerLoginFixed,
  /** Override "Add user" target (e.g. `${usersPath}/new` for dealer-scoped lists). */
  newSubscriberHref,
}: {
  ownerType: OwnerType;
  portalBase: PortalBase;
  /** e.g. `/manager/users` — form actions and sort links. */
  usersPath: string;
  operatorUsername: string;
  searchParams: SearchSp;
  dealerLoginFixed?: string;
  newSubscriberHref?: string;
}) {
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(5, Number.parseInt(sp.pageSize ?? "20", 10) || 20));
  const statusRaw = sp.status?.toLowerCase();
  const status =
    statusRaw === "active" || statusRaw === "expired" || statusRaw === "inactive" ? statusRaw : undefined;
  const query = sp.query?.trim() ?? "";
  const resellerFilter = ownerType === "MNGR" ? (sp.reseller?.trim() ?? "") : "";
  const fixedDealer = (dealerLoginFixed ?? "").trim();
  const dealerScopeLocked = fixedDealer !== "";
  const dealerFilter = dealerScopeLocked
    ? fixedDealer
    : ownerType === "MNGR" || ownerType === "SRSLR"
      ? (sp.dealer?.trim() ?? "")
      : "";
  const sort = sp.sort ?? "account";
  const dir = sp.dir === "desc" ? "desc" : "asc";

  const [summary, cfg, { rows, total }] = await Promise.all([
    getUsersSummaryScoped({ ownerType, ownerUsername: operatorUsername }),
    getDeductionsConfig(),
    listAccountsPagedScoped({
      ownerType,
      ownerUsername: operatorUsername,
      resellerUsername: resellerFilter || undefined,
      dealerUsername: dealerFilter || undefined,
      status,
      search: query || undefined,
      page,
      pageSize,
      sort,
      dir,
    }),
  ]);

  const deductionMap = buildMonthDeductionChargedMap(
    cfg.rows.map((d) => ({ month: d.month, month_deduction: Number(d.month_deduction) || 0 })),
  );
  const validityOptions = [
    { value: "FREE_TRIAL", label: "2 Days Trial" },
    ...Array.from({ length: 24 }, (_, i) => {
      const month = i + 1;
      const charged = deductionMap[month] ?? month;
      const bonus = month - charged;
      const extra =
        bonus > 0 && charged < month
          ? ` (${charged} credit${charged > 1 ? "s" : ""} charged, ${bonus} bonus month${bonus > 1 ? "s" : ""})`
          : "";
      return { value: String(month), label: `${month} month${month > 1 ? "s" : ""}${extra}` };
    }),
  ];

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const baseQs = {
    query: query || undefined,
    ...(resellerFilter ? { reseller: resellerFilter } : {}),
    ...(dealerFilter ? { dealer: dealerFilter } : {}),
    pageSize: String(pageSize),
    sort,
    dir: dir === "desc" ? "desc" : undefined,
  };
  const listReturnPath = `${usersPath}${buildQs({
    ...baseQs,
    status: status && STATUS_FILTERS.includes(status as (typeof STATUS_FILTERS)[number]) ? status : undefined,
    page: String(page),
  })}`;

  const sortHref = (col: string) => {
    const nextDir = sort === col && dir === "asc" ? "desc" : "asc";
    return `${usersPath}${buildQs({
      ...baseQs,
      status: status && STATUS_FILTERS.includes(status as (typeof STATUS_FILTERS)[number]) ? status : undefined,
      page: String(page),
      sort: col,
      dir: nextDir,
    })}`;
  };

  const sortUrls = {
    account: sortHref("account"),
    mac: sortHref("mac"),
    full_name: sortHref("full_name"),
    reseller: sortHref("reseller"),
    dealer: sortHref("dealer"),
    status: sortHref("status"),
    expires: sortHref("expires"),
    created: sortHref("created"),
  };

  /** When the list is scoped to one dealer, Owner is flat on `dealer` — sort by reseller instead (matches hierarchy). */
  const ownerSortColumn: "dealer" | "reseller" = dealerFilter !== "" ? "reseller" : "dealer";
  const ownerSortUrl = sortUrls[ownerSortColumn];

  const flashItems = portalSubscriberListFlashItems(sp);
  const variant = ownerType === "MNGR" ? "manager" : ownerType === "SRSLR" ? "reseller" : "dealer";
  const addSubscriberHref = newSubscriberHref ?? `${portalBase}/users/new`;
  const resellerStatusQuickActions = variant === "reseller" && Boolean(dealerFilter);

  return (
    <div className="mx-auto w-full max-w-[min(100%,1920px)] space-y-5 pb-10">
      {flashItems.length ? (
        <FlashToastsBoundary items={flashItems} stripParams={[...PORTAL_SUBSCRIBER_LIST_FLASH_KEYS]} />
      ) : null}
      <PageHeader
        title="Users"
        breadcrumb="Manage and monitor user accounts."
        showBack={false}
        actions={
          <Link
            href={addSubscriberHref}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add user
          </Link>
        }
      />

      <section aria-label="User summary" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border/60 bg-card/90 px-4 py-2.5 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Total</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{formatInt(summary.all)}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card/90 px-4 py-2.5 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-400/90">Active</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">{formatInt(summary.active)}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card/90 px-4 py-2.5 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-400/90">Expired</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-rose-700 dark:text-rose-300">{formatInt(summary.expired)}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card/90 px-4 py-2.5 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400/90">Inactive</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-slate-700 dark:text-slate-200">{formatInt(summary.inactive)}</p>
        </div>
      </section>

      {dealerScopeLocked && dealerFilter && (ownerType === "SRSLR" || ownerType === "MNGR") ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/25 bg-primary/5 px-4 py-2 text-sm">
          <span className="text-muted-foreground">
            Users for dealer <span className="font-mono font-semibold text-foreground">{dealerFilter}</span>
            <span className="ml-1">(this list is fixed to that dealer branch).</span>
          </span>
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            <Link
              href={`${portalBase}/dealers/${encodeURIComponent(dealerFilter)}`}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Dealer settings
            </Link>
            <Link href={`${portalBase}/dealers`} className="text-xs font-semibold text-primary hover:underline">
              All dealers
            </Link>
            <Link href={`${portalBase}/users`} className="text-xs font-semibold text-primary hover:underline">
              All users
            </Link>
          </span>
        </div>
      ) : resellerFilter || dealerFilter ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/25 bg-primary/5 px-4 py-2 text-sm">
          <span className="text-muted-foreground">
            {resellerFilter ? (
              <>
                Reseller <span className="font-mono font-semibold text-foreground">{resellerFilter}</span>
              </>
            ) : null}
            {resellerFilter && dealerFilter ? <span className="mx-1 text-border">·</span> : null}
            {dealerFilter ? (
              <>
                Dealer <span className="font-mono font-semibold text-foreground">{dealerFilter}</span>
              </>
            ) : null}
            <span className="ml-1">— user list scoped.</span>
          </span>
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            {resellerFilter ? (
              <Link
                href={`${usersPath}${buildQs({
                  query: query || undefined,
                  ...(dealerFilter ? { dealer: dealerFilter } : {}),
                  pageSize: String(pageSize),
                  sort: sort !== "account" ? sort : undefined,
                  dir: dir === "desc" ? "desc" : undefined,
                  page: "1",
                })}`}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Clear reseller
              </Link>
            ) : null}
            {dealerFilter ? (
              <Link
                href={`${usersPath}${buildQs({
                  query: query || undefined,
                  ...(resellerFilter ? { reseller: resellerFilter } : {}),
                  pageSize: String(pageSize),
                  sort: sort !== "account" ? sort : undefined,
                  dir: dir === "desc" ? "desc" : undefined,
                  page: "1",
                })}`}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Clear dealer
              </Link>
            ) : null}
            {resellerFilter && dealerFilter ? (
              <Link
                href={`${usersPath}${buildQs({
                  query: query || undefined,
                  pageSize: String(pageSize),
                  sort: sort !== "account" ? sort : undefined,
                  dir: dir === "desc" ? "desc" : undefined,
                  page: "1",
                })}`}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Clear all
              </Link>
            ) : null}
          </span>
        </div>
      ) : null}

      <section className="rounded-xl border border-border/60 bg-card/80 p-3.5 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06] sm:p-4">
        <form action={usersPath} method="get" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <input type="hidden" name="pageSize" value={String(pageSize)} />
          {sort !== "account" ? <input type="hidden" name="sort" value={sort} /> : null}
          {dir === "desc" ? <input type="hidden" name="dir" value="desc" /> : null}
          <input type="hidden" name="page" value="1" />
          {resellerFilter ? <input type="hidden" name="reseller" value={resellerFilter} /> : null}
          {dealerFilter ? <input type="hidden" name="dealer" value={dealerFilter} /> : null}
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Search</label>
            <div className="relative">
              <input
                name="query"
                defaultValue={query}
                className="h-10 w-full rounded-lg border border-border/80 bg-background/80 px-3 py-2 text-sm text-foreground shadow-inner outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Search by account, name, or MAC…"
              />
            </div>
          </div>
          <div className="w-full sm:w-48">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</label>
            <FormSelect
              name="status"
              defaultValue={status ?? ""}
              options={PORTAL_SUBSCRIBER_STATUS_OPTIONS}
              placeholder="All status"
              className="h-10 border-border/80 bg-background/80"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border/70 bg-muted/40 px-4 text-sm font-medium text-foreground transition hover:bg-muted/60"
          >
            <SlidersHorizontal className="h-4 w-4 opacity-80" aria-hidden />
            Apply filters
          </button>
        </form>
      </section>

      <section aria-labelledby="portal-subscribers-table-heading">
        <h2 id="portal-subscribers-table-heading" className="sr-only">
          User accounts
        </h2>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            Showing {total === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
          </span>
          <form
            action={usersPath}
            method="get"
            className="flex min-w-0 max-w-full flex-nowrap items-center gap-2 sm:gap-3"
          >
            {query ? <input type="hidden" name="query" value={query} /> : null}
            {resellerFilter ? <input type="hidden" name="reseller" value={resellerFilter} /> : null}
            {dealerFilter ? <input type="hidden" name="dealer" value={dealerFilter} /> : null}
            {status && STATUS_FILTERS.includes(status as (typeof STATUS_FILTERS)[number]) ? (
              <input type="hidden" name="status" value={status} />
            ) : null}
            {sort !== "account" ? <input type="hidden" name="sort" value={sort} /> : null}
            {dir === "desc" ? <input type="hidden" name="dir" value="desc" /> : null}
            <div className="flex min-w-0 shrink-0 items-center gap-2">
              <label htmlFor="portal-subscribers-page-size" className="whitespace-nowrap text-sm font-medium text-foreground">
                Per page
              </label>
              <FormSelect
                id="portal-subscribers-page-size"
                name="pageSize"
                defaultValue={String(pageSize)}
                options={PAGE_SIZE_OPTIONS}
                className="h-10 w-[5.5rem] shrink-0 border-border/80 bg-background/80"
              />
            </div>
            <Button type="submit" variant="secondary" size="sm" className="h-10 min-h-10 shrink-0 px-4">
              Apply
            </Button>
          </form>
        </div>
        <PortalUsersTableWithBulkRenew
          variant={variant}
          resellerStatusQuickActions={resellerStatusQuickActions}
          rows={rows}
          validityOptions={validityOptions}
          sort={sort}
          dir={dir}
          sortUrls={sortUrls}
          ownerSortUrl={ownerSortUrl}
          ownerSortColumn={ownerSortColumn}
          listReturnPath={listReturnPath}
          portalBase={portalBase}
        />
        {totalPages > 1 ? (
          <nav className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={`${usersPath}${buildQs({
                    ...baseQs,
                    status: status && STATUS_FILTERS.includes(status as (typeof STATUS_FILTERS)[number]) ? status : undefined,
                    page: String(page - 1),
                  })}`}
                  className="rounded-lg border border-border/70 px-3 py-1.5 hover:bg-muted/40"
                >
                  Previous
                </Link>
              ) : (
                <span className="rounded-lg border border-border px-3 py-1.5 text-muted-foreground">Previous</span>
              )}
              {page < totalPages ? (
                <Link
                  href={`${usersPath}${buildQs({
                    ...baseQs,
                    status: status && STATUS_FILTERS.includes(status as (typeof STATUS_FILTERS)[number]) ? status : undefined,
                    page: String(page + 1),
                  })}`}
                  className="rounded-lg border border-border/70 px-3 py-1.5 hover:bg-muted/40"
                >
                  Next
                </Link>
              ) : (
                <span className="rounded-lg border border-border px-3 py-1.5 text-muted-foreground">Next</span>
              )}
            </div>
            <span className="text-muted-foreground">
              Page {page} of {totalPages}
            </span>
          </nav>
        ) : null}
      </section>
    </div>
  );
}

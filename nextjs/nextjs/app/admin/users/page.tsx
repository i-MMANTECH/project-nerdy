import Link from "next/link";
import {
  DEFAULT_ADMIN_NOTIFICATION_PREFS,
  getAdminDevicesOnlineCount,
  getAdminExpiringSoonCount,
  getAdminNotificationPrefs,
  getDeductionsConfig,
  getUsersSummary,
  listAccountsPaged,
  listResellersForSelect,
  listStalkerTariffPlans,
} from "@/lib/data";
import { buildMonthDeductionChargedMap } from "@/lib/repos/accountCreate";
import { getStalkerCustomPackagePlanId, listStalkerPackagesForPlan } from "@/lib/repos/stalkerUserPackages";
import type { FlashToastItem } from "@/components/FlashToasts";
import { FlashToastsBoundary } from "@/components/FlashToasts";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminSubscribersTable } from "@/components/admin/AdminSubscribersTable";
import {
  portalUsersDeleteListErrorMessage,
  portalUsersRenewListErrorMessage,
  portalUsersResetListErrorMessage,
  portalUsersStatusQuickErrorMessage,
} from "@/lib/portalUsersRenewListMessages";
import { newEndUserCreationFlashItems } from "@/lib/urlFlashToasts";
import { PAGE_SIZE_OPTIONS, SUBSCRIBER_STATUS_FILTER_OPTIONS } from "@/lib/subscriberFilterSelectOptions";

const STATUS_FILTERS = ["active", "expired", "inactive", "expiring", "expiry", "activity"] as const;

type Props = {
  searchParams?: Promise<{
    query?: string;
    q?: string;
    /** Exact billing manager login — subscribers under that manager’s hierarchy only. */
    manager?: string;
    /** Exact reseller login — subscribers under that reseller’s branch. */
    reseller?: string;
    /** Exact dealer login (`accounts.username`) — subscribers owned by that dealer. */
    dealer?: string;
    ok?: string;
    error?: string;
    bal?: string;
    req?: string;
    renew_acc?: string;
    status?: string;
    autoRenew?: string;
    page?: string;
    pageSize?: string;
    sort?: string;
    dir?: string;
    addUser?: string;
    editAccount?: string;
  }>;
};

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

function formatPct(part: number, total: number) {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return "0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

function buildPaginationItems(totalPages: number, currentPage: number, siblingDelta: number): (number | "ellipsis")[] {
  if (totalPages <= 1) return [];
  const left = currentPage - siblingDelta;
  const right = currentPage + siblingDelta;
  const items: (number | "ellipsis")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= left && i <= right)) {
      items.push(i);
      continue;
    }
    if (items[items.length - 1] !== "ellipsis") items.push("ellipsis");
  }
  return items;
}

export default async function UsersPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(5, Number.parseInt(sp.pageSize ?? "20", 10) || 20));
  const statusRaw = sp.status?.toLowerCase();
  const status =
    statusRaw === "active" ||
    statusRaw === "expired" ||
    statusRaw === "inactive" ||
    statusRaw === "expiring" ||
    statusRaw === "expiry" ||
    statusRaw === "activity"
      ? statusRaw
      : undefined;
  const query = (sp.query?.trim() || sp.q?.trim() || "") || "";
  const autoRenewRaw = (sp.autoRenew ?? "").trim();
  const autoRenew = autoRenewRaw === "1" || autoRenewRaw === "0" ? autoRenewRaw : "";
  const managerFilter = (sp.manager?.trim() || "") || "";
  const resellerFilter = (sp.reseller?.trim() || "") || "";
  const dealerFilter = (sp.dealer?.trim() || "") || "";
  const sort = sp.sort ?? "manager";
  const dir = sp.dir === "desc" ? "desc" : "asc";

  const listParams = {
    status,
    search: query || undefined,
    autoRenew: autoRenew || undefined,
    managerLogin: managerFilter || undefined,
    resellerLogin: resellerFilter || undefined,
    dealerLogin: dealerFilter || undefined,
    page,
    pageSize,
    sort,
    dir,
  } as const;

  const notifyPrefs = await getAdminNotificationPrefs().catch(() => DEFAULT_ADMIN_NOTIFICATION_PREFS);

  const [summary, cfg, expiringSoon, devicesOnline, { rows, total }, resellers, tariffs, customPlanId] = await Promise.all([
    getUsersSummary(),
    getDeductionsConfig(),
    notifyPrefs.notifyExpiringSubscriptions ? getAdminExpiringSoonCount(7).catch(() => 0) : Promise.resolve(0),
    notifyPrefs.notifyDeviceOffline ? getAdminDevicesOnlineCount().catch(() => null as number | null) : Promise.resolve(null),
    listAccountsPaged(listParams),
    listResellersForSelect(),
    listStalkerTariffPlans(),
    getStalkerCustomPackagePlanId(),
  ]);
  const addonPackages =
    customPlanId != null && Number.isFinite(customPlanId) && customPlanId > 0
      ? await listStalkerPackagesForPlan(customPlanId)
      : [];

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

  const baseQs = {
    query: query || undefined,
    manager: managerFilter || undefined,
    reseller: resellerFilter || undefined,
    dealer: dealerFilter || undefined,
    autoRenew: autoRenew || undefined,
    pageSize: String(pageSize),
    sort,
    dir: dir === "desc" ? "desc" : undefined,
  };
  const resetReturnPath = `/admin/users${buildQs({
    ...baseQs,
    status: status && STATUS_FILTERS.includes(status as (typeof STATUS_FILTERS)[number]) ? status : undefined,
    page: String(page),
  })}`;

  const exportQs = new URLSearchParams();
  if (query) exportQs.set("query", query);
  if (managerFilter) exportQs.set("manager", managerFilter);
  if (resellerFilter) exportQs.set("reseller", resellerFilter);
  if (dealerFilter) exportQs.set("dealer", dealerFilter);
  if (autoRenew) exportQs.set("autoRenew", autoRenew);
  if (status) exportQs.set("status", status);
  const exportHref = `/api/admin/users/export${exportQs.toString() ? `?${exportQs.toString()}` : ""}`;

  const deleteErrMsg = portalUsersDeleteListErrorMessage(sp.error);
  const renewErrMsg = portalUsersRenewListErrorMessage(sp);
  const resetErrMsg = portalUsersResetListErrorMessage(sp.error);
  const statusErrMsg = portalUsersStatusQuickErrorMessage(sp.error);

  const userFlashItems: FlashToastItem[] = [
    ...(sp.ok === "1" || sp.ok === "save" ? [{ type: "success" as const, message: "Saved." }] : []),
    ...(sp.ok === "created" ? [{ type: "success" as const, message: "User created successfully." }] : []),
    ...(sp.ok === "user_saved" ? [{ type: "success" as const, message: "User profile updated successfully." }] : []),
    ...(sp.error === "save"
      ? [{ type: "error" as const, message: "Could not save user profile." }]
      : sp.error === "owner"
        ? [{ type: "error" as const, message: "Invalid owner mapping (reseller/dealer)." }]
        : sp.error === "pin"
          ? [{ type: "error" as const, message: "Parent PIN must be exactly 4 digits." }]
          : sp.error === "packages"
            ? [{ type: "error" as const, message: "Saved profile, but add-on package sync failed." }]
            : []),
    ...newEndUserCreationFlashItems(sp, "admin"),
    ...(sp.ok === "reset"
      ? [
          {
            type: "success" as const,
            message: "Stalker device bindings cleared (device_id, access_token) — same as PHP Reset.",
          },
        ]
      : []),
    ...(sp.ok === "deleted_user"
      ? [{ type: "success" as const, message: "User account was deleted successfully (PHP admin delete)." }]
      : []),
    ...(sp.ok === "renew"
      ? [{ type: "success" as const, message: "One month added (PHP renewOneMonth / grid +1)." }]
      : []),
    ...(sp.ok === "renew_trial"
      ? [{ type: "success" as const, message: "Free trial applied from quick +1 where configured." }]
      : []),
    ...(sp.ok === "renew_recover"
      ? [{ type: "success" as const, message: "RCDT-style recover completed from quick renew path." }]
      : []),
    ...(resetErrMsg ? [{ type: "error" as const, message: resetErrMsg }] : []),
    ...(deleteErrMsg ? [{ type: "error" as const, message: deleteErrMsg }] : []),
    ...(renewErrMsg ? [{ type: "error" as const, message: renewErrMsg }] : []),
    ...(statusErrMsg ? [{ type: "error" as const, message: statusErrMsg }] : []),
  ];

  const sortHref = (col: string) => {
    const nextDir = sort === col && dir === "asc" ? "desc" : "asc";
    return `/admin/users${buildQs({
      ...baseQs,
      status: status && STATUS_FILTERS.includes(status as (typeof STATUS_FILTERS)[number]) ? status : undefined,
      page: String(page),
      sort: col,
      dir: nextDir,
    })}`;
  };

  const sortUrls = {
    account: sortHref("account"),
    manager: sortHref("manager"),
    reseller: sortHref("reseller"),
    dealer: sortHref("dealer"),
    username: sortHref("username"),
    full_name: sortHref("full_name"),
    mac: sortHref("mac"),
    status: sortHref("status"),
    expires: sortHref("expires"),
  };
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const perPageHrefByValue = Object.fromEntries(
    PAGE_SIZE_OPTIONS.map((opt) => [
      opt.value,
      `/admin/users${buildQs({
        query: query || undefined,
        manager: managerFilter || undefined,
        reseller: resellerFilter || undefined,
        dealer: dealerFilter || undefined,
        autoRenew: autoRenew || undefined,
        status: status && STATUS_FILTERS.includes(status as (typeof STATUS_FILTERS)[number]) ? status : undefined,
        pageSize: opt.value,
        sort: sort !== "manager" ? sort : undefined,
        dir: dir === "desc" ? "desc" : undefined,
      })}`,
    ]),
  ) as Record<string, string>;
  const statusHrefByValue = Object.fromEntries(
    SUBSCRIBER_STATUS_FILTER_OPTIONS.map((opt) => [
      opt.value,
      `/admin/users${buildQs({
        query: query || undefined,
        manager: managerFilter || undefined,
        reseller: resellerFilter || undefined,
        dealer: dealerFilter || undefined,
        autoRenew: autoRenew || undefined,
        status: opt.value || undefined,
        pageSize: String(pageSize),
        sort: sort !== "manager" ? sort : undefined,
        dir: dir === "desc" ? "desc" : undefined,
      })}`,
    ]),
  ) as Record<string, string>;
  const autoRenewOptions = [
    { value: "", label: "Auto renew: All" },
    { value: "1", label: "Auto renew: Yes" },
    { value: "0", label: "Auto renew: No" },
  ] as const;
  const autoRenewHrefByValue = Object.fromEntries(
    autoRenewOptions.map((opt) => [
      opt.value,
      `/admin/users${buildQs({
        query: query || undefined,
        manager: managerFilter || undefined,
        reseller: resellerFilter || undefined,
        dealer: dealerFilter || undefined,
        autoRenew: opt.value || undefined,
        status: status && STATUS_FILTERS.includes(status as (typeof STATUS_FILTERS)[number]) ? status : undefined,
        pageSize: String(pageSize),
        sort: sort !== "manager" ? sort : undefined,
        dir: dir === "desc" ? "desc" : undefined,
      })}`,
    ]),
  ) as Record<string, string>;
  const filterNotice = managerFilter
    ? {
        message: "Showing users for manager",
        value: managerFilter,
        clearLabel: "Clear manager filter",
        clearHref: `/admin/users${buildQs({
          query: query || undefined,
          reseller: resellerFilter || undefined,
          dealer: dealerFilter || undefined,
          autoRenew: autoRenew || undefined,
          status: status && STATUS_FILTERS.includes(status as (typeof STATUS_FILTERS)[number]) ? status : undefined,
          pageSize: String(pageSize),
          sort,
          dir: dir === "desc" ? "desc" : undefined,
        })}`,
      }
    : resellerFilter
      ? {
          message: "Showing users for reseller",
          value: resellerFilter,
          clearLabel: "Clear reseller filter",
          clearHref: `/admin/users${buildQs({
            query: query || undefined,
            manager: managerFilter || undefined,
            dealer: dealerFilter || undefined,
            autoRenew: autoRenew || undefined,
            status: status && STATUS_FILTERS.includes(status as (typeof STATUS_FILTERS)[number]) ? status : undefined,
            pageSize: String(pageSize),
            sort,
            dir: dir === "desc" ? "desc" : undefined,
          })}`,
        }
      : dealerFilter
        ? {
            message: "Showing users for dealer",
            value: dealerFilter,
            clearLabel: "Clear dealer filter",
            clearHref: `/admin/users${buildQs({
              query: query || undefined,
              manager: managerFilter || undefined,
              reseller: resellerFilter || undefined,
              autoRenew: autoRenew || undefined,
              status: status && STATUS_FILTERS.includes(status as (typeof STATUS_FILTERS)[number]) ? status : undefined,
              pageSize: String(pageSize),
              sort,
              dir: dir === "desc" ? "desc" : undefined,
            })}`,
          }
        : undefined;

  const onlineKpi =
    !notifyPrefs.notifyDeviceOffline ? "—" : devicesOnline === null ? "—" : formatInt(devicesOnline);
  const totalSummary = Math.max(0, Number(summary.all) || 0);
  const activePct = formatPct(Math.max(0, Number(summary.active) || 0), totalSummary);
  const expiredPct = formatPct(Math.max(0, Number(summary.expired) || 0), totalSummary);
  const expiringPct = formatPct(Math.max(0, Number(expiringSoon) || 0), totalSummary);
  const onlinePct =
    notifyPrefs.notifyDeviceOffline && devicesOnline !== null
      ? formatPct(Math.max(0, Number(devicesOnline) || 0), totalSummary)
      : "—";
  const cardHref = (nextStatus?: (typeof STATUS_FILTERS)[number]) =>
    `/admin/users${buildQs({
      query: query || undefined,
      manager: managerFilter || undefined,
      reseller: resellerFilter || undefined,
      dealer: dealerFilter || undefined,
      status: nextStatus,
      pageSize: String(pageSize),
      sort: sort !== "manager" ? sort : undefined,
      dir: dir === "desc" ? "desc" : undefined,
    })}`;

  return (
    <div className="mx-auto w-full max-w-[min(100%,1920px)] space-y-6">
      {userFlashItems.length ? (
        <FlashToastsBoundary items={userFlashItems} stripParams={["ok", "error", "bal", "req", "renew_acc"]} />
      ) : null}
      <PageHeader
        title="Users"
        breadcrumb="Manage and monitor all user accounts."
        showBack={false}
      />

      <section aria-label="User summary" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Link
          href={cardHref()}
          className="rounded-xl border border-border/60 bg-card/90 px-4 py-3 shadow-sm ring-1 ring-black/[0.03] transition-colors hover:bg-muted/30 dark:ring-white/[0.05]"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Total</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{formatInt(summary.all)}</p>
        </Link>
        <Link
          href={cardHref("active")}
          className="rounded-xl border border-border/60 bg-card/90 px-4 py-3 shadow-sm ring-1 ring-black/[0.03] transition-colors hover:bg-muted/30 dark:ring-white/[0.05]"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-400/90">Active</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-300">{formatInt(summary.active)}</p>
          <p className="mt-1 text-xs font-medium text-emerald-200/85">of total: {activePct}</p>
        </Link>
        <Link
          href={cardHref("expired")}
          className="rounded-xl border border-border/60 bg-card/90 px-4 py-3 shadow-sm ring-1 ring-black/[0.03] transition-colors hover:bg-muted/30 dark:ring-white/[0.05]"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-400/90">Expired</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-rose-300">{formatInt(summary.expired)}</p>
          <p className="mt-1 text-xs font-medium text-rose-200/85">of total: {expiredPct}</p>
        </Link>
        <Link
          href={cardHref("expiring")}
          className="rounded-xl border border-border/60 bg-card/90 px-4 py-3 shadow-sm ring-1 ring-black/[0.03] transition-colors hover:bg-muted/30 dark:ring-white/[0.05]"
          title={
            notifyPrefs.notifyExpiringSubscriptions ? undefined : "Enable “Expiring subscriptions alert” in Settings → Notifications"
          }
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-400/90">Expiring</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-200">
            {notifyPrefs.notifyExpiringSubscriptions ? formatInt(expiringSoon) : "—"}
          </p>
          <p className="mt-1 text-xs font-medium text-amber-200/85">
            of total: {notifyPrefs.notifyExpiringSubscriptions ? expiringPct : "—"}
          </p>
        </Link>
        <Link
          href={cardHref("activity")}
          className="col-span-2 rounded-xl border border-border/60 bg-card/90 px-4 py-3 shadow-sm ring-1 ring-black/[0.03] transition-colors hover:bg-muted/30 dark:ring-white/[0.05] sm:col-span-1"
          title={
            notifyPrefs.notifyDeviceOffline ? undefined : "Enable “Device offline alerts” in Settings → Notifications"
          }
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-400/90">Online</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-sky-300">{onlineKpi}</p>
          <p className="mt-1 text-xs font-medium text-sky-200/85">of total: {onlinePct}</p>
        </Link>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/95 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
        <AdminSubscribersTable
          rows={rows}
          validityOptions={validityOptions}
          sortUrls={sortUrls}
          sort={sort}
          dir={dir}
          resetReturnPath={resetReturnPath}
          filterNotice={filterNotice}
          actionLinks={{ exportHref, addSubscriberHref: "/admin/users/new" }}
          embedded
          toolbarFilters={{
            query,
            status: status ?? "",
            autoRenew,
            statusOptions: SUBSCRIBER_STATUS_FILTER_OPTIONS,
            statusHrefByValue,
            autoRenewOptions: [...autoRenewOptions],
            autoRenewHrefByValue,
            pageSize: String(pageSize),
            pageSizeOptions: PAGE_SIZE_OPTIONS,
            pageSizeHrefByValue: perPageHrefByValue,
            searchAction: "/admin/users",
            searchHiddenParams: {
              ...(managerFilter ? { manager: managerFilter } : {}),
              ...(resellerFilter ? { reseller: resellerFilter } : {}),
              ...(dealerFilter ? { dealer: dealerFilter } : {}),
              pageSize: String(pageSize),
              ...(sort !== "manager" ? { sort } : {}),
              ...(dir === "desc" ? { dir: "desc" } : {}),
              page: "1",
            },
          }}
          addUserModalData={{
            resellers,
            tariffs,
            validityOptions,
            customPlanId,
            addonPackages,
          }}
          initialAddUserOpen={sp.addUser === "1"}
          initialEditAccount={(sp.editAccount ?? "").trim()}
        />
        <div className="flex flex-col gap-2 border-t border-border/60 px-4 py-2 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-5">
          <nav className="flex min-w-0 flex-wrap items-center justify-center gap-1.5 sm:justify-end" aria-label="Users list pages">
            <Link
              href={`/admin/users${buildQs({
                ...baseQs,
                status: status && STATUS_FILTERS.includes(status as (typeof STATUS_FILTERS)[number]) ? status : undefined,
                page: String(page - 1),
              })}`}
              aria-disabled={page <= 1}
              className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-medium ${
                page <= 1 ? "pointer-events-none border-border/40 text-muted-foreground opacity-50" : "border-border/70 hover:bg-muted/50"
              }`}
            >
              Prev
            </Link>
            {buildPaginationItems(totalPages, page, 2).map((item, idx) =>
              item === "ellipsis" ? (
                <span key={`ellipsis-${idx}`} className="inline-flex min-w-8 items-center justify-center px-0.5 text-muted-foreground" aria-hidden>
                  …
                </span>
              ) : item === page ? (
                <span
                  key={item}
                  aria-current="page"
                  className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-primary/45 bg-primary/12 px-2 text-xs font-semibold text-primary"
                >
                  {item}
                </span>
              ) : (
                <Link
                  key={item}
                  href={`/admin/users${buildQs({
                    ...baseQs,
                    status: status && STATUS_FILTERS.includes(status as (typeof STATUS_FILTERS)[number]) ? status : undefined,
                    page: String(item),
                  })}`}
                  className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-border/70 px-2 text-xs text-foreground hover:bg-muted/50"
                >
                  {item}
                </Link>
              ),
            )}
            <form method="get" action="/admin/users" className="ml-1 inline-flex items-center gap-1">
              {query ? <input type="hidden" name="query" value={query} /> : null}
              {managerFilter ? <input type="hidden" name="manager" value={managerFilter} /> : null}
              {resellerFilter ? <input type="hidden" name="reseller" value={resellerFilter} /> : null}
              {dealerFilter ? <input type="hidden" name="dealer" value={dealerFilter} /> : null}
              {autoRenew ? <input type="hidden" name="autoRenew" value={autoRenew} /> : null}
              {status && STATUS_FILTERS.includes(status as (typeof STATUS_FILTERS)[number]) ? (
                <input type="hidden" name="status" value={status} />
              ) : null}
              <input type="hidden" name="pageSize" value={String(pageSize)} />
              {sort !== "manager" ? <input type="hidden" name="sort" value={sort} /> : null}
              {dir === "desc" ? <input type="hidden" name="dir" value="desc" /> : null}
              <label htmlFor="users-jump-page" className="sr-only">
                Go to page
              </label>
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pg</span>
              <input
                id="users-jump-page"
                name="page"
                type="number"
                min={1}
                max={totalPages}
                defaultValue={page}
                inputMode="numeric"
                className="h-8 w-14 appearance-none rounded-md border border-border/70 bg-background px-2 text-center text-xs font-semibold text-foreground outline-none [appearance:textfield] [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ring-offset-background transition-[border-color,box-shadow] focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-ring"
              />
            </form>
            <Link
              href={`/admin/users${buildQs({
                ...baseQs,
                status: status && STATUS_FILTERS.includes(status as (typeof STATUS_FILTERS)[number]) ? status : undefined,
                page: String(page + 1),
              })}`}
              aria-disabled={page >= totalPages}
              className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-medium ${
                page >= totalPages ? "pointer-events-none border-border/40 text-muted-foreground opacity-50" : "border-border/70 hover:bg-muted/50"
              }`}
            >
              Next
            </Link>
          </nav>
          <p className="text-center text-xs text-muted-foreground/80 sm:flex-1">
            Tip: double-click Name or Status to edit.
          </p>
          <span className="text-right text-xs text-muted-foreground sm:text-sm">
            Showing {total === 0 ? 0 : (page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}
          </span>
        </div>
      </section>
    </div>
  );
}

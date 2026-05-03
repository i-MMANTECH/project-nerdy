import Link from "next/link";
import { BriefcaseBusiness, ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, CornerUpLeft, Settings2, Store, UserRoundCog } from "lucide-react";
import { getManagers, getResellers, getDealers, getOperatorTransactions } from "@/lib/data";
import { AdminManagerRowActions } from "@/components/admin/AdminManagerRowActions";
import { AdminResellerRowActions } from "@/components/admin/AdminResellerRowActions";
import { AdminDealerRowActions } from "@/components/admin/AdminDealerRowActions";
import { AdminAddStaffModal } from "@/components/admin/AdminAddStaffModal";
import { AdminStaffEditModalTrigger } from "@/components/admin/AdminStaffEditModalTrigger";
import { AdminListModalTrigger } from "@/components/admin/AdminListModalTrigger";
import { AdminUsersListModalTrigger } from "@/components/admin/AdminUsersListModalTrigger";
import { ManagersFiltersBar } from "@/components/admin/ManagersFiltersBar";
import { ManagersColumnSettings } from "@/components/admin/ManagersColumnSettings";
import { InlineEditableStaffCell } from "@/components/admin/InlineEditableStaffCell";
import { cn } from "@/lib/cn";
import { dataTableStickyTh } from "@/lib/ui/dataTableSticky";
import { FlashToastsBoundary } from "@/components/FlashToasts";
import { adminStaffCreateSuccessFlashItems, adminStaffListFlashItems, adminStaffPasswordResetFlashItems } from "@/lib/adminInlineFlashToasts";
import { adminHierarchyNewMissingFlashItems } from "@/lib/urlFlashToasts";

type Props = {
  searchParams?: Promise<{
    ok?: string;
    error?: string;
    q?: string;
    p?: string;
    ps?: string;
    type?: string;
    status?: string;
    sort?: string;
    dir?: string;
    cols?: string | string[];
    staff_new?: string;
    credit_modal?: string;
    credit_user?: string;
    quick?: string;
    bq?: string;
    bs?: string;
    modal?: string;
  }>;
};

type SortKey =
  | "name"
  | "username"
  | "password"
  | "credits"
  | "dealerCount"
  | "parentReseller"
  | "status"
  | "state"
  | "type"
  | "activeUsers"
  | "expiredUsers"
  | "totalUsers";

type SortDir = "asc" | "desc";

function managersListPath(sp: {
  q?: string;
  p?: number;
  ps?: number;
  type?: string;
  status?: string;
  sort?: SortKey;
  dir?: SortDir;
  cols?: string;
  quick?: string;
  bq?: string;
  bs?: string;
}) {
  const params = new URLSearchParams();
  const q = sp.q?.trim();
  if (q) params.set("q", q);
  if (sp.ps && [10, 25, 50, 100].includes(sp.ps)) params.set("ps", String(sp.ps));
  if (sp.type && ["manager", "reseller", "dealer"].includes(sp.type)) params.set("type", sp.type);
  if (sp.status && ["active", "inactive"].includes(sp.status)) params.set("status", sp.status);
  if (sp.sort) params.set("sort", sp.sort);
  if (sp.dir) params.set("dir", sp.dir);
  if (sp.cols) params.set("cols", sp.cols);
  if (sp.quick === "1") params.set("quick", "1");
  const backQ = sp.bq?.trim();
  if (backQ) params.set("bq", backQ);
  if (sp.bs && ["active", "inactive"].includes(sp.bs)) params.set("bs", sp.bs);
  if (sp.p && sp.p > 1) params.set("p", String(sp.p));
  const query = params.toString();
  return query ? `/admin/managers?${query}` : "/admin/managers";
}

function formatInt(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

function hasPositiveCount(value: number | string | null | undefined) {
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") return Number.parseInt(value, 10) > 0;
  return false;
}

function parseBillingDateTime(raw: string): Date | null {
  const s = String(raw ?? "").trim();
  if (!s || s === "—" || s === "0000-00-00 00:00:00" || s.startsWith("0000-00-00")) return null;
  const t = Date.parse(s.includes("T") ? s : s.replace(" ", "T"));
  if (Number.isNaN(t)) return null;
  return new Date(t);
}

function formatStateLastSeen(raw: string): string {
  const d = parseBillingDateTime(raw);
  if (!d) return "Never seen";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatStateRelative(raw: string): string {
  const d = parseBillingDateTime(raw);
  if (!d) return "No login recorded";
  const now = Date.now();
  const diffMs = Math.max(0, now - d.getTime());
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (days < 365) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

function pickDbStateDate(currentRaw: string, lastRaw: string): Date | null {
  const current = parseBillingDateTime(currentRaw);
  const last = parseBillingDateTime(lastRaw);
  if (current && last) return current.getTime() >= last.getTime() ? current : last;
  return current ?? last;
}

function getLoginAgeToneClass(d: Date | null): string {
  if (!d) return "text-rose-600 dark:text-rose-400";
  const ageMs = Date.now() - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (ageMs < 7 * day) return "text-emerald-700 dark:text-emerald-300";
  if (ageMs >= 365 * day) return "text-rose-600 dark:text-rose-400";
  if (ageMs >= 180 * day) return "text-orange-600 dark:text-orange-400";
  if (ageMs >= 90 * day) return "text-amber-600 dark:text-amber-300";
  return "text-slate-700 dark:text-slate-200";
}

type LoginPresence = {
  label: "ONLINE" | "IDLE" | "OFFLINE";
  badgeClass: string;
  relativeClass: string;
};

function derivePresenceFromCurrentLogin(current: Date | null): LoginPresence {
  if (!current) {
    return {
      label: "OFFLINE",
      badgeClass:
        "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/12 dark:text-slate-200",
      relativeClass: "text-slate-600 dark:text-slate-300",
    };
  }
  const ageMs = Math.max(0, Date.now() - current.getTime());
  if (ageMs <= 5 * 60 * 1000) {
    return {
      label: "ONLINE",
      badgeClass:
        "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/12 dark:text-emerald-200",
      relativeClass: "text-emerald-700 dark:text-emerald-300",
    };
  }
  if (ageMs <= 24 * 60 * 60 * 1000) {
    return {
      label: "IDLE",
      badgeClass:
        "border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/12 dark:text-amber-200",
      relativeClass: "text-amber-700 dark:text-amber-300",
    };
  }
  return {
    label: "OFFLINE",
    badgeClass:
      "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/12 dark:text-slate-200",
    relativeClass: "text-slate-600 dark:text-slate-300",
  };
}


const STAFF_TYPE_ORDER = { MANAGER: 0, RESELLER: 1, DEALER: 2 } as const;

function compareStaffRows(
  a: { rowType: keyof typeof STAFF_TYPE_ORDER; username: string },
  b: { rowType: keyof typeof STAFF_TYPE_ORDER; username: string },
) {
  const ta = STAFF_TYPE_ORDER[a.rowType];
  const tb = STAFF_TYPE_ORDER[b.rowType];
  if (ta !== tb) return ta - tb;
  return a.username.localeCompare(b.username, undefined, { sensitivity: "base" });
}

/** Page numbers with gaps as `"ellipsis"` — avoids rendering dozens of buttons. */
function buildPaginationItems(totalPages: number, currentPage: number, siblingDelta: number): (number | "ellipsis")[] {
  if (totalPages <= 1) return [];
  const left = currentPage - siblingDelta;
  const right = currentPage + siblingDelta;
  const nums: number[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= left && i <= right)) {
      nums.push(i);
    }
  }
  const out: (number | "ellipsis")[] = [];
  let prev: number | undefined;
  for (const i of nums) {
    if (prev !== undefined) {
      if (i - prev === 2) {
        out.push(prev + 1);
      } else if (i - prev > 2) {
        out.push("ellipsis");
      }
    }
    out.push(i);
    prev = i;
  }
  return out;
}

const pageBtnBase =
  "inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg border px-2 text-sm tabular-nums touch-manipulation transition-colors";

const COLUMN_IDS = [
  "name",
  "username",
  "credits",
  "dealerCount",
  "parentReseller",
  "status",
  "state",
  "type",
  "activeUsers",
  "expiredUsers",
  "totalUsers",
] as const;

type ColumnId = (typeof COLUMN_IDS)[number];

const COLUMN_LABELS: Record<ColumnId, string> = {
  name: "Name",
  username: "Username",
  credits: "Credits",
  dealerCount: "Resellers / dealers",
  parentReseller: "Parent",
  status: "Status",
  state: "State",
  type: "Type",
  activeUsers: "Active",
  expiredUsers: "Expired",
  totalUsers: "Total",
};

const SORT_KEYS: readonly SortKey[] = [
  "name",
  "username",
  "password",
  "credits",
  "dealerCount",
  "parentReseller",
  "status",
  "state",
  "type",
  "activeUsers",
  "expiredUsers",
  "totalUsers",
];

function staffHierarchyBranchCount(r: {
  rowType: keyof typeof STAFF_TYPE_ORDER;
  managerResellerCount?: number;
  dealerCount: number;
}) {
  if (r.rowType === "MANAGER") return r.managerResellerCount ?? 0;
  if (r.rowType === "RESELLER") return r.dealerCount;
  return 0;
}

function compareBySort(
  a: {
    rowType: keyof typeof STAFF_TYPE_ORDER;
    username: string;
    name: string;
    credits: number;
    managerResellerCount?: number;
    dealerCount: number;
    parentReseller: string;
    status: string;
    stateCurrentLogin: string;
    stateLastLogin: string;
    activeUsers: number;
    expiredUsers: number;
    totalUsers: number;
  },
  b: {
    rowType: keyof typeof STAFF_TYPE_ORDER;
    username: string;
    name: string;
    credits: number;
    managerResellerCount?: number;
    dealerCount: number;
    parentReseller: string;
    status: string;
    stateCurrentLogin: string;
    stateLastLogin: string;
    activeUsers: number;
    expiredUsers: number;
    totalUsers: number;
  },
  sortBy: SortKey,
  sortDir: SortDir,
) {
  const dir = sortDir === "asc" ? 1 : -1;
  const txt = (x: string, y: string) => x.localeCompare(y, undefined, { sensitivity: "base" });
  const num = (x: number, y: number) => x - y;
  const date = (x: Date | null, y: Date | null) => (x?.getTime() ?? 0) - (y?.getTime() ?? 0);

  let out = 0;
  switch (sortBy) {
    case "name":
      out = txt(a.name || "", b.name || "");
      break;
    case "username":
      out = txt(a.username, b.username);
      break;
    case "credits":
      out = num(a.credits, b.credits);
      break;
    case "dealerCount":
      out = num(staffHierarchyBranchCount(a), staffHierarchyBranchCount(b));
      break;
    case "parentReseller":
      out = txt(a.parentReseller || "", b.parentReseller || "");
      break;
    case "status":
      out = txt(a.status, b.status);
      break;
    case "state":
      out = date(
        pickDbStateDate(a.stateCurrentLogin, a.stateLastLogin),
        pickDbStateDate(b.stateCurrentLogin, b.stateLastLogin),
      );
      break;
    case "type":
      out = num(STAFF_TYPE_ORDER[a.rowType], STAFF_TYPE_ORDER[b.rowType]);
      break;
    case "activeUsers":
      out = num(a.activeUsers, b.activeUsers);
      break;
    case "expiredUsers":
      out = num(a.expiredUsers, b.expiredUsers);
      break;
    case "totalUsers":
      out = num(a.totalUsers, b.totalUsers);
      break;
  }
  if (out !== 0) return out * dir;
  return compareStaffRows(a, b);
}

export default async function ManagersPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const qRaw = (sp.q ?? "").trim().toLowerCase();
  const typeFilterRaw = (sp.type ?? "").trim().toLowerCase();
  const statusFilterRaw = (sp.status ?? "").trim().toLowerCase();
  const sortRaw = (sp.sort ?? "").trim();
  const dirRaw = (sp.dir ?? "").trim().toLowerCase();
  const typeFilter = typeFilterRaw === "manager" || typeFilterRaw === "reseller" || typeFilterRaw === "dealer" ? typeFilterRaw : "";
  const statusFilter = statusFilterRaw === "active" || statusFilterRaw === "inactive" ? statusFilterRaw : "";
  /** Preserved list state when drilling down (manager → reseller → dealer). */
  const drillbackParams: { bq?: string; bs?: "active" | "inactive" } = {};
  const bqStored = typeof sp.bq === "string" ? sp.bq.trim() : "";
  if (bqStored) drillbackParams.bq = bqStored;
  if (sp.bs === "active" || sp.bs === "inactive") drillbackParams.bs = sp.bs;
  const sortBy = SORT_KEYS.includes(sortRaw as SortKey) ? (sortRaw as SortKey) : ("type" as SortKey);
  const sortDir = dirRaw === "desc" ? "desc" : "asc";
  const page = Math.max(1, Number.parseInt(sp.p ?? "1", 10) || 1);
  const pageSizeRaw = Number.parseInt(sp.ps ?? "10", 10);
  const pageSize = [10, 25, 50, 100].includes(pageSizeRaw) ? pageSizeRaw : 10;
  const rawCols = (Array.isArray(sp.cols) ? sp.cols : String(sp.cols ?? "").split(","))
    .map((x) => x.trim())
    .filter(Boolean);
  const parsedCols = rawCols.filter((c): c is ColumnId => (COLUMN_IDS as readonly string[]).includes(c));
  const visibleColumns = new Set<ColumnId>(parsedCols.length ? parsedCols : COLUMN_IDS);
  const quickFlag = sp.quick === "1" ? "1" : undefined;
  const isListModal = sp.modal === "1";
  const dealerCountLabel =
    typeFilter === "dealer"
      ? "Dealers"
        : typeFilter === "reseller"
        ? "Dealers"
        : typeFilter === "manager"
          ? "Resellers"
          : "Resellers / dealers";
  const columnLabels: Record<ColumnId, string> = {
    ...COLUMN_LABELS,
    dealerCount: dealerCountLabel,
  };
  /** Role-specific table cleanup: hide columns that are meaningless for the current type filter. */
  const tableColumns = new Set<ColumnId>(visibleColumns);
  if (typeFilter === "manager") {
    tableColumns.delete("parentReseller");
  }
  if (typeFilter === "dealer") {
    tableColumns.delete("dealerCount");
  }
  const columnSettingsLabels: Record<string, string> =
    typeFilter === "dealer"
      ? Object.fromEntries(Object.entries(columnLabels).filter(([id]) => id !== "dealerCount"))
      : typeFilter === "manager"
        ? Object.fromEntries(Object.entries(columnLabels).filter(([id]) => id !== "parentReseller"))
        : columnLabels;
  // Run these sequentially to avoid connection spikes on low MySQL limits.
  const managers = await getManagers();
  const resellers = await getResellers();
  const dealers = await getDealers();
  const all = [
    ...managers.map((r) => ({
      rowType: "MANAGER" as const,
      username: r.username,
      stateCurrentLogin: r.currentLoginTime,
      stateLastLogin: r.lastLoginTime,
      name: r.name,
      managerResellerCount: r.resellerCount,
      managerDealerCount: r.dealerCount,
      credits: r.credits,
      dealerCount: 0,
      parentReseller: "—",
      status: r.status,
      activeUsers: r.activeSubscriberCount,
      expiredUsers: r.expiredSubscriberCount,
      totalUsers: r.subscriberCount,
      canDelete: r.canDelete,
    })),
    ...resellers.map((r) => ({
      rowType: "RESELLER" as const,
      username: r.username,
      stateCurrentLogin: r.currentLoginTime,
      stateLastLogin: r.lastLoginTime,
      name: r.name,
      managerResellerCount: 0,
      managerDealerCount: 0,
      credits: r.credits,
      dealerCount: r.dealerCount,
      /** Billing parent for a reseller is the manager login (shown in Parent column). */
      parentReseller: (r.manager ?? "").trim() || "—",
      status: r.status,
      activeUsers: r.activeUserCount,
      expiredUsers: r.expiredUserCount,
      totalUsers: r.userCount,
      canDelete: r.canDelete,
      manager: r.manager,
    })),
    ...dealers.map((d) => ({
      rowType: "DEALER" as const,
      username: d.username,
      stateCurrentLogin: d.currentLoginTime,
      stateLastLogin: d.lastLoginTime,
      name: d.name,
      managerResellerCount: 0,
      managerDealerCount: 0,
      credits: d.credits,
      dealerCount: 0,
      parentReseller: d.reseller || "—",
      status: d.status,
      activeUsers: d.activeUserCount,
      expiredUsers: d.expiredUserCount,
      totalUsers: d.userCount,
      canDelete: d.canDelete,
      reseller: d.reseller,
      manager: d.manager,
    })),
  ];

  const searchFilteredRows = qRaw
    ? all.filter((r) => {
        const statusLabel = r.status === "A" ? "active" : "inactive";
        const extra =
          r.rowType === "RESELLER"
            ? [r.manager]
            : r.rowType === "DEALER"
              ? [r.reseller, r.manager]
              : [];
        const hay = [
          r.username,
          formatStateLastSeen(r.stateCurrentLogin),
          formatStateLastSeen(r.stateLastLogin),
          r.name,
          r.rowType.toLowerCase(),
          String(r.dealerCount),
          String(r.managerResellerCount ?? 0),
          r.parentReseller,
          String(r.activeUsers),
          String(r.expiredUsers),
          String(r.totalUsers),
          String(r.credits),
          statusLabel,
          ...extra,
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(qRaw);
      })
    : all;

  const filteredRows = searchFilteredRows.filter((r) => {
    if (typeFilter && r.rowType.toLowerCase() !== typeFilter) return false;
    if (statusFilter) {
      const rowStatus = r.status === "A" ? "active" : "inactive";
      if (rowStatus !== statusFilter) return false;
    }
    return true;
  });

  const filteredRowsSorted = [...filteredRows].sort((a, b) => compareBySort(a, b, sortBy, sortDir));

  const totalPages = Math.max(1, Math.ceil(filteredRowsSorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const rows = filteredRowsSorted.slice(start, start + pageSize);
  const transactionsByUsername = new Map(
    await Promise.all(
      rows.map(async (r) => [r.username, await getOperatorTransactions(r.username)] as const),
    ),
  );

  const managerActive = managers.filter((m) => m.status === "A").length;
  const resellerActive = resellers.filter((r) => r.status === "A").length;
  const dealerActive = dealers.filter((d) => d.status === "A").length;
  const managerExpired = Math.max(0, managers.length - managerActive);
  const resellerExpired = Math.max(0, resellers.length - resellerActive);
  const dealerExpired = Math.max(0, dealers.length - dealerActive);
  const totalStaff = managers.length + resellers.length + dealers.length;
  const managerPct = totalStaff > 0 ? (managers.length / totalStaff) * 100 : 0;
  const resellerPct = totalStaff > 0 ? (resellers.length / totalStaff) * 100 : 0;
  const dealerPct = totalStaff > 0 ? (dealers.length / totalStaff) * 100 : 0;

  const colsQuery = visibleColumns.size === COLUMN_IDS.length ? undefined : Array.from(visibleColumns).join(",");
  const redirectPath = managersListPath({
    q: sp.q,
    p: currentPage,
    ps: pageSize,
    type: typeFilter,
    status: statusFilter,
    sort: sortBy,
    dir: sortDir,
    cols: colsQuery,
    quick: quickFlag,
    ...drillbackParams,
  });
  const staffNewMissing =
    sp.staff_new === "manager"
      ? adminHierarchyNewMissingFlashItems(sp, "manager")
      : sp.staff_new === "reseller"
        ? adminHierarchyNewMissingFlashItems(sp, "admin_reseller")
        : sp.staff_new === "dealer"
          ? adminHierarchyNewMissingFlashItems(sp, "admin_dealer")
          : [];
  const listFlashes = [
    ...staffNewMissing,
    ...adminStaffCreateSuccessFlashItems(sp),
    ...adminStaffPasswordResetFlashItems(sp),
    ...adminStaffListFlashItems(sp, "manager"),
    ...adminStaffListFlashItems(sp, "reseller"),
    ...adminStaffListFlashItems(sp, "dealer"),
  ].filter((item, idx, arr) => arr.findIndex((x) => x.type === item.type && x.message === item.message) === idx);

  const managerOptions = managers.map((m) => ({
    value: m.username,
    label: `${m.name} (${m.username})`,
  }));
  const resellerOptions = resellers.map((r) => ({
    value: r.username,
    label: `${r.name} (${r.username})`,
  }));
  const td = "px-3 py-1 align-middle text-sm text-foreground";
  const sortableHeader = (key: SortKey, label: string, thClassName?: string) => (
    <th className={dataTableStickyTh(thClassName)}>
      <Link
        href={managersListPath({
          q: sp.q,
          ps: pageSize,
          type: typeFilter,
          status: statusFilter,
          sort: key,
          dir: sortBy === key && sortDir === "asc" ? "desc" : "asc",
          cols: colsQuery,
          quick: quickFlag,
          ...drillbackParams,
        })}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          thClassName?.includes("text-right") ? "justify-end" : "",
          thClassName?.includes("text-center") ? "justify-center" : "",
        )}
      >
        {label}
        {sortBy === key ? (
          <ChevronDown className={cn("h-3.5 w-3.5", sortDir === "asc" ? "rotate-180" : "")} aria-hidden />
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
        )}
      </Link>
    </th>
  );

  /** Same drill-down as dashboard Team hierarchy — shortcuts filter this list (`type` / clear). */
  const staffFilterHref = (opts: { type?: "manager" | "reseller" | "dealer"; clearAll?: boolean }) => {
    if (opts.clearAll) {
      return managersListPath({
        q: sp.q,
        p: 1,
        ps: pageSize,
        status: statusFilter || undefined,
        sort: sortBy,
        dir: sortDir,
        cols: colsQuery,
      });
    }
    return managersListPath({
      q: sp.q,
      p: 1,
      ps: pageSize,
      type: opts.type,
      sort: sortBy,
      dir: sortDir,
      cols: colsQuery,
      quick: quickFlag,
      ...drillbackParams,
    });
  };
  const quickReturnHref =
    quickFlag === "1" && typeFilter === "dealer"
      ? (() => {
          /** List search before dealer drill (e.g. manager login on reseller list). Never use `sp.q` here — that is the drilled reseller, not the list filter. */
          const restoredListQ = typeof sp.bq === "string" ? sp.bq.trim() : "";
          const resellerListQ = restoredListQ || undefined;
          /** quick=1 only when there is a parent list filter to step back through (e.g. manager → resellers → dealers). Plain type=reseller + dealers → back should match that list without quick. */
          const resellerQuick = restoredListQ ? "1" : undefined;
          /** No `bq`: user was on plain type=resellers → dealers; return to full staff default (not `type=reseller` in URL). */
          if (!restoredListQ) {
            return managersListPath({
              p: 1,
              ps: pageSize,
              sort: sortBy,
              dir: sortDir,
              cols: colsQuery,
            });
          }
          return managersListPath({
            q: resellerListQ,
            p: 1,
            ps: pageSize,
            type: "reseller",
            status: (sp.bs === "active" || sp.bs === "inactive" ? sp.bs : statusFilter) || undefined,
            sort: sortBy,
            dir: sortDir,
            cols: colsQuery,
            quick: resellerQuick,
          });
        })()
      : quickFlag === "1" && typeFilter === "reseller"
        ? managersListPath({
            q: sp.bq !== undefined && sp.bq !== null ? String(sp.bq).trim() || undefined : undefined,
            p: 1,
            ps: pageSize,
            status: (sp.bs === "active" || sp.bs === "inactive" ? sp.bs : statusFilter) || undefined,
            sort: sortBy,
            dir: sortDir,
            cols: colsQuery,
          })
        : staffFilterHref({ clearAll: true });

  return (
    <div
      className={cn(
        "-mx-1 flex min-h-0 flex-col gap-3 overflow-hidden sm:-mx-2 lg:-mx-3",
        isListModal ? "h-full" : "max-h-[calc(100dvh-8rem)]",
      )}
    >
      {listFlashes.length ? (
        <FlashToastsBoundary items={listFlashes} stripParams={["ok", "error", "staff_new", "bal", "req", "credit_modal", "credit_user"]} />
      ) : null}

      {!isListModal ? <section aria-label="Staff hierarchy summary" className="shrink-0">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Link
            href={staffFilterHref({ clearAll: true })}
            className={cn(
              "rounded-2xl border border-slate-300/75 bg-slate-100/90 p-2.5 text-slate-900 shadow-sm ring-1 ring-black/[0.04] transition-colors dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:ring-white/[0.06]",
              !typeFilter
                ? "ring-2 ring-primary/45"
                : "hover:border-primary/40 hover:bg-slate-100 dark:hover:border-primary/45 dark:hover:bg-slate-900/90",
            )}
          >
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-300">Total</p>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
                <BriefcaseBusiness className="h-3.5 w-3.5" aria-hidden />
              </span>
            </div>
            <p className="text-3xl font-semibold tabular-nums leading-none text-slate-900 dark:text-slate-100">{formatInt(totalStaff)}</p>
            <div className="mt-2.5 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-300/80 dark:bg-slate-700/80">
              <div className="h-full bg-violet-400" style={{ width: `${managerPct}%` }} />
              <div className="h-full bg-sky-400" style={{ width: `${resellerPct}%` }} />
              <div className="h-full bg-amber-400" style={{ width: `${dealerPct}%` }} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-violet-400" aria-hidden />
                Managers: {formatInt(managers.length)}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-400" aria-hidden />
                Resellers: {formatInt(resellers.length)}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" aria-hidden />
                Dealers: {formatInt(dealers.length)}
              </span>
            </div>
          </Link>
          <Link
            href={staffFilterHref({ type: "manager" })}
            className={cn(
              "rounded-2xl border border-slate-300/75 bg-slate-100/90 p-2.5 text-slate-900 shadow-sm ring-1 ring-black/[0.04] transition-colors dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:ring-white/[0.06]",
              typeFilter === "manager"
                ? "ring-2 ring-violet-400/45"
                : "hover:border-violet-300/70 hover:bg-slate-100 dark:hover:border-violet-400/45 dark:hover:bg-slate-900/90",
            )}
          >
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-300">Managers</p>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-300">
                <UserRoundCog className="h-3.5 w-3.5" aria-hidden />
              </span>
            </div>
            <p className="text-3xl font-semibold tabular-nums leading-none text-slate-900 dark:text-slate-100">{formatInt(managers.length)}</p>
            <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-300/80 dark:bg-slate-700/80">
              <div className="h-full bg-emerald-500" style={{ width: `${managers.length > 0 ? (managerActive / managers.length) * 100 : 0}%` }} />
              <div className="h-full bg-amber-500" style={{ width: `${managers.length > 0 ? (managerExpired / managers.length) * 100 : 0}%` }} />
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                Active: {formatInt(managerActive)}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
                Expired: {formatInt(managerExpired)}
              </span>
            </div>
          </Link>
          <Link
            href={staffFilterHref({ type: "reseller" })}
            className={cn(
              "rounded-2xl border border-slate-300/75 bg-slate-100/90 p-2.5 text-slate-900 shadow-sm ring-1 ring-black/[0.04] transition-colors dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:ring-white/[0.06]",
              typeFilter === "reseller"
                ? "ring-2 ring-sky-400/45"
                : "hover:border-sky-300/70 hover:bg-slate-100 dark:hover:border-sky-400/45 dark:hover:bg-slate-900/90",
            )}
          >
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-300">Resellers</p>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-300">
                <Store className="h-3.5 w-3.5" aria-hidden />
              </span>
            </div>
            <p className="text-3xl font-semibold tabular-nums leading-none text-slate-900 dark:text-slate-100">{formatInt(resellers.length)}</p>
            <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-300/80 dark:bg-slate-700/80">
              <div className="h-full bg-emerald-500" style={{ width: `${resellers.length > 0 ? (resellerActive / resellers.length) * 100 : 0}%` }} />
              <div className="h-full bg-amber-500" style={{ width: `${resellers.length > 0 ? (resellerExpired / resellers.length) * 100 : 0}%` }} />
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                Active: {formatInt(resellerActive)}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
                Expired: {formatInt(resellerExpired)}
              </span>
            </div>
          </Link>
          <Link
            href={staffFilterHref({ type: "dealer" })}
            className={cn(
              "rounded-2xl border border-slate-300/75 bg-slate-100/90 p-2.5 text-slate-900 shadow-sm ring-1 ring-black/[0.04] transition-colors dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:ring-white/[0.06]",
              typeFilter === "dealer"
                ? "ring-2 ring-slate-300/45"
                : "hover:border-slate-300/70 hover:bg-slate-100 dark:hover:border-slate-300/45 dark:hover:bg-slate-900/90",
            )}
          >
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-300">Dealers</p>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-500/15 text-slate-600 dark:text-slate-300">
                <BriefcaseBusiness className="h-3.5 w-3.5" aria-hidden />
              </span>
            </div>
            <p className="text-3xl font-semibold tabular-nums leading-none text-slate-900 dark:text-slate-100">{formatInt(dealers.length)}</p>
            <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-300/80 dark:bg-slate-700/80">
              <div className="h-full bg-emerald-500" style={{ width: `${dealers.length > 0 ? (dealerActive / dealers.length) * 100 : 0}%` }} />
              <div className="h-full bg-amber-500" style={{ width: `${dealers.length > 0 ? (dealerExpired / dealers.length) * 100 : 0}%` }} />
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                Active: {formatInt(dealerActive)}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
                Expired: {formatInt(dealerExpired)}
              </span>
            </div>
          </Link>
        </div>
      </section> : null}

      <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/95 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
        <div className="shrink-0 border-b border-border/50 px-4 pb-3 pt-3 sm:px-5 sm:pt-4">
          <div className="flex min-w-0 items-start gap-4">
            <div className="min-w-0 flex-1">
              <ManagersFiltersBar
                q={sp.q}
                type={typeFilter}
                status={statusFilter}
                ps={pageSize}
                sort={sortBy}
                dir={sortDir}
                cols={colsQuery}
                quick={quickFlag}
                bq={drillbackParams.bq}
                bs={drillbackParams.bs}
              />
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {sp.quick === "1" ? (
                <Link
                  href={quickReturnHref}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/70 bg-background/60 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                  title="Return to full staff list"
                  aria-label="Return to full staff list"
                >
                  <CornerUpLeft className="h-4 w-4" aria-hidden />
                </Link>
              ) : null}
              <ManagersColumnSettings
                selectedColumns={Array.from(visibleColumns)}
                labels={columnSettingsLabels}
                currentQuery={{
                  q: sp.q,
                  p: currentPage,
                  ps: pageSize,
                  type: typeFilter,
                  status: statusFilter,
                  sort: sortBy,
                  dir: sortDir,
                  quick: quickFlag,
                  bq: drillbackParams.bq,
                  bs: drillbackParams.bs,
                }}
              />
              <AdminAddStaffModal
                managerOptions={managerOptions}
                resellerOptions={resellerOptions}
                iconOnlyTrigger
                triggerClassName="h-9 w-9"
              />
            </div>
          </div>
        </div>
        <div className="app-data-table-scroll thin-scrollbar min-h-0 overflow-auto">
          <table className="w-full min-w-[1180px] border-collapse text-sm">
            <thead>
              <tr>
                {tableColumns.has("name") ? sortableHeader("name", columnLabels.name, "py-1.5 text-center") : null}
                {tableColumns.has("username") ? sortableHeader("username", columnLabels.username, "py-1.5 text-center") : null}
                {tableColumns.has("credits") ? sortableHeader("credits", columnLabels.credits, "py-1.5 text-center") : null}
                {tableColumns.has("dealerCount") ? sortableHeader("dealerCount", columnLabels.dealerCount, "py-1.5 text-center") : null}
                {tableColumns.has("parentReseller") ? sortableHeader("parentReseller", columnLabels.parentReseller, "py-1.5 text-center") : null}
                {tableColumns.has("status") ? sortableHeader("status", columnLabels.status, "py-1.5 text-center") : null}
                {tableColumns.has("state") ? sortableHeader("state", columnLabels.state, "py-1.5 text-center") : null}
                {tableColumns.has("type") ? sortableHeader("type", columnLabels.type, "py-1.5 text-center") : null}
                {tableColumns.has("activeUsers") ? sortableHeader("activeUsers", columnLabels.activeUsers, "py-1.5 text-center") : null}
                {tableColumns.has("expiredUsers") ? sortableHeader("expiredUsers", columnLabels.expiredUsers, "py-1.5 text-center") : null}
                {tableColumns.has("totalUsers") ? sortableHeader("totalUsers", columnLabels.totalUsers, "py-1.5 text-center") : null}
                <th className={dataTableStickyTh("py-1.5 text-center")}>
                  <span className="inline-flex items-center justify-center" aria-hidden>
                    <Settings2 className="h-4 w-4" />
                  </span>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={tableColumns.size + 1} className="px-4 py-12 text-center">
                    <p className="text-sm font-medium text-foreground">
                      {qRaw ? "No staff rows match your search" : "No staff rows yet"}
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {qRaw
                        ? "Clear the search box to see the full list, or try another keyword."
                        : "Create staff with Add manager, Add reseller, or Add dealer when you are ready to onboard."}
                    </p>
                  </td>
                </tr>
              ) : null}
              {rows.map((r) => {
                const branchHref =
                  r.rowType === "MANAGER"
                    ? managersListPath({
                        q: r.username,
                        p: 1,
                        ps: pageSize,
                        type: "reseller",
                        status: statusFilter,
                        sort: sortBy,
                        dir: sortDir,
                        cols: colsQuery,
                        quick: quickFlag ?? "1",
                        bq: sp.q,
                        ...(statusFilter === "active" || statusFilter === "inactive" ? { bs: statusFilter } : {}),
                      })
                    : r.rowType === "RESELLER"
                      ? managersListPath({
                          q: r.username,
                          p: 1,
                          ps: pageSize,
                          type: "dealer",
                          status: statusFilter,
                          sort: sortBy,
                          dir: sortDir,
                          cols: colsQuery,
                          quick: quickFlag ?? "1",
                          bq: sp.q,
                          ...(statusFilter === "active" || statusFilter === "inactive" ? { bs: statusFilter } : {}),
                        })
                      : undefined;
                const parentHref =
                  r.rowType === "RESELLER" && r.manager
                    ? `/admin/managers/${encodeURIComponent(r.manager)}`
                    : r.rowType === "DEALER" && r.reseller
                      ? `/admin/resellers/${encodeURIComponent(r.reseller)}`
                      : undefined;
                const parentModalType =
                  r.rowType === "RESELLER" && r.manager ? "MANAGER" : r.rowType === "DEALER" && r.reseller ? "RESELLER" : null;
                const parentModalUsername = r.rowType === "RESELLER" ? r.manager : r.rowType === "DEALER" ? r.reseller : "";
                return (
                <tr
                  key={`${r.rowType}:${r.username}`}
                  className="border-b border-border/70 transition-colors last:border-0 odd:bg-background/80 even:bg-muted/[0.16] hover:bg-muted/30 dark:border-border/40 dark:odd:bg-transparent dark:even:bg-transparent dark:hover:bg-muted/15"
                >
                  {tableColumns.has("name") ? (
                    <td className={`${td} text-center font-semibold`}>
                      <InlineEditableStaffCell rowType={r.rowType} username={r.username} field="name" value={r.name || ""} />
                    </td>
                  ) : null}
                  {tableColumns.has("username") ? (
                    <td className={cn(td, "text-center")}>
                      <AdminStaffEditModalTrigger
                        rowType={r.rowType}
                        username={r.username}
                        label={<span className="text-sm font-medium text-foreground hover:text-primary">{r.username}</span>}
                        className="inline cursor-pointer bg-transparent p-0 text-left"
                      />
                    </td>
                  ) : null}
                  {tableColumns.has("credits") ? (
                    <td className={cn(td, "text-center tabular-nums font-medium text-foreground")}>
                      <AdminStaffEditModalTrigger
                        rowType={r.rowType}
                        username={r.username}
                        initialView="credits"
                        label={<span className="text-foreground hover:text-primary">{formatInt(r.credits)}</span>}
                        className="inline cursor-pointer bg-transparent p-0 text-center"
                      />
                    </td>
                  ) : null}
                  {tableColumns.has("dealerCount") ? (
                    <td className={cn(td, "text-center tabular-nums text-muted-foreground")}>
                      {staffHierarchyBranchCount(r) > 0 && branchHref ? (
                        <AdminListModalTrigger
                          rowType={r.rowType === "MANAGER" ? "MANAGER" : "RESELLER"}
                          username={r.username}
                          className="inline rounded-none border-0 bg-transparent p-0 font-medium text-foreground no-underline shadow-none outline-none ring-0 hover:bg-transparent hover:text-primary focus:bg-transparent focus-visible:bg-transparent active:bg-transparent"
                          label={formatInt(staffHierarchyBranchCount(r))}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                  ) : null}
                  {tableColumns.has("parentReseller") ? (
                    <td className={cn(td, "text-center text-muted-foreground")}>
                      {parentModalType && parentModalUsername ? (
                        <AdminStaffEditModalTrigger
                          rowType={parentModalType}
                          username={parentModalUsername}
                          label={<span className="text-sm font-medium text-foreground hover:text-primary">{r.parentReseller || "—"}</span>}
                          className="inline cursor-pointer bg-transparent p-0 text-center"
                        />
                      ) : (
                        <span className="text-sm text-foreground">{r.parentReseller || "—"}</span>
                      )}
                    </td>
                  ) : null}
                  {tableColumns.has("status") ? (
                    <td className={`${td} text-center`}>
                      <InlineEditableStaffCell rowType={r.rowType} username={r.username} field="status" value={r.status} />
                    </td>
                  ) : null}
                  {tableColumns.has("state") ? (
                    <td className={cn(td, "text-center text-muted-foreground")}>
                      {(() => {
                        const currentDate = parseBillingDateTime(r.stateCurrentLogin);
                        const lastDate = parseBillingDateTime(r.stateLastLogin);
                        const effectiveDate = currentDate ?? lastDate;
                        const presence = derivePresenceFromCurrentLogin(currentDate);
                        return (
                          <div className="flex min-w-0 flex-col items-center gap-0.5 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide", presence.badgeClass)}>
                                {presence.label}
                              </span>
                              <span className={cn("text-xs font-semibold", presence.relativeClass, getLoginAgeToneClass(effectiveDate))}>
                                {effectiveDate ? formatStateRelative(effectiveDate.toISOString()) : "No login"}
                              </span>
                            </div>
                            <span className="text-[11px] text-muted-foreground">
                              {effectiveDate ? formatStateLastSeen(effectiveDate.toISOString()) : "—"}
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                  ) : null}
                  {tableColumns.has("type") ? (
                    <td
                    className={cn(
                      td,
                      "text-center",
                      "font-semibold",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                        r.rowType === "MANAGER"
                          ? "border-violet-300 bg-violet-100 text-violet-700 dark:border-violet-400/35 dark:bg-violet-500/12 dark:text-violet-200"
                          : r.rowType === "RESELLER"
                            ? "border-sky-300 bg-sky-100 text-sky-700 dark:border-sky-400/35 dark:bg-sky-500/12 dark:text-sky-200"
                            : "border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-400/35 dark:bg-amber-500/12 dark:text-amber-200",
                      )}
                    >
                      {r.rowType.toLowerCase()}
                    </span>
                    </td>
                  ) : null}
                  {tableColumns.has("activeUsers") ? (
                    <td className={cn(td, "text-center tabular-nums font-medium text-emerald-700 dark:text-emerald-300")}>
                      {hasPositiveCount(r.activeUsers) ? (
                        <AdminUsersListModalTrigger
                          rowType={r.rowType}
                          username={r.username}
                          displayName={r.name || r.username}
                          status="active"
                          className="inline rounded-none border-0 bg-transparent p-0 no-underline shadow-none outline-none ring-0 hover:bg-transparent hover:text-primary focus:bg-transparent focus-visible:bg-transparent active:bg-transparent"
                          label={formatInt(r.activeUsers)}
                        >
                        </AdminUsersListModalTrigger>
                      ) : (
                        <span className="text-muted-foreground">{formatInt(r.activeUsers)}</span>
                      )}
                    </td>
                  ) : null}
                  {tableColumns.has("expiredUsers") ? (
                    <td className={cn(td, "text-center tabular-nums font-medium text-orange-700 dark:text-orange-300")}>
                      {hasPositiveCount(r.expiredUsers) ? (
                        <AdminUsersListModalTrigger
                          rowType={r.rowType}
                          username={r.username}
                          displayName={r.name || r.username}
                          status="expired"
                          className="inline rounded-none border-0 bg-transparent p-0 no-underline shadow-none outline-none ring-0 hover:bg-transparent hover:text-primary focus:bg-transparent focus-visible:bg-transparent active:bg-transparent"
                          label={formatInt(r.expiredUsers)}
                        >
                        </AdminUsersListModalTrigger>
                      ) : (
                        <span className="text-muted-foreground">{formatInt(r.expiredUsers)}</span>
                      )}
                    </td>
                  ) : null}
                  {tableColumns.has("totalUsers") ? (
                    <td className={cn(td, "text-center tabular-nums font-medium text-muted-foreground")}>
                      {hasPositiveCount(r.totalUsers) ? (
                        <AdminUsersListModalTrigger
                          rowType={r.rowType}
                          username={r.username}
                          displayName={r.name || r.username}
                          status=""
                          className="inline rounded-none border-0 bg-transparent p-0 font-medium text-foreground no-underline shadow-none outline-none ring-0 hover:bg-transparent hover:text-primary focus:bg-transparent focus-visible:bg-transparent active:bg-transparent"
                          label={formatInt(r.totalUsers)}
                        >
                        </AdminUsersListModalTrigger>
                      ) : (
                        <span>{formatInt(r.totalUsers)}</span>
                      )}
                    </td>
                  ) : null}
                  <td className={`${td} text-center`}>
                    {r.rowType === "MANAGER" ? (
                      <AdminManagerRowActions
                        username={r.username}
                        displayName={r.name || r.username}
                        canDelete={r.canDelete}
                        redirectPath={redirectPath}
                        status={r.status}
                        credits={r.credits}
                        resellerCount={r.managerResellerCount}
                        dealerCount={r.managerDealerCount}
                        activeUsers={r.activeUsers}
                        expiredUsers={r.expiredUsers}
                        totalUsers={r.totalUsers}
                        stateCurrentLogin={r.stateCurrentLogin}
                        initialCreditsModal={sp.credit_user === r.username ? sp.credit_modal : undefined}
                        transactions={transactionsByUsername.get(r.username) ?? []}
                        viewResellersHref={managersListPath({
                          q: r.username,
                          p: 1,
                          ps: pageSize,
                          type: "reseller",
                          status: statusFilter,
                          sort: sortBy,
                          dir: sortDir,
                          cols: colsQuery,
                          quick: quickFlag ?? "1",
                          bq: sp.q,
                          ...(statusFilter === "active" || statusFilter === "inactive" ? { bs: statusFilter } : {}),
                        })}
                      />
                    ) : r.rowType === "RESELLER" ? (
                      <AdminResellerRowActions
                        username={r.username}
                        displayName={r.name || r.username}
                        canDelete={r.canDelete}
                        redirectPath={redirectPath}
                        status={r.status}
                        managerLogin={r.manager}
                        credits={r.credits}
                        dealerCount={r.dealerCount}
                        activeUsers={r.activeUsers}
                        expiredUsers={r.expiredUsers}
                        totalUsers={r.totalUsers}
                        stateCurrentLogin={r.stateCurrentLogin}
                        initialCreditsModal={sp.credit_user === r.username ? sp.credit_modal : undefined}
                        transactions={transactionsByUsername.get(r.username) ?? []}
                        viewDealersStaffHref={managersListPath({
                          q: r.username,
                          p: 1,
                          ps: pageSize,
                          type: "dealer",
                          status: statusFilter,
                          sort: sortBy,
                          dir: sortDir,
                          cols: colsQuery,
                          quick: quickFlag ?? "1",
                          bq: sp.q,
                          ...(statusFilter === "active" || statusFilter === "inactive" ? { bs: statusFilter } : {}),
                        })}
                      />
                    ) : (
                      <AdminDealerRowActions
                        username={r.username}
                        displayName={r.name || r.username}
                        canDelete={r.canDelete}
                        redirectPath={redirectPath}
                        status={r.status}
                        managerLogin={r.manager}
                        resellerLogin={r.reseller}
                        credits={r.credits}
                        activeUsers={r.activeUsers}
                        expiredUsers={r.expiredUsers}
                        totalUsers={r.totalUsers}
                        stateCurrentLogin={r.stateCurrentLogin}
                        initialCreditsModal={sp.credit_user === r.username ? sp.credit_modal : undefined}
                        transactions={transactionsByUsername.get(r.username) ?? []}
                      />
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex shrink-0 flex-col gap-2 border-t border-border/50 px-4 py-2 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <nav
            className="flex min-w-0 flex-wrap items-center justify-center gap-1.5 sm:justify-end"
            aria-label="Staff list pages"
          >
            <Link
              href={managersListPath({
                q: sp.q,
                p: currentPage - 1,
                ps: pageSize,
                type: typeFilter,
                status: statusFilter,
                sort: sortBy,
                dir: sortDir,
                cols: colsQuery,
                quick: quickFlag,
                ...drillbackParams,
              })}
              aria-disabled={currentPage <= 1}
              aria-label="Previous page"
              prefetch={false}
              className={cn(
                pageBtnBase,
                "font-medium",
                currentPage <= 1 ? "pointer-events-none border-border/40 text-muted-foreground opacity-50" : "border-border/70 hover:bg-muted/50",
              )}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Link>
            {buildPaginationItems(totalPages, currentPage, 2).map((item, idx) =>
              item === "ellipsis" ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="inline-flex min-w-8 select-none items-center justify-center px-0.5 text-muted-foreground"
                  aria-hidden
                >
                  …
                </span>
              ) : item === currentPage ? (
                <span
                  key={item}
                  aria-current="page"
                  className={cn(pageBtnBase, "cursor-default border-primary/45 bg-primary/12 font-semibold text-primary")}
                >
                  {item}
                </span>
              ) : (
                <Link
                  key={item}
                  href={managersListPath({
                    q: sp.q,
                    p: item,
                    ps: pageSize,
                    type: typeFilter,
                    status: statusFilter,
                    sort: sortBy,
                    dir: sortDir,
                    cols: colsQuery,
                    quick: quickFlag,
                    ...drillbackParams,
                  })}
                  prefetch={false}
                  className={cn(pageBtnBase, "border-border/70 text-foreground hover:bg-muted/50")}
                >
                  {item}
                </Link>
              ),
            )}
            <form method="get" action="/admin/managers" className="ml-1 inline-flex items-center gap-1">
              {sp.q ? <input type="hidden" name="q" value={sp.q} /> : null}
              {typeFilter ? <input type="hidden" name="type" value={typeFilter} /> : null}
              {statusFilter ? <input type="hidden" name="status" value={statusFilter} /> : null}
              <input type="hidden" name="sort" value={sortBy} />
              <input type="hidden" name="dir" value={sortDir} />
              <input type="hidden" name="ps" value={String(pageSize)} />
              {colsQuery ? <input type="hidden" name="cols" value={colsQuery} /> : null}
              {quickFlag ? <input type="hidden" name="quick" value={quickFlag} /> : null}
              {drillbackParams.bq ? <input type="hidden" name="bq" value={drillbackParams.bq} /> : null}
              {drillbackParams.bs ? <input type="hidden" name="bs" value={drillbackParams.bs} /> : null}
              <label htmlFor="staff-jump-page" className="sr-only">
                Go to page
              </label>
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pg</span>
              <input
                id="staff-jump-page"
                name="p"
                type="number"
                min={1}
                max={totalPages}
                defaultValue={currentPage}
                inputMode="numeric"
                className="h-9 w-14 appearance-none rounded-lg border border-border/70 bg-background px-2 text-center text-sm font-semibold text-foreground outline-none [appearance:textfield] [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ring-offset-background transition-[border-color,box-shadow] focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-ring"
              />
            </form>
            <Link
              href={managersListPath({
                q: sp.q,
                p: currentPage + 1,
                ps: pageSize,
                type: typeFilter,
                status: statusFilter,
                sort: sortBy,
                dir: sortDir,
                cols: colsQuery,
                quick: quickFlag,
                ...drillbackParams,
              })}
              aria-disabled={currentPage >= totalPages}
              aria-label="Next page"
              prefetch={false}
              className={cn(
                pageBtnBase,
                "font-medium",
                currentPage >= totalPages
                  ? "pointer-events-none border-border/40 text-muted-foreground opacity-50"
                  : "border-border/70 hover:bg-muted/50",
              )}
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </nav>
          <p className="text-xs text-muted-foreground/80 sm:ml-auto">
            Tip: double-click Name or Status to edit.
          </p>
          <p className="text-right text-xs text-muted-foreground sm:ml-auto">
            Showing <span className="font-medium">{rows.length}</span> of{" "}
            <span className="font-medium">{filteredRowsSorted.length}</span> filtered row
            {filteredRowsSorted.length === 1 ? "" : "s"} ({all.length} total staff)
            {qRaw ? ` for “${(sp.q ?? "").trim()}”.` : "."}
          </p>
        </div>
      </div>
    </div>
  );
}

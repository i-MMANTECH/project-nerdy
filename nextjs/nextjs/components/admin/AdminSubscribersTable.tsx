"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ChevronsUpDown,
  Download,
  Mail,
  MessageSquareText,
  Plus,
  ReceiptText,
  Search,
  Settings,
  Settings2,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  bulkDeleteAccountsAction,
  bulkRenewAccountsAction,
  bulkSendAccountsMessageAction,
  getAccountRenewRecoveryAvailabilityAction,
} from "@/actions/forms";
import { toastBulkRenewSummary } from "@/lib/bulkRenewResultToast";
import { AdminSubscriberRowActions } from "@/components/admin/AdminSubscriberRowActions";
import { InlineEditableUserCell } from "@/components/admin/InlineEditableUserCell";
import { AdminSendMessageModal } from "@/components/admin/AdminSendMessageModal";
import { isBillingAccountExpired } from "@/lib/billingAccountExpiry";
import type { AccountListRow } from "@/lib/repos/billing";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { dataTableStickyTh } from "@/lib/ui/dataTableSticky";
import { BulkRenewValiditySelect } from "@/components/admin/BulkRenewValiditySelect";
import { AdminUsersStatusControl } from "@/components/admin/AdminUsersStatusControl";
import { AdminUsersAutoRenewControl } from "@/components/admin/AdminUsersAutoRenewControl";
import { AdminUsersPerPageControl } from "@/components/admin/AdminUsersPerPageControl";
import { AdminAddUserModal } from "@/components/admin/AdminAddUserModal";
import type { FormSelectOption } from "@/components/forms/form-select";
import { EndUserTransactionsTable } from "@/components/admin/EndUserTransactionsTable";
import type { AccountTransactionRow } from "@/lib/repos/billing";

const ACCOUNT_OFF = 1;

type ValidityOption = { value: string; label: string };

export type AdminSubscribersSortUrls = Record<
  "account" | "manager" | "reseller" | "dealer" | "username" | "full_name" | "mac" | "status" | "expires",
  string
>;

type Props = {
  rows: AccountListRow[];
  validityOptions: ValidityOption[];
  sortUrls: AdminSubscribersSortUrls;
  sort: string;
  dir: "asc" | "desc";
  resetReturnPath: string;
  filterNotice?: {
    message: string;
    value: string;
    clearHref: string;
    clearLabel: string;
  };
  actionLinks?: {
    exportHref: string;
    addSubscriberHref: string;
  };
  embedded?: boolean;
  toolbarFilters?: {
    query: string;
    status: string;
    autoRenew: string;
    statusOptions: FormSelectOption[];
    statusHrefByValue: Record<string, string>;
    autoRenewOptions: FormSelectOption[];
    autoRenewHrefByValue: Record<string, string>;
    pageSize: string;
    pageSizeOptions: FormSelectOption[];
    pageSizeHrefByValue: Record<string, string>;
    searchAction: string;
    searchHiddenParams: Record<string, string>;
  };
  addUserModalData?: {
    resellers: Array<{ username: string; name: string }>;
    tariffs: Array<{ id: number; name: string }>;
    validityOptions: Array<{ value: string; label: string }>;
    customPlanId: number | null;
    addonPackages: Array<{ package_id: number; name: string }>;
  };
  initialAddUserOpen?: boolean;
  initialEditAccount?: string;
};

type DetailUser = {
  id: string;
  name: string;
  username: string;
  password: string;
  mac: string;
  phone: string;
  status: "ACTIVE" | "INACTIVE";
  statusCode: number;
  reseller: string;
  dealer: string;
  tariffPlanId: number;
  parentPin: string;
  packageLabel: string;
  stalkerUserId: number | null;
  comments: string;
  stb: { online: boolean; ip: string; firmware: string; expiry: string; watching: string };
  transactionSummary: {
    total: number;
    creditCount: number;
    debitCount: number;
    netPeriods: number;
    creditPeriods: number;
    debitPeriods: number;
    lastTransactionAt: string | null;
  };
  recentTransactions: Array<{ type: string; periods: number; timestamp: string | null }>;
};

type HierarchyProfile = {
  role: "manager" | "reseller" | "dealer";
  username: string;
  name: string;
  password: string;
  status: string;
  manager?: string;
  reseller?: string;
  ticketsManager?: string;
  comments: string;
  credits: number;
  transactionSummary: {
    total: number;
    creditCount: number;
    debitCount: number;
    netPeriods: number;
    creditPeriods: number;
    debitPeriods: number;
    lastTransactionAt: string | null;
  };
  recentTransactions: Array<{ type: string; periods: number; timestamp: string | null }>;
};

function Row({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="grid grid-cols-[9.5rem_minmax(0,1fr)] items-start gap-2 rounded-md border border-border/35 bg-background/20 px-2.5 py-1.5">
      <dt className="pt-0.5 text-[11px] font-medium text-muted-foreground">{label}</dt>
      <dd className={cn("text-sm text-foreground", multiline && "thin-scrollbar max-h-24 overflow-auto whitespace-pre-wrap pr-1")}>
        {value || "—"}
      </dd>
    </div>
  );
}

type ColumnKey =
  | "account"
  | "subscriber"
  | "dealer"
  | "reseller"
  | "manager"
  | "package"
  | "mac"
  | "ip"
  | "autoRenew"
  | "status"
  | "expiry"
  | "device";

const TABLE_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "account", label: "Account" },
  { key: "subscriber", label: "User" },
  { key: "dealer", label: "Dealer" },
  { key: "reseller", label: "Reseller" },
  { key: "manager", label: "Manager" },
  { key: "package", label: "Package" },
  { key: "mac", label: "MAC" },
  { key: "ip", label: "IP" },
  { key: "autoRenew", label: "Auto renew" },
  { key: "status", label: "Status" },
  { key: "expiry", label: "Expiry" },
  { key: "device", label: "Device" },
];

function subscriptionPill(r: AccountListRow) {
  if (r.status === ACCOUNT_OFF) {
    return { label: "Inactive", className: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/25" };
  }
  return { label: "Active", className: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25" };
}

function devicePill(r: AccountListRow) {
  if (r.receiverOnline === true) {
    return { label: "Online", className: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25" };
  }
  if (r.receiverOnline === false) {
    return { label: "Offline", className: "bg-muted text-muted-foreground ring-1 ring-border/60" };
  }
  return { label: "—", className: "bg-muted/40 text-muted-foreground ring-1 ring-border/40" };
}

function expiryPill(r: AccountListRow): { label: string; className: string } | null {
  if (!r.expires) return null;
  if (isBillingAccountExpired(r.expires)) {
    return { label: "Expired", className: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/25" };
  }
  const exp = new Date(String(r.expires).replace(" ", "T"));
  if (!Number.isNaN(exp.getTime()) && exp.getTime() > Date.now()) {
    if (exp.getTime() - Date.now() <= 7 * 24 * 60 * 60 * 1000) {
      return { label: "Soon", className: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30" };
    }
    return { label: "Live", className: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25" };
  }
  return null;
}

function parseBillingDateTime(raw: string | null | undefined): Date | null {
  const s = String(raw ?? "").trim();
  if (!s || s === "0000-00-00 00:00:00" || s.startsWith("0000-00-00")) return null;
  const t = Date.parse(s.includes("T") ? s : s.replace(" ", "T"));
  if (Number.isNaN(t)) return null;
  return new Date(t);
}

function formatStateRelative(raw: string | null | undefined): string {
  const d = parseBillingDateTime(raw);
  if (!d) return "No signal";
  const diffMs = Math.max(0, Date.now() - d.getTime());
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Seen now";
  if (minutes < 60) return `Seen ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Seen ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Seen ${days}d ago`;
  const months = Math.floor(days / 30);
  if (days < 365) return `Seen ${months}mo ago`;
  const years = Math.floor(days / 365);
  return `Seen ${years}y ago`;
}

export function AdminSubscribersTable({
  rows,
  validityOptions,
  sortUrls,
  sort,
  dir,
  resetReturnPath,
  filterNotice,
  actionLinks,
  embedded = false,
  toolbarFilters,
  addUserModalData,
  initialAddUserOpen = false,
  initialEditAccount = "",
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const bulkMenuRef = useRef<HTMLDivElement>(null);
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(() => new Set(TABLE_COLUMNS.map((c) => c.key)));
  const columnsMenuRef = useRef<HTMLDivElement>(null);
  const [renewOpen, setRenewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [validity, setValidity] = useState("1");
  const [bulkRenewAvailability, setBulkRenewAvailability] = useState<{
    debitUsername: string | null;
    debitCredits: number | null;
    walletCount: number;
    accountCount: number;
    resolvedCount: number;
  } | null>(null);
  const [bulkRenewAvailabilityLoading, setBulkRenewAvailabilityLoading] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
  const [results, setResults] = useState<{ account: string; ok: boolean; message: string }[]>([]);
  const [detailRow, setDetailRow] = useState<AccountListRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<DetailUser | null>(null);
  const [hierarchyModal, setHierarchyModal] = useState<{ role: "manager" | "reseller" | "dealer"; username: string } | null>(null);
  const [hierarchyLoading, setHierarchyLoading] = useState(false);
  const [hierarchyError, setHierarchyError] = useState<string | null>(null);
  const [hierarchyData, setHierarchyData] = useState<HierarchyProfile | null>(null);
  const [addUserOpen, setAddUserOpen] = useState(initialAddUserOpen);
  const [transactionsModalAccount, setTransactionsModalAccount] = useState<string | null>(null);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [transactionsRows, setTransactionsRows] = useState<AccountTransactionRow[]>([]);
  const [pending, startTransition] = useTransition();

  const allAccounts = useMemo(() => rows.map((r) => r.account), [rows]);
  const allSelected = allAccounts.length > 0 && allAccounts.every((a) => selected.has(a));

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(allAccounts) : new Set());
  }

  function toggleOne(account: string, checked: boolean) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (checked) n.add(account);
      else n.delete(account);
      return n;
    });
  }

  function openRenewModal() {
    if (selected.size === 0) {
      toast.warning("Select accounts for renew");
      return;
    }
    setBulkRenewAvailability(null);
    const ids = Array.from(selected);
    setBulkRenewAvailabilityLoading(true);
    void Promise.all(ids.map((id) => getAccountRenewRecoveryAvailabilityAction(id)))
      .then((rows) => {
        const okRows = rows.filter((r) => r.ok);
        const debitRows = okRows.filter((r) => typeof r.debitCredits === "number");
        const totalDebit = debitRows.reduce((sum, r) => sum + Number(r.debitCredits ?? 0), 0);
        const walletOwners = new Set(
          okRows
            .map((r) => String(r.debitUsername ?? "").trim())
            .filter((v) => v.length > 0),
        );
        setBulkRenewAvailability({
          debitUsername: ids.length === 1 ? (okRows[0]?.debitUsername ?? null) : null,
          debitCredits: debitRows.length > 0 ? totalDebit : null,
          walletCount: walletOwners.size,
          accountCount: ids.length,
          resolvedCount: okRows.length,
        });
      })
      .finally(() => setBulkRenewAvailabilityLoading(false));
    setRenewOpen(true);
  }

  function runBulkRenew() {
    const ids = Array.from(selected);
    startTransition(async () => {
      const res = await bulkRenewAccountsAction(ids, validity);
      if (!res.ok) {
        toast.error(res.error === "no_accounts" ? "Select at least one account." : res.error);
        return;
      }
      setResults(res.results);
      setRenewOpen(false);
      setResultsOpen(true);
      setSelected(new Set());
      toastBulkRenewSummary(res.results);
    });
  }

  const selectedValidity = validityOptions.find((v) => v.value === validity);
  const chargedFromLabel = (() => {
    if (!selectedValidity?.label) return null;
    const m = selectedValidity.label.match(/(\d+)\s*credit/i);
    return m ? Number.parseInt(m[1] ?? "", 10) : null;
  })();
  const renewMonths = Number.parseInt(validity, 10);
  const perAccountCharge =
    validity === "FREE_TRIAL"
      ? 0
      : chargedFromLabel != null && Number.isFinite(chargedFromLabel)
        ? chargedFromLabel
        : Number.isFinite(renewMonths)
          ? renewMonths
          : 0;
  const totalCharge = Math.max(0, selected.size) * Math.max(0, perAccountCharge);
  const renewCurrentAvailable = bulkRenewAvailability?.debitCredits ?? null;
  const renewAfterAvailable =
    renewCurrentAvailable != null && Number.isFinite(totalCharge) ? renewCurrentAvailable - totalCharge : null;
  const availabilityPartial =
    !!bulkRenewAvailability &&
    bulkRenewAvailability.accountCount > 1 &&
    bulkRenewAvailability.resolvedCount < bulkRenewAvailability.accountCount;

  function openDeleteModal() {
    if (selected.size === 0) {
      toast.warning("Select accounts for delete");
      return;
    }
    setDeleteOpen(true);
  }

  function runBulkDelete() {
    const ids = Array.from(selected);
    startTransition(async () => {
      const res = await bulkDeleteAccountsAction(ids);
      if (!res.ok) {
        toast.error(res.error === "no_accounts" ? "Select at least one account." : res.error);
        return;
      }
      setResults(res.results);
      setDeleteOpen(false);
      setResultsOpen(true);
      setSelected(new Set());
      const okCount = res.results.filter((r) => r.ok).length;
      const failCount = res.results.length - okCount;
      if (okCount && !failCount) toast.success(`Deleted ${okCount} account(s).`);
      else if (okCount) toast.warning(`Deleted ${okCount} account(s), ${failCount} failed.`);
      else toast.error("No accounts were deleted.");
    });
  }

  const selectedAccounts = useMemo(() => Array.from(selected), [selected]);

  function openMessageModal() {
    if (!selected.size) {
      toast.warning("Select at least one user");
      return;
    }
    setMessageOpen(true);
  }

  function runBulkMessage() {
    const ids = Array.from(selected);
    const message = bulkMessage.trim();
    if (!message) {
      toast.warning("Message is required.");
      return;
    }
    startTransition(async () => {
      const res = await bulkSendAccountsMessageAction({ accounts: ids, message, priority: 2 });
      if (!res.ok) {
        if (res.error === "no_accounts") toast.error("Select at least one account.");
        else if (res.error === "empty") toast.error("Message is required.");
        else if (res.error === "no_recipients") toast.error("No selected accounts mapped to Stalker users.");
        else if (res.error === "events_table") toast.error("Stalker `events` table is missing.");
        else toast.error("Failed to queue bulk message.");
        return;
      }
      setMessageOpen(false);
      setBulkMessage("");
      const unresolved = res.unresolvedAccounts.length;
      if (unresolved > 0) {
        toast.warning(`Queued ${res.queued} messages. ${unresolved} account(s) were skipped (no Stalker user).`);
      } else {
        toast.success(`Queued ${res.queued} message event(s).`);
      }
    });
  }

  useEffect(() => {
    if (!columnsOpen && !bulkMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (columnsMenuRef.current?.contains(target)) return;
      if (bulkMenuRef.current?.contains(target)) return;
      setColumnsOpen(false);
      setBulkMenuOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [columnsOpen, bulkMenuOpen]);

  useEffect(() => {
    if (!detailRow) {
      setDetailLoading(false);
      setDetailError(null);
      setDetailData(null);
      return;
    }
    const controller = new AbortController();
    setDetailLoading(true);
    setDetailError(null);
    setDetailData(null);
    void fetch(`/api/admin/users/${encodeURIComponent(detailRow.account)}/details`, { signal: controller.signal })
      .then(async (res) => {
        const payload = (await res.json().catch(() => null)) as { ok?: boolean; user?: DetailUser; error?: string } | null;
        if (!res.ok || !payload?.ok || !payload.user) {
          throw new Error(payload?.error || "failed");
        }
        setDetailData(payload.user);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === "AbortError") return;
        setDetailError("Could not load full user info.");
      })
      .finally(() => setDetailLoading(false));
    return () => controller.abort();
  }, [detailRow]);

  useEffect(() => {
    if (!transactionsModalAccount) {
      setTransactionsRows([]);
      setTransactionsError(null);
      setTransactionsLoading(false);
      return;
    }
    const controller = new AbortController();
    setTransactionsLoading(true);
    setTransactionsError(null);
    void fetch(`/api/admin/users/${encodeURIComponent(transactionsModalAccount)}/transactions`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { ok?: boolean; rows?: AccountTransactionRow[] };
        if (!json.ok) throw new Error("bad_payload");
        setTransactionsRows(Array.isArray(json.rows) ? json.rows : []);
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        console.error("Failed to load transactions", e);
        setTransactionsError("Could not load transaction history.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setTransactionsLoading(false);
      });
    return () => controller.abort();
  }, [transactionsModalAccount]);

  useEffect(() => {
    if (!hierarchyModal) {
      setHierarchyLoading(false);
      setHierarchyError(null);
      setHierarchyData(null);
      return;
    }
    const controller = new AbortController();
    setHierarchyLoading(true);
    setHierarchyError(null);
    setHierarchyData(null);
    void fetch(`/api/admin/hierarchy/${hierarchyModal.role}/${encodeURIComponent(hierarchyModal.username)}`, { signal: controller.signal })
      .then(async (res) => {
        const payload = (await res.json().catch(() => null)) as { ok?: boolean; profile?: HierarchyProfile; error?: string } | null;
        if (!res.ok || !payload?.ok || !payload.profile) {
          throw new Error(payload?.error || "failed");
        }
        setHierarchyData(payload.profile);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === "AbortError") return;
        setHierarchyError("Could not load hierarchy user info.");
      })
      .finally(() => setHierarchyLoading(false));
    return () => controller.abort();
  }, [hierarchyModal]);

  const hasColumn = (key: ColumnKey) => visibleColumns.has(key);

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm",
          embedded ? "mb-0 flex-nowrap justify-start rounded-none border-x-0 border-t-0" : "mb-4 flex-wrap",
        )}
      >
        <span className="text-muted-foreground">
          Selected: <span className="font-semibold text-foreground">{selected.size}</span>
        </span>
        <div ref={bulkMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setBulkMenuOpen((o) => !o)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border/80 bg-card px-3 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted/50"
            aria-haspopup="menu"
            aria-expanded={bulkMenuOpen}
          >
            <Settings className="h-4 w-4" aria-hidden />
            Bulk Actions
          </button>
          {bulkMenuOpen ? (
            <div className="absolute left-0 z-50 mt-2 w-52 rounded-lg border border-border bg-popover p-1.5 shadow-xl" role="menu">
              <button
                type="button"
                onClick={() => {
                  setBulkMenuOpen(false);
                  openRenewModal();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted/60"
                role="menuitem"
              >
                <CalendarDays className="h-4 w-4 opacity-80" aria-hidden />
                Renew
              </button>
              <button
                type="button"
                onClick={() => {
                  setBulkMenuOpen(false);
                  openMessageModal();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted/60"
                role="menuitem"
              >
                <MessageSquareText className="h-4 w-4 opacity-80" aria-hidden />
                Message
              </button>
              <button
                type="button"
                onClick={() => {
                  setBulkMenuOpen(false);
                  openDeleteModal();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-rose-500 transition-colors hover:bg-rose-500/10"
                role="menuitem"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Delete
              </button>
            </div>
          ) : null}
        </div>
        <div className={cn("flex min-w-0 flex-1 items-center justify-start gap-2", embedded ? "flex-nowrap" : "flex-wrap")}>
          {toolbarFilters ? (
            <form action={toolbarFilters.searchAction} method="get" className="flex items-center gap-2">
              {Object.entries(toolbarFilters.searchHiddenParams).map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
              <div className="relative min-w-[16rem]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/80" aria-hidden />
                <input
                  name="query"
                  defaultValue={toolbarFilters.query}
                  className="h-10 w-full rounded-lg border border-border/70 bg-background pl-10 pr-3 text-sm text-foreground outline-none ring-offset-background transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-primary/35 focus-visible:ring-1 focus-visible:ring-primary/35 focus-visible:shadow-[0_0_0_1px_rgba(14,165,233,0.18)]"
                  placeholder="Search by account, name, or MAC..."
                />
              </div>
              <AdminUsersStatusControl
                value={toolbarFilters.status}
                options={toolbarFilters.statusOptions}
                hrefByValue={toolbarFilters.statusHrefByValue}
              />
              <AdminUsersAutoRenewControl
                value={toolbarFilters.autoRenew}
                options={toolbarFilters.autoRenewOptions}
                hrefByValue={toolbarFilters.autoRenewHrefByValue}
              />
              <div className="ml-1 flex items-center">
                <div id="admin-users-page-size-inline">
                  <AdminUsersPerPageControl
                    pageSize={toolbarFilters.pageSize}
                    options={toolbarFilters.pageSizeOptions}
                    hrefByValue={toolbarFilters.pageSizeHrefByValue}
                  />
                </div>
              </div>
            </form>
          ) : null}
          {filterNotice ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
              <span>
                {filterNotice.message} <span className="font-mono font-semibold text-primary">{filterNotice.value}</span>
              </span>
              <Link href={filterNotice.clearHref} className="shrink-0 font-medium text-primary underline-offset-2 hover:underline">
                {filterNotice.clearLabel}
              </Link>
            </div>
          ) : null}
          {actionLinks ? (
            <div className="ml-auto flex shrink-0 items-center gap-2 text-xs sm:text-sm">
              <Link
                href={actionLinks.exportHref}
                className="inline-flex items-center gap-1.5 font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                Export
              </Link>
              <Link
                href={actionLinks.addSubscriberHref}
                className="inline-flex items-center gap-1.5 font-semibold text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
                onClick={(e) => {
                  if (!addUserModalData) return;
                  e.preventDefault();
                  setAddUserOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add user
              </Link>
            </div>
          ) : null}
          <div ref={columnsMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setColumnsOpen((o) => !o)}
              className="inline-flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted/40"
              aria-label="Column settings"
              title="Column settings"
            >
              <SlidersHorizontal className="h-[18px] w-[18px]" aria-hidden />
            </button>
            {columnsOpen ? (
              <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-border bg-popover p-2.5 shadow-xl">
                <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Visible columns</p>
                <div className="space-y-1" role="menu">
                  {TABLE_COLUMNS.map((col) => {
                    const checked = visibleColumns.has(col.key);
                    return (
                      <label key={col.key} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-muted/40">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const enabled = e.target.checked;
                            setVisibleColumns((prev) => {
                              const next = new Set(prev);
                              if (!enabled) {
                                if (next.size <= 1) return prev;
                                next.delete(col.key);
                                return next;
                              }
                              next.add(col.key);
                              return next;
                            });
                          }}
                          className={cn("accent-primary")}
                        />
                        <span>{col.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {addUserModalData ? (
        <AdminAddUserModal
          open={addUserOpen}
          onClose={() => setAddUserOpen(false)}
          resellers={addUserModalData.resellers}
          tariffs={addUserModalData.tariffs}
          validityOptions={addUserModalData.validityOptions}
          customPlanId={addUserModalData.customPlanId}
          addonPackages={addUserModalData.addonPackages}
        />
      ) : null}

      {transactionsModalAccount ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-2 backdrop-blur-sm transition-opacity duration-200 sm:p-3"
          role="dialog"
          aria-modal="true"
          aria-labelledby="transactions-modal-title"
          onClick={() => setTransactionsModalAccount(null)}
        >
          <div
            className="max-h-[min(92dvh,900px)] w-full max-w-[1280px] overflow-hidden rounded-2xl border border-border/45 bg-card shadow-2xl ring-1 ring-black/[0.05] transition-[transform,box-shadow] duration-200 ease-out dark:bg-card/98 dark:ring-white/[0.07]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 border-b border-border/40 bg-gradient-to-b from-muted/25 to-muted/5 px-3 py-2 sm:px-3.5">
              <div className="min-w-0">
                <h2 id="transactions-modal-title" className="inline-flex items-center gap-1.5 text-sm font-semibold leading-tight tracking-tight text-foreground sm:text-base">
                  <ReceiptText className="h-4 w-4 shrink-0 text-primary/90" aria-hidden />
                  Transaction history
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                  Account{" "}
                  <span className="rounded-md bg-background/60 px-1 py-0.5 font-mono text-[11px] font-semibold text-foreground ring-1 ring-border/50 sm:text-xs">
                    {transactionsModalAccount}
                  </span>
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 shrink-0 rounded-lg p-0 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                aria-label="Close transaction history"
                onClick={() => setTransactionsModalAccount(null)}
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            <div className="thin-scrollbar max-h-[calc(min(92dvh,900px)-4.25rem)] overflow-y-auto p-2.5 sm:p-3">
              {transactionsLoading ? (
                <p className="py-5 text-center text-sm text-muted-foreground">Loading transaction history…</p>
              ) : null}
              {transactionsError ? <p className="py-3 text-center text-sm text-destructive">{transactionsError}</p> : null}
              {!transactionsLoading && !transactionsError ? <EndUserTransactionsTable rows={transactionsRows} /> : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className={cn("overflow-hidden rounded-xl border border-border/60 bg-card/80 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]", embedded && "rounded-none border-x-0 border-y-0 shadow-none ring-0")}>
        <div className="app-data-table-scroll thin-scrollbar">
          <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
            <thead>
              <tr>
                <th className={cn(dataTableStickyTh("py-1.5 text-center"), "w-10")}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => toggleAll(e.target.checked)}
                    aria-label="Select all on this page"
                    className="rounded border-input"
                  />
                </th>
                {hasColumn("account") ? <th className={dataTableStickyTh("py-1.5 text-center")}>
                  <Link href={sortUrls.account} className="inline-flex items-center justify-center gap-1 hover:text-foreground">
                    Account
                    {sort === "account" ? (
                      <ChevronDown className={cn("h-3.5 w-3.5", dir === "asc" ? "rotate-180" : "")} aria-hidden />
                    ) : (
                      <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
                    )}
                  </Link>
                </th> : null}
                {hasColumn("subscriber") ? <th className={dataTableStickyTh("py-1.5 text-center")}>
                  <Link href={sortUrls.full_name} className="inline-flex items-center justify-center gap-1 hover:text-foreground">
                    User
                    {sort === "full_name" ? (
                      <ChevronDown className={cn("h-3.5 w-3.5", dir === "asc" ? "rotate-180" : "")} aria-hidden />
                    ) : (
                      <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
                    )}
                  </Link>
                </th> : null}
                {hasColumn("dealer") ? <th className={dataTableStickyTh("py-1.5 text-center")}>
                  <Link href={sortUrls.dealer} className="inline-flex items-center justify-center gap-1 hover:text-foreground">
                    Dealer
                    {sort === "dealer" ? (
                      <ChevronDown className={cn("h-3.5 w-3.5", dir === "asc" ? "rotate-180" : "")} aria-hidden />
                    ) : (
                      <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
                    )}
                  </Link>
                </th> : null}
                {hasColumn("reseller") ? <th className={dataTableStickyTh("py-1.5 text-center")}>
                  <Link href={sortUrls.reseller} className="inline-flex items-center justify-center gap-1 hover:text-foreground">
                    Reseller
                    {sort === "reseller" ? (
                      <ChevronDown className={cn("h-3.5 w-3.5", dir === "asc" ? "rotate-180" : "")} aria-hidden />
                    ) : (
                      <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
                    )}
                  </Link>
                </th> : null}
                {hasColumn("manager") ? <th className={dataTableStickyTh("py-1.5 text-center")}>
                  <Link href={sortUrls.manager} className="inline-flex items-center justify-center gap-1 hover:text-foreground">
                    Manager
                    {sort === "manager" ? (
                      <ChevronDown className={cn("h-3.5 w-3.5", dir === "asc" ? "rotate-180" : "")} aria-hidden />
                    ) : (
                      <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
                    )}
                  </Link>
                </th> : null}
                {hasColumn("package") ? <th className={cn(dataTableStickyTh("py-1.5 text-center"), "font-medium")}>Package</th> : null}
                {hasColumn("mac") ? <th className={dataTableStickyTh("py-1.5 text-center")}>
                  <Link href={sortUrls.mac} className="inline-flex items-center justify-center gap-1 hover:text-foreground">
                    MAC
                    {sort === "mac" ? (
                      <ChevronDown className={cn("h-3.5 w-3.5", dir === "asc" ? "rotate-180" : "")} aria-hidden />
                    ) : (
                      <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
                    )}
                  </Link>
                </th> : null}
                {hasColumn("ip") ? <th className={cn(dataTableStickyTh("py-1.5 text-center"), "font-medium")}>IP</th> : null}
                {hasColumn("autoRenew") ? <th className={cn(dataTableStickyTh("py-1.5 text-center"), "font-medium")}>Auto renew</th> : null}
                {hasColumn("status") ? <th className={cn(dataTableStickyTh("py-1.5 text-center"))}>
                  <Link href={sortUrls.status} className="inline-flex items-center justify-center gap-1 hover:text-foreground">
                    Status
                    {sort === "status" ? (
                      <ChevronDown className={cn("h-3.5 w-3.5", dir === "asc" ? "rotate-180" : "")} aria-hidden />
                    ) : (
                      <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
                    )}
                  </Link>
                </th> : null}
                {hasColumn("expiry") ? <th className={cn(dataTableStickyTh("py-1.5 text-center"))}>
                  <Link href={sortUrls.expires} className="inline-flex items-center justify-center gap-1 hover:text-foreground">
                    Expiry
                    {sort === "expires" ? (
                      <ChevronDown className={cn("h-3.5 w-3.5", dir === "asc" ? "rotate-180" : "")} aria-hidden />
                    ) : (
                      <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
                    )}
                  </Link>
                </th> : null}
                {hasColumn("device") ? <th className={cn(dataTableStickyTh("py-1.5 text-center"), "font-medium")}>Device</th> : null}
                <th className={cn(dataTableStickyTh("py-1.5 text-center"), "font-medium")}>
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
                  <td colSpan={14} className="px-4 py-12 text-center">
                    <p className="text-sm font-medium text-foreground">No users match your filters</p>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      Try clearing the search box, widening filters, or changing page size.
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const sub = subscriptionPill(r);
                  const dev = devicePill(r);
                  const expState = expiryPill(r);
                  const subscriptionExpired = isBillingAccountExpired(r.expires);
                  return (
                    <tr key={r.account} className="border-b border-border/40 transition-colors last:border-0 hover:bg-muted/15">
                      <td className="px-3 py-1 align-middle text-center">
                        <input
                          type="checkbox"
                          checked={selected.has(r.account)}
                          onChange={(e) => toggleOne(r.account, e.target.checked)}
                          aria-label={`Select ${r.account}`}
                          className="rounded border-input"
                        />
                      </td>
                      {hasColumn("account") ? <td className="px-3 py-1 align-middle text-center">
                        <button
                          type="button"
                          onClick={() => setDetailRow(r)}
                          className="text-sm font-semibold text-foreground transition-colors hover:text-primary"
                        >
                          {r.account}
                        </button>
                      </td> : null}
                      {hasColumn("subscriber") ? <td className="px-3 py-1 align-middle text-center font-medium text-foreground">
                        <InlineEditableUserCell account={r.account} field="user" value={r.full_name?.trim() || ""} />
                      </td> : null}
                      {hasColumn("dealer") ? <td className="px-3 py-1 align-middle text-center text-sm text-muted-foreground">
                        {r.dealer?.trim() ? (
                          <button
                            type="button"
                            onClick={() => setHierarchyModal({ role: "dealer", username: r.dealer.trim() })}
                            className="font-medium text-foreground transition-colors hover:text-primary"
                          >
                            {r.dealer.trim()}
                          </button>
                        ) : (
                          "—"
                        )}
                      </td> : null}
                      {hasColumn("reseller") ? <td className="px-3 py-1 align-middle text-center text-sm text-muted-foreground">
                        {r.reseller?.trim() ? (
                          <button
                            type="button"
                            onClick={() => setHierarchyModal({ role: "reseller", username: r.reseller.trim() })}
                            className="font-medium text-foreground transition-colors hover:text-primary"
                          >
                            {r.reseller.trim()}
                          </button>
                        ) : (
                          "—"
                        )}
                      </td> : null}
                      {hasColumn("manager") ? <td className="px-3 py-1 align-middle text-center text-sm text-muted-foreground">
                        {r.manager?.trim() ? (
                          <button
                            type="button"
                            onClick={() => setHierarchyModal({ role: "manager", username: r.manager.trim() })}
                            className="font-medium text-foreground transition-colors hover:text-primary"
                          >
                            {r.manager.trim()}
                          </button>
                        ) : (
                          "—"
                        )}
                      </td> : null}
                      {hasColumn("package") ? <td className="px-3 py-1 align-middle text-center text-sm text-muted-foreground">{r.packageName ?? "—"}</td> : null}
                      {hasColumn("mac") ? <td className="px-3 py-1 align-middle text-center text-sm text-muted-foreground">
                        <InlineEditableUserCell account={r.account} field="mac" value={r.mac || ""} />
                      </td> : null}
                      {hasColumn("ip") ? <td className="px-3 py-1 align-middle text-center text-sm text-muted-foreground">{r.ip || "—"}</td> : null}
                      {hasColumn("autoRenew") ? <td className="px-3 py-1 align-middle text-center text-sm text-muted-foreground">
                        {r.autoRenew === true ? "Yes" : r.autoRenew === false ? "No" : "—"}
                      </td> : null}
                      {hasColumn("status") ? <td className="px-3 py-1 align-middle text-center">
                        <InlineEditableUserCell
                          account={r.account}
                          field="status"
                          value={String(r.status ?? 0)}
                          expired={subscriptionExpired}
                          className={sub.className}
                        />
                      </td> : null}
                      {hasColumn("expiry") ? <td className="px-3 py-1 align-middle text-center text-sm tabular-nums text-muted-foreground">
                        <div className="flex flex-col items-center gap-0.5">
                          {expState ? (
                            <span className={cn("inline-flex rounded-full px-2 py-0 text-[10px] font-semibold", expState.className)}>
                              {expState.label}
                            </span>
                          ) : null}
                          <span>{r.expires ? String(r.expires).slice(0, 10) : "—"}</span>
                        </div>
                      </td> : null}
                      {hasColumn("device") ? <td className="px-3 py-1 align-middle text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={cn("inline-flex rounded-full px-2 py-0 text-[10px] font-semibold", dev.className)}>{dev.label}</span>
                          <span className="text-[10px] text-muted-foreground">{formatStateRelative(r.lastActive)}</span>
                        </div>
                      </td> : null}
                      <td className="px-3 py-1 align-middle text-center">
                        <AdminSubscriberRowActions
                          account={r.account}
                          resetReturnPath={resetReturnPath}
                          subscriptionExpired={subscriptionExpired}
                          validityOptions={validityOptions}
                          openEditOnMount={initialEditAccount === r.account}
                          onViewDetail={() => setDetailRow(r)}
                          onViewTransactions={() => setTransactionsModalAccount(r.account)}
                          editModalData={
                            addUserModalData
                              ? {
                                  resellers: addUserModalData.resellers,
                                  tariffs: addUserModalData.tariffs,
                                  customPlanId: addUserModalData.customPlanId,
                                  addonPackages: addUserModalData.addonPackages,
                                }
                              : undefined
                          }
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detailRow ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          onClick={() => setDetailRow(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-[1100px] overflow-auto rounded-xl border border-border/50 bg-card/95 shadow-2xl ring-1 ring-black/[0.04] transition-shadow dark:ring-white/[0.06]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border/50 bg-muted/10 px-4 py-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">User information</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Account: <span className="font-semibold text-foreground">{detailRow.account}</span>
                </p>
              </div>
            </div>
            <div className="space-y-3 p-4">
            {detailLoading ? <p className="text-sm text-muted-foreground">Loading full user info...</p> : null}
            {detailError ? <p className="text-sm text-destructive">{detailError}</p> : null}
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1",
                  (detailData?.statusCode ?? detailRow.status) === ACCOUNT_OFF
                    ? "bg-rose-500/15 text-rose-300 ring-rose-500/30"
                    : "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
                )}
              >
                {(detailData?.statusCode ?? detailRow.status) === ACCOUNT_OFF ? "Inactive" : "Active"}
              </span>
              <span
                className={cn(
                  "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1",
                  detailData?.stb?.online === true || detailRow.receiverOnline === true
                    ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                    : "bg-rose-500/15 text-rose-300 ring-rose-500/30",
                )}
              >
                {detailData?.stb?.online === true || detailRow.receiverOnline === true ? "Receiver online" : "Receiver offline"}
              </span>
              <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground ring-1 ring-border/60">
                Auto renew: {detailRow.autoRenew === true ? "Yes" : detailRow.autoRenew === false ? "No" : "—"}
              </span>
              <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground ring-1 ring-border/60">
                Tx: {detailData?.transactionSummary?.total ?? 0}
              </span>
              <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground ring-1 ring-border/60">
                CRDT: {detailData?.transactionSummary?.creditCount ?? 0}
              </span>
              <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground ring-1 ring-border/60">
                DBIT: {detailData?.transactionSummary?.debitCount ?? 0}
              </span>
              <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground ring-1 ring-border/60">
                Net periods: {detailData?.transactionSummary?.netPeriods ?? 0}
              </span>
              <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground ring-1 ring-border/60">
                +Periods: {detailData?.transactionSummary?.creditPeriods ?? 0}
              </span>
              <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground ring-1 ring-border/60">
                -Periods: {detailData?.transactionSummary?.debitPeriods ?? 0}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
              <section className="rounded-lg border border-border/45 bg-muted/10 p-2.5">
                <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Profile</h3>
                <dl className="space-y-1.5">
                  <Row label="Full name" value={detailData?.name?.trim() || detailRow.full_name?.trim() || "—"} />
                  <Row label="Username" value={detailData?.username || detailRow.username || "—"} />
                  <Row label="Phone" value={detailData?.phone || detailRow.phone || "—"} />
                  <Row label="Password" value={detailData?.password || detailRow.password || "—"} />
                  <Row label="Comments" value={detailData?.comments || "—"} multiline />
                </dl>
              </section>
              <section className="rounded-lg border border-border/45 bg-muted/10 p-2.5">
                <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ownership</h3>
                <dl className="space-y-1.5">
                  <Row label="Manager" value={detailRow.manager?.trim() || "—"} />
                  <Row label="Reseller" value={detailData?.reseller?.trim() || detailRow.reseller?.trim() || "—"} />
                  <Row label="Dealer" value={detailData?.dealer?.trim() || detailRow.dealer?.trim() || "—"} />
                  <Row label="Package" value={detailData?.packageLabel || detailRow.packageName || "—"} />
                  <Row label="Parent PIN" value={detailData?.parentPin || "—"} />
                </dl>
              </section>
              <section className="rounded-lg border border-border/45 bg-muted/10 p-2.5">
                <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Network</h3>
                <dl className="space-y-1.5">
                  <Row label="MAC" value={detailData?.mac || detailRow.mac || "—"} />
                  <Row label="IP" value={detailData?.stb?.ip || detailRow.ip || "—"} />
                  <Row label="Firmware" value={detailData?.stb?.firmware || "—"} />
                  <Row label="Watching" value={detailData?.stb?.watching || "—"} />
                  <Row
                    label="Device state"
                    value={
                      detailData?.stb?.online === true || detailRow.receiverOnline === true
                        ? "Online"
                        : detailData?.stb?.online === false || detailRow.receiverOnline === false
                          ? "Offline"
                          : "Unknown"
                    }
                  />
                </dl>
              </section>
              <section className="rounded-lg border border-border/45 bg-muted/10 p-2.5">
                <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Subscription</h3>
                <dl className="space-y-1.5">
                  <Row label="Status" value={(detailData?.statusCode ?? detailRow.status) === ACCOUNT_OFF ? "Inactive" : "Active"} />
                  <Row label="Auto renew" value={detailRow.autoRenew === true ? "Yes" : detailRow.autoRenew === false ? "No" : "—"} />
                  <Row label="Expires" value={detailData?.stb?.expiry || (detailRow.expires ? String(detailRow.expires).slice(0, 19) : "—")} />
                  <Row label="Created" value={detailRow.created ? String(detailRow.created).slice(0, 19) : "—"} />
                  <Row label="Last active" value={detailRow.lastActive ? String(detailRow.lastActive).slice(0, 19) : "—"} />
                  <Row label="Last transaction" value={detailData?.transactionSummary?.lastTransactionAt ? String(detailData.transactionSummary.lastTransactionAt).slice(0, 19) : "—"} />
                </dl>
              </section>
              <section className="rounded-lg border border-border/45 bg-muted/10 p-2.5">
                <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recent transaction preview</h3>
                <dl className="space-y-1.5">
                  {detailData?.recentTransactions?.length
                    ? detailData.recentTransactions.slice(0, 3).map((tx, i) => (
                        <Row
                          key={`u-tx-${i}`}
                          label={`${tx.type || "TX"} ${i + 1}`}
                          value={`${tx.periods} periods • ${tx.timestamp ? String(tx.timestamp).slice(0, 19) : "—"}`}
                        />
                      ))
                    : <Row label="Transactions" value="—" />}
                </dl>
              </section>
            </div>
            </div>
          </div>
        </div>
      ) : null}

      {hierarchyModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          onClick={() => setHierarchyModal(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-[920px] overflow-auto rounded-xl border border-border/50 bg-card/95 shadow-2xl ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border/50 bg-muted/10 px-4 py-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">User information</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {hierarchyModal.role}: <span className="font-semibold text-foreground">{hierarchyModal.username}</span>
                </p>
              </div>
            </div>
            <div className="space-y-3 p-4">
              {hierarchyLoading ? <p className="text-sm text-muted-foreground">Loading full user info...</p> : null}
              {hierarchyError ? <p className="text-sm text-destructive">{hierarchyError}</p> : null}
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1",
                    String(hierarchyData?.status ?? "A").toUpperCase() === "A"
                      ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                      : "bg-rose-500/15 text-rose-300 ring-rose-500/30",
                  )}
                >
                  {String(hierarchyData?.status ?? "A").toUpperCase() === "A" ? "Active" : "Inactive"}
                </span>
                <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground ring-1 ring-border/60">
                  Credits: {hierarchyData?.credits ?? 0}
                </span>
                <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground ring-1 ring-border/60">
                  Tx: {hierarchyData?.transactionSummary?.total ?? 0}
                </span>
                <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground ring-1 ring-border/60">
                  CRDT: {hierarchyData?.transactionSummary?.creditCount ?? 0}
                </span>
                <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground ring-1 ring-border/60">
                  DBIT: {hierarchyData?.transactionSummary?.debitCount ?? 0}
                </span>
                <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground ring-1 ring-border/60">
                  +Periods: {hierarchyData?.transactionSummary?.creditPeriods ?? 0}
                </span>
                <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground ring-1 ring-border/60">
                  -Periods: {hierarchyData?.transactionSummary?.debitPeriods ?? 0}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2.5">
                <section className="rounded-lg border border-border/45 bg-muted/10 p-2.5">
                  <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Profile</h3>
                  <dl className="space-y-1.5">
                    <Row label="Name" value={hierarchyData?.name || "—"} />
                    <Row label="Username" value={hierarchyData?.username || hierarchyModal.username} />
                    <Row label="Password" value={hierarchyData?.password || "—"} />
                    <Row label="Comments" value={hierarchyData?.comments || "—"} multiline />
                  </dl>
                </section>
                <section className="rounded-lg border border-border/45 bg-muted/10 p-2.5">
                  <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ownership</h3>
                  <dl className="space-y-1.5">
                    <Row label="Role" value={hierarchyModal.role} />
                    <Row label="Manager" value={hierarchyData?.manager || "—"} />
                    <Row label="Reseller" value={hierarchyData?.reseller || "—"} />
                    <Row label="Tickets manager" value={hierarchyData?.ticketsManager || "—"} />
                    <Row label="Net periods" value={String(hierarchyData?.transactionSummary?.netPeriods ?? 0)} />
                    <Row label="Last transaction" value={hierarchyData?.transactionSummary?.lastTransactionAt ? String(hierarchyData.transactionSummary.lastTransactionAt).slice(0, 19) : "—"} />
                  </dl>
                </section>
                <section className="rounded-lg border border-border/45 bg-muted/10 p-2.5">
                  <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recent transaction preview</h3>
                  <dl className="space-y-1.5">
                    {hierarchyData?.recentTransactions?.length
                      ? hierarchyData.recentTransactions.slice(0, 3).map((tx, i) => (
                          <Row
                            key={`h-tx-${i}`}
                            label={`${tx.type || "TX"} ${i + 1}`}
                            value={`${tx.periods} periods • ${tx.timestamp ? String(tx.timestamp).slice(0, 19) : "—"}`}
                          />
                        ))
                      : <Row label="Transactions" value="—" />}
                  </dl>
                </section>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {renewOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[3px]"
          role="dialog"
          aria-modal="true"
          onClick={() => setRenewOpen(false)}
        >
          <div
            className="w-full max-w-xl overflow-visible rounded-2xl border border-border/70 bg-card/95 shadow-2xl ring-1 ring-black/[0.05] dark:ring-white/[0.07]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-border/50 px-6 py-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground/90">Renewal</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Renew selected accounts</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Accounts: <span className="font-semibold text-foreground">{selected.size}</span>
              </p>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/45 bg-background/35 px-4 py-3 backdrop-blur-sm">
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Current available (debit wallet)</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {bulkRenewAvailabilityLoading
                      ? "Loading..."
                      : selected.size === 1
                        ? renewCurrentAvailable != null
                          ? new Intl.NumberFormat("en-US").format(renewCurrentAvailable)
                          : "-"
                        : "Multiple wallets"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Owner:{" "}
                    {selected.size === 1
                      ? (bulkRenewAvailability?.debitUsername ?? "—")
                      : `${bulkRenewAvailability?.walletCount ?? 0} wallet(s)`}
                  </p>
                </div>
                <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.08] px-4 py-3 backdrop-blur-sm">
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">After available</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {bulkRenewAvailabilityLoading
                      ? "Loading..."
                      : renewAfterAvailable != null
                        ? new Intl.NumberFormat("en-US").format(renewAfterAvailable)
                        : "-"}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {selected.size === 1
                      ? "Single account preview"
                      : availabilityPartial
                        ? `Estimated from ${bulkRenewAvailability?.resolvedCount ?? 0}/${bulkRenewAvailability?.accountCount ?? selected.size} accounts`
                        : "Aggregated preview across selected accounts"}
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-border/45 bg-background/30 px-3.5 py-3 backdrop-blur-sm">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/40 bg-background/40 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Per account charged</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {new Intl.NumberFormat("en-US").format(perAccountCharge)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/40 bg-background/40 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Action scope</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">Bulk renew</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-border/45 bg-background/30 p-3.5 backdrop-blur-sm">
                <label id="admin-bulk-renew-validity" className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Select validity
                </label>
                <BulkRenewValiditySelect
                  value={validity}
                  onValueChange={setValidity}
                  options={validityOptions}
                  labelledBy="admin-bulk-renew-validity"
                  triggerClassName="w-full"
                />
              </div>
              <p className="rounded-xl border border-border/35 bg-background/25 px-3.5 py-2 text-xs text-muted-foreground">
                Renewal applies immediately to all selected accounts based on the selected period.
              </p>
            </div>

            <div className="flex items-center justify-end border-t border-border/50 px-6 py-4">
              <Button
                type="button"
                variant="ctaLink"
                size="inline"
                className="gap-1 text-sm"
                onClick={runBulkRenew}
                disabled={pending}
              >
                {pending ? "Working…" : "Submit"}
                {!pending ? <ArrowUpRight className="h-4 w-4" aria-hidden="true" /> : null}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-xl border border-border/60 bg-card p-5 shadow-lg">
            <h2 className="text-lg font-semibold text-foreground">Bulk delete</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Permanently delete <span className="font-semibold text-foreground">{selected.size}</span> selected account(s)?
            </p>
            <p className="mt-2 text-xs text-rose-400">This cannot be undone (billing + Stalker rows will be removed).</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-input px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/50"
                onClick={() => setDeleteOpen(false)}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-destructive px-3 py-1.5 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                onClick={runBulkDelete}
                disabled={pending}
              >
                {pending ? "Working…" : "Delete selected"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AdminSendMessageModal
        open={messageOpen}
        title="Send Bulk Message"
        description={`Send one message to ${selectedAccounts.length} selected account(s). Delivery is queued via Stalker server events.`}
        recipients={selectedAccounts}
        message={bulkMessage}
        maxLength={1000}
        pending={pending}
        submitLabel="Send Messages"
        onMessageChange={setBulkMessage}
        onClose={() => setMessageOpen(false)}
        onSubmit={runBulkMessage}
      />

      {resultsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-xl border border-border/60 bg-card p-5 shadow-lg">
            <h2 className="text-lg font-semibold text-foreground">Update results</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {results.map((row) => (
                <li
                  key={row.account}
                  className={cn(
                    "rounded-lg border px-2 py-2",
                    row.ok ? "border-border bg-muted/30 text-foreground" : "border-destructive/30 bg-destructive/10 text-destructive",
                  )}
                >
                  {row.message}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                onClick={() => {
                  setResultsOpen(false);
                  router.refresh();
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

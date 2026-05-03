"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronsUpDown, Loader2, Settings2, ShieldCheck, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectContent, SelectItem, SelectRoot, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dataTableStickyTh } from "@/lib/ui/dataTableSticky";

const ACCOUNT_OFF = 1;

type Row = {
  account: string;
  username: string;
  full_name: string | null;
  password: string | null;
  manager: string;
  packageName: string | null;
  mac: string | null;
  ip: string | null;
  autoRenew: boolean | null;
  expires: string | null;
  status: number;
  reseller: string;
  dealer: string;
  receiverOnline: boolean | null;
  lastActive: string | null;
};

type SortKey = "account" | "user" | "hierarchy" | "package" | "mac" | "ip" | "autoRenew" | "status" | "expires" | "device";
type ColumnKey = SortKey;

async function readResponseBody(r: Response): Promise<{ data: unknown; empty: boolean; jsonError: boolean }> {
  const text = await r.text();
  const trimmed = text.trim();
  if (!trimmed) return { data: null, empty: true, jsonError: false };
  try {
    return { data: JSON.parse(trimmed) as unknown, empty: false, jsonError: false };
  } catch {
    return { data: null, empty: false, jsonError: true };
  }
}

function statusLabel(r: Row): string {
  if (r.status === ACCOUNT_OFF) return "Inactive";
  return "Active";
}

function expiryState(raw: string | null): "Live" | "Expiring" | "Expired" | null {
  if (!raw) return null;
  const parsed = Date.parse(String(raw).replace(" ", "T"));
  if (Number.isNaN(parsed)) return null;
  const delta = parsed - Date.now();
  if (delta < 0) return "Expired";
  if (delta <= 7 * 24 * 60 * 60 * 1000) return "Expiring";
  return "Live";
}

function formatExpiryShort(raw: string | null): string {
  if (!raw) return "—";
  const parsed = Date.parse(String(raw).replace(" ", "T"));
  if (Number.isNaN(parsed)) return raw;
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(parsed));
}

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const t = Date.parse(String(raw).includes("T") ? String(raw) : String(raw).replace(" ", "T"));
  if (Number.isNaN(t)) return null;
  return new Date(t);
}

function formatRelative(raw: string | null): string {
  const d = parseDate(raw);
  if (!d) return "No activity";
  const minutes = Math.floor((Date.now() - d.getTime()) / 60000);
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

function formatSeen(raw: string | null): string {
  const d = parseDate(raw);
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function relativeTone(raw: string | null): string {
  const d = parseDate(raw);
  if (!d) return "text-rose-600 dark:text-rose-400";
  const ageMs = Date.now() - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (ageMs < 7 * day) return "text-emerald-700 dark:text-emerald-300";
  if (ageMs >= 365 * day) return "text-rose-600 dark:text-rose-400";
  if (ageMs >= 180 * day) return "text-orange-600 dark:text-orange-400";
  if (ageMs >= 90 * day) return "text-amber-600 dark:text-amber-300";
  return "text-slate-700 dark:text-slate-200";
}

/** Admin modal: paged subscriber list from a JSON API (manager / reseller / dealer scope). */
export function AdminSubscribersFetchModal({
  open,
  onOpenChange,
  apiBaseUrl,
  fixedQuery,
  entityDisplayName,
  entityLogin,
  scopeDescription,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** e.g. `/api/admin/managers/foo/subscribers` — no `?` query */
  apiBaseUrl: string;
  /** Optional fixed query params included in every request (e.g. status). */
  fixedQuery?: Record<string, string | undefined>;
  entityDisplayName: string;
  entityLogin: string;
  scopeDescription: string;
}) {
  const titleId = useId();
  const searchFieldId = useId();
  const searchFormId = useId();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [pageInput, setPageInput] = useState("1");
  const [sortKey, setSortKey] = useState<SortKey>("account");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [columnsOpen, setColumnsOpen] = useState(false);
  const columnsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const columnsPopoverRef = useRef<HTMLDivElement | null>(null);
  const [columnsPopoverStyle, setColumnsPopoverStyle] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>({
    account: true,
    user: true,
    hierarchy: true,
    package: true,
    mac: true,
    ip: true,
    autoRenew: true,
    status: true,
    expires: true,
    device: true,
  });
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPage(1);
    setPageSize(25);
    setStatusFilter("all");
    setSearchInput("");
    setAppliedSearch("");
  }, [open, apiBaseUrl]);

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    const fixedStatus = (fixedQuery?.status ?? "").trim().toLowerCase();
    const hasFixedStatus = fixedStatus === "active" || fixedStatus === "expiring" || fixedStatus === "expired" || fixedStatus === "inactive";
    for (const [k, v] of Object.entries(fixedQuery ?? {})) {
      if (v) qs.set(k, v);
    }
    if (!hasFixedStatus && statusFilter !== "all") qs.set("status", statusFilter);
    if (appliedSearch) qs.set("query", appliedSearch);
    const path = `${apiBaseUrl}?${qs.toString()}`;
    fetch(path, { credentials: "same-origin", cache: "no-store" })
      .then(async (r) => {
        const { data, empty, jsonError } = await readResponseBody(r);
        if (jsonError) {
          throw new Error("Invalid response from server. Try refreshing the page.");
        }
        if (empty) {
          if (r.status === 403) throw new Error("Session expired or access denied. Refresh and sign in again.");
          if (!r.ok) throw new Error(r.statusText || "Request failed (empty response).");
          throw new Error("Empty response from server. Try refreshing and trying again.");
        }
        const payload = data as { error?: string; rows?: Row[]; total?: number };
        if (!r.ok) {
          const err =
            payload.error === "forbidden"
              ? "Session expired or access denied."
              : payload.error === "server_error"
                ? "Could not load subscribers. Check the database connection."
                : typeof payload.error === "string"
                  ? payload.error
                  : r.statusText;
          throw new Error(err || "Request failed");
        }
        return payload as { rows: Row[]; total: number };
      })
      .then((data) => {
        if (cancelled) return;
        setRows(Array.isArray(data.rows) ? data.rows : []);
        setTotal(Number(data.total) || 0);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load");
        setRows([]);
        setTotal(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, apiBaseUrl, fixedQuery, page, pageSize, statusFilter, appliedSearch]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !columnsOpen) return;
    const place = () => {
      const trigger = columnsTriggerRef.current;
      const pop = columnsPopoverRef.current;
      if (!trigger) return;
      const tr = trigger.getBoundingClientRect();
      const popWidth = pop?.offsetWidth ?? 224;
      const popHeight = pop?.offsetHeight ?? 340;
      const maxLeft = window.innerWidth - popWidth - 8;
      const left = Math.max(8, Math.min(maxLeft, tr.right - popWidth));
      const viewportHeight = Math.max(120, window.innerHeight - 16);
      const maxHeight = Math.min(Math.max(220, viewportHeight), 420);
      const roomBelow = window.innerHeight - tr.bottom - 8;
      const roomAbove = tr.top - 8;
      const openUp = roomBelow < Math.min(260, maxHeight) && roomAbove > roomBelow;
      const desiredTop = openUp ? tr.top - Math.min(popHeight, maxHeight) - 8 : tr.bottom + 8;
      const maxTop = window.innerHeight - Math.min(popHeight, maxHeight) - 8;
      const top = Math.max(8, Math.min(maxTop, desiredTop));
      setColumnsPopoverStyle({ top, left, maxHeight });
    };
    place();
    const onDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-columns-popover]") || target.closest("[data-columns-trigger]")) return;
      setColumnsOpen(false);
    };
    const onResize = () => place();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open, columnsOpen]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const fixedStatus = (fixedQuery?.status ?? "").trim().toLowerCase();
  const hasFixedStatus = fixedStatus === "active" || fixedStatus === "expiring" || fixedStatus === "expired" || fixedStatus === "inactive";
  const sortedRows = useMemo(() => {
    const out = [...rows];
    const dir = sortDir === "asc" ? 1 : -1;
    const text = (v: string | null | undefined) => String(v ?? "").toLowerCase();
    const boolNum = (v: boolean | null) => (v == null ? -1 : v ? 1 : 0);
    out.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "account":
          cmp = text(a.account).localeCompare(text(b.account));
          break;
        case "user":
          cmp = text(a.full_name).localeCompare(text(b.full_name));
          break;
        case "hierarchy":
          cmp = `${text(a.dealer)}/${text(a.reseller)}/${text(a.manager)}`.localeCompare(`${text(b.dealer)}/${text(b.reseller)}/${text(b.manager)}`);
          break;
        case "package":
          cmp = text(a.packageName).localeCompare(text(b.packageName));
          break;
        case "mac":
          cmp = text(a.mac).localeCompare(text(b.mac));
          break;
        case "ip":
          cmp = text(a.ip).localeCompare(text(b.ip));
          break;
        case "autoRenew":
          cmp = boolNum(a.autoRenew) - boolNum(b.autoRenew);
          break;
        case "status":
          cmp = statusLabel(a).localeCompare(statusLabel(b));
          break;
        case "expires":
          cmp = (parseDate(a.expires)?.getTime() ?? 0) - (parseDate(b.expires)?.getTime() ?? 0);
          break;
        case "device":
          cmp = (parseDate(a.lastActive)?.getTime() ?? 0) - (parseDate(b.lastActive)?.getTime() ?? 0);
          break;
      }
      if (cmp !== 0) return cmp * dir;
      return text(a.account).localeCompare(text(b.account));
    });
    return out;
  }, [rows, sortDir, sortKey]);
  const sortableHeader = (key: SortKey, label: string) => (
    <th className={dataTableStickyTh("text-center text-[10px] font-bold tracking-wider sm:px-4")}>
      <button
        type="button"
        onClick={() => {
          if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
          else {
            setSortKey(key);
            setSortDir("asc");
          }
        }}
        className="inline-flex items-center justify-center gap-1 hover:text-foreground"
      >
        {label}
        {sortKey === key ? <ChevronDown className={`h-3.5 w-3.5 ${sortDir === "asc" ? "rotate-180" : ""}`} aria-hidden /> : <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" aria-hidden />}
      </button>
    </th>
  );
  const pageItems = useMemo(() => {
    if (totalPages <= 1) return [1];
    const set = new Set<number>([1, totalPages, page - 1, page, page + 1]);
    return Array.from(set).filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  }, [page, totalPages]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        aria-label="Close dialog"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[min(90vh,860px)] w-[min(98vw,1680px)] flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xl ring-1 ring-black/5 dark:ring-white/10"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border/60 bg-muted/[0.16] px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <h2 id={titleId} className="sr-only">
              Users list
            </h2>
            <div className="flex w-full flex-wrap items-center justify-start gap-1.5 text-left text-sm">
              <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-background px-2.5 py-1 font-medium text-foreground shadow-sm">
                <UserRound className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                {entityDisplayName || entityLogin}
              </span>
              <span className="inline-flex items-center rounded-md border border-border/60 bg-background/70 px-2 py-1 font-mono text-[11px] text-muted-foreground">
                {entityLogin}
              </span>
            </div>
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/80" aria-hidden />
              {scopeDescription}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="ghost" size="sm" className="h-9 w-9 shrink-0 p-0" aria-label="Close" onClick={close}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="shrink-0 border-b border-border/40 px-4 py-2.5 sm:px-5">
          <form
            id={searchFormId}
            className="rounded-xl border border-border/60 bg-muted/[0.08] p-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setAppliedSearch(searchInput.trim());
            }}
          >
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[220px] flex-1">
                <input
                  id={searchFieldId}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    (e.currentTarget.form ?? document.getElementById(searchFormId) as HTMLFormElement | null)?.requestSubmit();
                  }}
                  placeholder="Account, name, MAC…"
                  className="h-10 w-full rounded-lg border border-border/70 bg-background px-3 text-sm outline-none transition-[border-color,box-shadow] focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/20"
                />
              </div>
              {!hasFixedStatus ? (
                <SelectRoot
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v as "all" | "active" | "inactive");
                    setPage(1);
                  }}
                >
                  <SelectTrigger
                    className="h-10 w-[146px] border-border/70 bg-background text-sm font-medium text-foreground hover:bg-muted/20 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/20"
                    aria-label="Status filter"
                  >
                    <SelectValue placeholder="All status" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="z-[380]">
                    <SelectItem value="all">All status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </SelectRoot>
              ) : null}
              <SelectRoot
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number.parseInt(v, 10));
                  setPage(1);
                }}
              >
                <SelectTrigger
                  className="h-10 w-[124px] border-border/70 bg-background text-sm font-medium text-foreground hover:bg-muted/20 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/20"
                  aria-label="Rows per page"
                >
                  <SelectValue placeholder="25 / page" />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[380]">
                  <SelectItem value="10">10 / page</SelectItem>
                  <SelectItem value="25">25 / page</SelectItem>
                  <SelectItem value="50">50 / page</SelectItem>
                  <SelectItem value="100">100 / page</SelectItem>
                </SelectContent>
              </SelectRoot>
              <div className="relative">
                <button
                  type="button"
                  data-columns-trigger
                  ref={columnsTriggerRef}
                  onClick={() => setColumnsOpen((o) => !o)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border/70 bg-background text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                  aria-label="Column settings"
                  title="Column settings"
                >
                  <Settings2 className="h-4 w-4" aria-hidden />
                </button>
                {columnsOpen ? (
                  <div
                    ref={columnsPopoverRef}
                    data-columns-popover
                    className={`fixed z-[380] w-56 overflow-y-auto rounded-lg border border-border bg-popover p-1.5 shadow-xl ${columnsPopoverStyle ? "opacity-100" : "pointer-events-none opacity-0"}`}
                    style={{ top: columnsPopoverStyle?.top ?? 0, left: columnsPopoverStyle?.left ?? 0, maxHeight: columnsPopoverStyle?.maxHeight ?? 320 }}
                  >
                    {(
                      [
                        ["account", "Account"],
                        ["user", "User"],
                        ["hierarchy", "Dealer / Reseller / Manager"],
                        ["package", "Package"],
                        ["mac", "MAC"],
                        ["ip", "IP"],
                        ["autoRenew", "Auto renew"],
                        ["status", "Status"],
                        ["expires", "Expires"],
                        ["device", "Device"],
                      ] as const
                    ).map(([key, label]) => {
                      const checked = visibleColumns[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() =>
                            setVisibleColumns((prev) => {
                              const enabledCount = Object.values(prev).filter(Boolean).length;
                              if (prev[key] && enabledCount <= 1) return prev;
                              return { ...prev, [key]: !prev[key] };
                            })
                          }
                          className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs text-foreground hover:bg-muted/60"
                        >
                          <span>{label}</span>
                          {checked ? <Check className="h-3.5 w-3.5 text-primary" aria-hidden /> : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          </form>
        </div>

        <div className="min-h-0 flex-1 app-data-table-scroll thin-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              <span className="text-sm">Loading…</span>
            </div>
          ) : error ? (
            <p className="px-4 py-8 text-center text-sm text-destructive sm:px-5">{error}</p>
          ) : (
            <table className="w-full min-w-[1280px] border-collapse text-sm">
              <thead>
                <tr>
                  {visibleColumns.account ? sortableHeader("account", "Account") : null}
                  {visibleColumns.user ? sortableHeader("user", "User") : null}
                  {visibleColumns.hierarchy ? sortableHeader("hierarchy", "Dealer / Reseller / Manager") : null}
                  {visibleColumns.package ? sortableHeader("package", "Package") : null}
                  {visibleColumns.mac ? sortableHeader("mac", "MAC") : null}
                  {visibleColumns.ip ? sortableHeader("ip", "IP") : null}
                  {visibleColumns.autoRenew ? sortableHeader("autoRenew", "Auto renew") : null}
                  {visibleColumns.status ? sortableHeader("status", "Status") : null}
                  {visibleColumns.expires ? sortableHeader("expires", "Expires") : null}
                  {visibleColumns.device ? sortableHeader("device", "Device") : null}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={Object.values(visibleColumns).filter(Boolean).length} className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-5">
                      No users found.
                    </td>
                  </tr>
                ) : null}
                {sortedRows.map((r) => (
                  <tr key={r.account} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                    {visibleColumns.account ? <td className="px-3 py-2.5 text-center text-foreground sm:px-4">{r.account}</td> : null}
                    {visibleColumns.user ? <td className="max-w-[180px] truncate px-3 py-2.5 text-center text-foreground sm:px-4">{r.full_name || "—"}</td> : null}
                    {visibleColumns.hierarchy ? <td className="max-w-[300px] truncate px-3 py-2.5 text-center text-xs sm:px-4">
                      <span className="text-amber-700 dark:text-amber-200">{r.dealer || "-"}</span>
                      <span className="px-1 text-muted-foreground">/</span>
                      <span className="text-sky-700 dark:text-sky-200">{r.reseller || "-"}</span>
                      <span className="px-1 text-muted-foreground">/</span>
                      <span className="text-violet-700 dark:text-violet-200">{r.manager || "-"}</span>
                    </td> : null}
                    {visibleColumns.package ? <td className="max-w-[140px] truncate px-3 py-2.5 text-center text-xs text-muted-foreground sm:px-4">{r.packageName || "—"}</td> : null}
                    {visibleColumns.mac ? <td className="max-w-[160px] truncate px-3 py-2.5 text-center font-mono text-xs text-muted-foreground sm:px-4">{r.mac || "—"}</td> : null}
                    {visibleColumns.ip ? <td className="max-w-[120px] truncate px-3 py-2.5 text-center font-mono text-xs text-muted-foreground sm:px-4">{r.ip || "—"}</td> : null}
                    {visibleColumns.autoRenew ? <td className="px-3 py-2.5 text-center text-xs text-muted-foreground sm:px-4">{r.autoRenew == null ? "—" : r.autoRenew ? "Yes" : "No"}</td> : null}
                    {visibleColumns.status ? <td className="px-3 py-2.5 text-center sm:px-4">
                      <span
                        className={
                          statusLabel(r) === "Active"
                            ? "inline-flex rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-400/35 dark:bg-emerald-500/12 dark:text-emerald-200"
                            : "inline-flex rounded-full border border-rose-300 bg-rose-100 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 dark:border-rose-400/35 dark:bg-rose-500/12 dark:text-rose-200"
                        }
                      >
                        {statusLabel(r)}
                      </span>
                    </td> : null}
                    {visibleColumns.expires ? <td className="whitespace-nowrap px-3 py-2.5 text-center font-mono text-xs text-muted-foreground sm:px-4">
                      <div className="inline-flex flex-col items-center gap-1">
                        <span>{formatExpiryShort(r.expires)}</span>
                        {(() => {
                          const state = expiryState(r.expires);
                          if (!state) return null;
                          return (
                            <span
                              className={
                                state === "Live"
                                  ? "inline-flex rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-400/35 dark:bg-emerald-500/12 dark:text-emerald-200"
                                  : state === "Expiring"
                                    ? "inline-flex rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-400/35 dark:bg-amber-500/12 dark:text-amber-200"
                                    : "inline-flex rounded-full border border-rose-300 bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:border-rose-400/35 dark:bg-rose-500/12 dark:text-rose-200"
                              }
                            >
                              {state}
                            </span>
                          );
                        })()}
                      </div>
                    </td> : null}
                    {visibleColumns.device ? <td className="px-3 py-2.5 text-center text-xs text-muted-foreground sm:px-4">
                      <div className="inline-flex flex-col items-center gap-0.5">
                        <div className="inline-flex items-center gap-1.5">
                          <span
                            className={
                              r.receiverOnline
                                ? "inline-flex rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-400/35 dark:bg-emerald-500/12 dark:text-emerald-200"
                                : "inline-flex rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/12 dark:text-slate-200"
                            }
                          >
                            {r.receiverOnline ? "ON" : "OFF"}
                          </span>
                          <span className={relativeTone(r.lastActive)}>{formatRelative(r.lastActive)}</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">{formatSeen(r.lastActive)}</span>
                      </div>
                    </td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && !error && total > pageSize ? (
          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border/60 px-4 py-3 text-sm text-muted-foreground sm:px-5">
            <span>
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
            </span>
            <div className="flex items-center gap-1.5">
              <Button type="button" variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page <= 1} onClick={() => setPage(1)} aria-label="First page">
                <ChevronsLeft className="h-4 w-4" aria-hidden />
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </Button>
              {pageItems.map((p, idx) => (
                <div key={p} className="inline-flex items-center gap-1.5">
                  {idx > 0 && p - pageItems[idx - 1] > 1 ? <span className="px-1 text-xs text-muted-foreground">…</span> : null}
                  <Button
                    type="button"
                    variant={p === page ? "default" : "outline"}
                    size="sm"
                    className="min-w-9 px-2"
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page >= totalPages} onClick={() => setPage(totalPages)} aria-label="Last page">
                <ChevronsRight className="h-4 w-4" aria-hidden />
              </Button>
              <form
                className="ml-1 inline-flex items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  const next = Number.parseInt(pageInput, 10);
                  if (!Number.isFinite(next)) {
                    setPageInput(String(page));
                    return;
                  }
                  const clamped = Math.max(1, Math.min(totalPages, next));
                  setPage(clamped);
                  setPageInput(String(clamped));
                }}
              >
                <span className="text-xs text-muted-foreground">Pg</span>
                <input
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value.replace(/[^\d]/g, ""))}
                  className="h-8 w-14 rounded-md border border-border/70 bg-background px-2 text-center text-xs text-foreground outline-none focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/20"
                  inputMode="numeric"
                  aria-label="Go to page"
                />
              </form>
            </div>
          </footer>
        ) : !loading && !error && total > 0 ? (
          <footer className="shrink-0 border-t border-border/60 px-4 py-2 text-xs text-muted-foreground sm:px-5">
            {total} user{total === 1 ? "" : "s"}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import type { ReactNode, Ref } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronsUpDown, Settings2, ShieldCheck, UserRound, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Input } from "@/components/ui/input";
import { SelectContent, SelectItem, SelectRoot, SelectTrigger, SelectValue } from "@/components/ui/select";

type RowType = "MANAGER" | "RESELLER";

type BranchRow = {
  type: "RESELLER" | "DEALER";
  username: string;
  name: string;
  parent: string;
  status: string;
  stateCurrentLogin: string;
  stateLastLogin: string;
  branchCount: number;
  activeUsers: number;
  expiredUsers: number;
  totalUsers: number;
  credits: number;
};

type SortKey =
  | "name"
  | "username"
  | "credits"
  | "branchCount"
  | "parent"
  | "status"
  | "state"
  | "type"
  | "activeUsers"
  | "expiredUsers"
  | "totalUsers";

export function AdminListModalTrigger({
  label,
  rowType,
  username,
  className,
  triggerRef,
}: {
  label: ReactNode;
  rowType: RowType;
  username: string;
  className?: string;
  triggerRef?: Ref<HTMLButtonElement>;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "Active" | "Inactive">("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const columnsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const columnsPopoverRef = useRef<HTMLDivElement | null>(null);
  const [columnsPopoverStyle, setColumnsPopoverStyle] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const [visibleCols, setVisibleCols] = useState({
    name: true,
    username: true,
    credits: true,
    branchCount: true,
    parent: true,
    status: true,
    state: true,
    type: true,
    activeUsers: true,
    expiredUsers: true,
    totalUsers: true,
  });
  const [title, setTitle] = useState("Staff");
  const [subtitle, setSubtitle] = useState("");
  const [rows, setRows] = useState<BranchRow[]>([]);
  const showBranchColumn = title !== "Dealers";
  const branchLabel = "Dealers";

  function parseDate(raw: string): Date | null {
    const s = String(raw ?? "").trim();
    if (!s || s === "—" || s.startsWith("0000-00-00")) return null;
    const t = Date.parse(s.includes("T") ? s : s.replace(" ", "T"));
    if (Number.isNaN(t)) return null;
    return new Date(t);
  }

  function stateLabel(r: BranchRow): string {
    const d = parseDate(r.stateCurrentLogin) ?? parseDate(r.stateLastLogin);
    if (!d) return "No login";
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

  function formatStateLastSeen(raw: string): string {
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

  function derivePresence(currentRaw: string): { label: "ONLINE" | "IDLE" | "OFFLINE"; badgeClass: string; relativeClass: string } {
    const current = parseDate(currentRaw);
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

  function ageToneClass(d: Date | null): string {
    if (!d) return "text-rose-600 dark:text-rose-400";
    const ageMs = Date.now() - d.getTime();
    const day = 24 * 60 * 60 * 1000;
    if (ageMs < 7 * day) return "text-emerald-700 dark:text-emerald-300";
    if (ageMs >= 365 * day) return "text-rose-600 dark:text-rose-400";
    if (ageMs >= 180 * day) return "text-orange-600 dark:text-orange-400";
    if (ageMs >= 90 * day) return "text-amber-600 dark:text-amber-300";
    return "text-slate-700 dark:text-slate-200";
  }

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (!q) return true;
      return `${r.name} ${r.username} ${r.parent} ${r.status} ${r.credits} ${r.activeUsers} ${r.expiredUsers} ${r.totalUsers} ${stateLabel(r)}`
        .toLowerCase()
        .includes(q);
    });
  }, [rows, query, statusFilter]);

  const sortedRows = useMemo(() => {
    const out = [...filteredRows];
    const dir = sortDir === "asc" ? 1 : -1;
    out.sort((a, b) => {
      const txt = (x: string, y: string) => x.localeCompare(y, undefined, { sensitivity: "base" });
      const num = (x: number, y: number) => x - y;
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = txt(a.name || "", b.name || "");
          break;
        case "username":
          cmp = txt(a.username, b.username);
          break;
        case "credits":
          cmp = num(a.credits, b.credits);
          break;
        case "branchCount":
          cmp = num(a.branchCount, b.branchCount);
          break;
        case "parent":
          cmp = txt(a.parent || "", b.parent || "");
          break;
        case "status":
          cmp = txt(a.status, b.status);
          break;
        case "state":
          cmp = num((parseDate(a.stateCurrentLogin)?.getTime() ?? parseDate(a.stateLastLogin)?.getTime() ?? 0), (parseDate(b.stateCurrentLogin)?.getTime() ?? parseDate(b.stateLastLogin)?.getTime() ?? 0));
          break;
        case "type":
          cmp = txt(a.type, b.type);
          break;
        case "activeUsers":
          cmp = num(a.activeUsers, b.activeUsers);
          break;
        case "expiredUsers":
          cmp = num(a.expiredUsers, b.expiredUsers);
          break;
        case "totalUsers":
          cmp = num(a.totalUsers, b.totalUsers);
          break;
      }
      if (cmp !== 0) return cmp * dir;
      return txt(a.username, b.username);
    });
    return out;
  }, [filteredRows, sortDir, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/staff-branches?rowType=${encodeURIComponent(rowType)}&username=${encodeURIComponent(username)}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("load_failed");
        const json = (await res.json()) as { title: string; subtitle: string; rows: BranchRow[] };
        if (!cancelled) {
          setTitle(json.title);
          setSubtitle(json.subtitle);
          setRows(json.rows);
          setVisibleCols((prev) => ({ ...prev, branchCount: json.title !== "Dealers" }));
          setPage(1);
        }
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [open, rowType, username]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, pageSize, sortDir, sortKey]);

  const sortHeader = (key: SortKey, label: string, align: "left" | "right" = "left") => (
    <button
      type="button"
      onClick={() => {
        if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else {
          setSortKey(key);
          setSortDir("asc");
        }
      }}
      className={cn("inline-flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground", align === "right" ? "ml-auto justify-end" : "")}
    >
      {label}
      {sortKey === key ? <ChevronDown className={cn("h-3.5 w-3.5", sortDir === "asc" ? "rotate-180" : "")} aria-hidden /> : <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" aria-hidden />}
    </button>
  );

  useEffect(() => {
    if (!open || !columnsOpen) return;
    const place = () => {
      const trigger = columnsTriggerRef.current;
      const pop = columnsPopoverRef.current;
      if (!trigger) return;
      const tr = trigger.getBoundingClientRect();
      const popWidth = pop?.offsetWidth ?? 208; // w-52 fallback before first measurement
      const popHeight = pop?.offsetHeight ?? 320;
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

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button type="button" ref={triggerRef} className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      {open ? (
        <div className="fixed inset-0 z-[340] flex items-center justify-center p-3 sm:p-5" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-[2px] transition-opacity"
            aria-label="Close list modal"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 w-[min(98vw,1380px)] overflow-hidden rounded-2xl border border-border/70 bg-card text-left shadow-2xl ring-1 ring-black/10 dark:ring-white/10">
            <div className="flex items-center justify-between border-b border-border/60 bg-muted/[0.16] px-3 py-3 sm:px-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold tracking-tight text-foreground">{title}</p>
                {subtitle ? (
                  <p className="mt-1 inline-flex max-w-full items-center gap-1.5 truncate rounded-md border border-border/70 bg-background/80 px-2 py-0.5 text-xs text-muted-foreground">
                    <UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate font-mono">{subtitle}</span>
                  </p>
                ) : null}
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/80" aria-hidden />
                  Scoped list view with table filters and sorting.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors",
                  "hover:bg-muted/40 hover:text-foreground",
                )}
                aria-label="Close list modal"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="max-h-[min(84vh,820px)] overflow-auto p-3 sm:p-4">
              <div className="mb-3 rounded-xl border border-border/60 bg-muted/[0.08] p-2.5 sm:p-3">
                <div className="mb-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Search & Filters</div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-[260px] flex-1">
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search name, username, users, credits..."
                      className="h-10 border-border/70 bg-background"
                    />
                  </div>
                  <SelectRoot value={statusFilter || "ALL"} onValueChange={(v) => setStatusFilter(v === "ALL" ? "" : (v as "Active" | "Inactive"))}>
                    <SelectTrigger
                      className={cn(
                        "h-10 w-[148px] border-border/70 bg-background text-sm font-medium text-foreground",
                        "hover:bg-muted/20 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/20",
                      )}
                      aria-label="Filter by status"
                    >
                      <SelectValue placeholder="All status" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="z-[380]">
                      <SelectItem value="ALL">All status</SelectItem>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </SelectRoot>
                  <SelectRoot value={String(pageSize)} onValueChange={(v) => setPageSize(Number.parseInt(v, 10))}>
                    <SelectTrigger
                      className={cn(
                        "h-10 w-[124px] border-border/70 bg-background text-sm font-medium text-foreground",
                        "hover:bg-muted/20 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/20",
                      )}
                      aria-label="Rows per page"
                    >
                      <SelectValue placeholder="10 / page" />
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
                      onClick={() => setColumnsOpen((v) => !v)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border/70 bg-background text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                      aria-label="Column settings"
                    >
                      <Settings2 className="h-4 w-4" aria-hidden />
                    </button>
                    {columnsOpen ? (
                      <div
                        ref={columnsPopoverRef}
                        data-columns-popover
                        className={cn(
                          "fixed z-[360] w-52 overflow-y-auto rounded-lg border border-border/70 bg-popover p-2 shadow-lg",
                          columnsPopoverStyle ? "opacity-100" : "pointer-events-none opacity-0",
                        )}
                        style={{ top: columnsPopoverStyle?.top ?? 0, left: columnsPopoverStyle?.left ?? 0, maxHeight: columnsPopoverStyle?.maxHeight ?? 320 }}
                      >
                        <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Columns</p>
                        {(
                          [
                            ["name", "Name"],
                            ["username", "Username"],
                            ["credits", "Credits"],
                            ...(showBranchColumn ? ([["branchCount", branchLabel]] as const) : ([] as const)),
                            ["parent", "Parent"],
                            ["status", "Status"],
                            ["state", "State"],
                            ["type", "Type"],
                            ["activeUsers", "Active"],
                            ["expiredUsers", "Expired"],
                            ["totalUsers", "Total"],
                          ] as const
                        ).map(([key, label]) => (
                          <label key={key} className="flex items-center gap-2 rounded-md px-1 py-1 text-sm text-foreground hover:bg-muted/40">
                            <input
                              type="checkbox"
                              checked={visibleCols[key]}
                              onChange={(e) => setVisibleCols((prev) => ({ ...prev, [key]: e.target.checked }))}
                            />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              {loading ? (
                <div className="rounded-xl border border-border/60 bg-background/40 p-6 text-sm text-muted-foreground">Loading...</div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/95 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
                  <table className="w-full min-w-[980px] border-collapse text-sm">
                    <thead>
                      <tr className="bg-muted/25 text-xs uppercase tracking-wide text-muted-foreground">
                        {visibleCols.name ? <th className="px-3 py-1.5 text-left">{sortHeader("name", "Name")}</th> : null}
                        {visibleCols.username ? <th className="px-3 py-1.5 text-left">{sortHeader("username", "Username")}</th> : null}
                        {visibleCols.credits ? <th className="px-3 py-1.5 text-right">{sortHeader("credits", "Credits", "right")}</th> : null}
                        {showBranchColumn && visibleCols.branchCount ? <th className="px-3 py-1.5 text-right">{sortHeader("branchCount", branchLabel, "right")}</th> : null}
                        {visibleCols.parent ? <th className="px-3 py-1.5 text-left">{sortHeader("parent", "Parent")}</th> : null}
                        {visibleCols.status ? <th className="px-3 py-1.5 text-left">{sortHeader("status", "Status")}</th> : null}
                        {visibleCols.state ? <th className="px-3 py-1.5 text-left">{sortHeader("state", "State")}</th> : null}
                        {visibleCols.type ? <th className="px-3 py-1.5 text-left">{sortHeader("type", "Type")}</th> : null}
                        {visibleCols.activeUsers ? <th className="px-3 py-1.5 text-right">{sortHeader("activeUsers", "Active", "right")}</th> : null}
                        {visibleCols.expiredUsers ? <th className="px-3 py-1.5 text-right">{sortHeader("expiredUsers", "Expired", "right")}</th> : null}
                        {visibleCols.totalUsers ? <th className="px-3 py-1.5 text-right">{sortHeader("totalUsers", "Total", "right")}</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((r) => (
                          <tr key={`${r.type}:${r.username}`} className="border-t border-border/50 odd:bg-background/80 even:bg-muted/[0.16] hover:bg-muted/30">
                            {visibleCols.name ? <td className="px-3 py-1.5 text-foreground">{r.name || "—"}</td> : null}
                            {visibleCols.username ? <td className="px-3 py-1.5 font-medium text-foreground">{r.username}</td> : null}
                            {visibleCols.credits ? (
                              <td className="px-3 py-1.5 text-right tabular-nums font-medium text-foreground">
                                {new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(r.credits)}
                              </td>
                            ) : null}
                            {showBranchColumn && visibleCols.branchCount ? (
                              <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{r.branchCount > 0 ? r.branchCount : "—"}</td>
                            ) : null}
                            {visibleCols.parent ? <td className="px-3 py-1.5 text-foreground">{r.parent || "—"}</td> : null}
                            {visibleCols.status ? (
                              <td className="px-3 py-1.5">
                                <span
                                  className={cn(
                                    "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1",
                                    r.status === "Active"
                                      ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                                      : "bg-rose-500/15 text-rose-300 ring-rose-500/30",
                                  )}
                                >
                                  {r.status}
                                </span>
                              </td>
                            ) : null}
                            {visibleCols.state ? (
                              <td className="px-3 py-1.5 text-muted-foreground">
                                {(() => {
                                  const effectiveDate = parseDate(r.stateCurrentLogin) ?? parseDate(r.stateLastLogin);
                                  const presence = derivePresence(r.stateCurrentLogin);
                                  const iso = effectiveDate ? effectiveDate.toISOString() : "";
                                  return (
                                    <div className="flex min-w-0 flex-col gap-0">
                                      <div className="flex items-center gap-2">
                                        <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide", presence.badgeClass)}>
                                          {presence.label}
                                        </span>
                                        <span className={cn("text-xs font-semibold", presence.relativeClass, ageToneClass(effectiveDate))}>
                                          {iso ? stateLabel(r) : "No login"}
                                        </span>
                                      </div>
                                      <span className="truncate text-[11px] text-muted-foreground">{iso ? formatStateLastSeen(iso) : "—"}</span>
                                    </div>
                                  );
                                })()}
                              </td>
                            ) : null}
                            {visibleCols.type ? (
                              <td className="px-3 py-1.5">
                                <span
                                  className={cn(
                                    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                                    r.type === "RESELLER"
                                      ? "border-sky-300 bg-sky-100 text-sky-700 dark:border-sky-400/35 dark:bg-sky-500/12 dark:text-sky-200"
                                      : "border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-400/35 dark:bg-amber-500/12 dark:text-amber-200",
                                  )}
                                >
                                  {r.type.toLowerCase()}
                                </span>
                              </td>
                            ) : null}
                            {visibleCols.activeUsers ? (
                              <td className="px-3 py-1.5 text-right tabular-nums font-medium text-emerald-300">
                                {new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(r.activeUsers)}
                              </td>
                            ) : null}
                            {visibleCols.expiredUsers ? (
                              <td className="px-3 py-1.5 text-right tabular-nums font-medium text-amber-300">
                                {new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(r.expiredUsers)}
                              </td>
                            ) : null}
                            {visibleCols.totalUsers ? (
                              <td className="px-3 py-1.5 text-right tabular-nums text-foreground">
                                {new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(r.totalUsers)}
                              </td>
                            ) : null}
                          </tr>
                        ))}
                      {pageRows.length === 0 ? (
                        <tr>
                          <td
                            className="px-3 py-8 text-center text-sm text-muted-foreground"
                            colSpan={Object.values(visibleCols).filter(Boolean).length || 1}
                          >
                            No rows match current filters.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium">
                  Showing {(currentPage - 1) * pageSize + (pageRows.length ? 1 : 0)}-
                  {(currentPage - 1) * pageSize + pageRows.length} of {sortedRows.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="rounded-md border border-border/70 px-2 py-1 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <span className="px-1">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="rounded-md border border-border/70 px-2 py-1 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

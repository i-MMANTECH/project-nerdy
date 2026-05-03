"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Settings2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SelectContent, SelectItem, SelectRoot, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AccountTransactionRow } from "@/lib/repos/billing";
import { formatTransactionRemarksForDisplay } from "@/lib/formatTransactionRemarks";
import { cn } from "@/lib/cn";
import { dataTableStickyTh } from "@/lib/ui/dataTableSticky";

function padTxnId(raw: string) {
  return raw.padStart(8, "0");
}

function dash(v: string | null | undefined) {
  if (v == null || v === "") return "—";
  return v;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return value;
  const date = d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const short = `${d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} ${time}`;
  return { date, time, compact: `${date} · ${time}`, short };
}

function normalizeRemarks(raw: string | null | undefined) {
  const text = formatTransactionRemarksForDisplay(raw);
  if (!text) return "";
  const cleaned = text.replace(/\s+/g, " ").trim();
  const transferMatch = cleaned.match(/^Credit From:\s*(.+?)\s+To:\s*(.+)$/i);
  if (transferMatch) {
    return `Transfer ${transferMatch[1].trim()} -> ${transferMatch[2].trim()}`;
  }
  return cleaned.replace(/:\s*/g, ": ");
}

/** Unified transaction labels across admin tables/modals. */
function typeBadge(type: string) {
  const t = type.toUpperCase();
  if (t === "DBIT") {
    return <span className="inline-block rounded border border-cyan-500/35 bg-cyan-500/15 px-1 py-px text-[10px] font-semibold leading-none text-cyan-200">BUY</span>;
  }
  if (t === "CRDT") {
    return <span className="inline-block rounded border border-teal-500/35 bg-teal-500/15 px-1 py-px text-[10px] font-semibold leading-none text-teal-200">CREDIT</span>;
  }
  if (t === "BONUS") {
    return <span className="inline-block rounded bg-primary/15 px-1 py-px text-[10px] font-semibold leading-none text-primary">BONUS</span>;
  }
  return <span className="inline-block rounded bg-destructive/15 px-1 py-px text-[10px] font-semibold leading-none text-destructive">REVERSED</span>;
}

/** PHP: DBIT → show `periods` in Months column; else → `free_month` (may be 0). */
function monthsCell(r: AccountTransactionRow) {
  if (r.type === "DBIT") return String(r.periods);
  if (r.free_month != null) return String(r.free_month);
  return "—";
}

/** Legacy ledger: BUY adds `periods`; CREDIT subtracts. Not “total credits” in the everyday sense. */
function netLedgerPeriods(rows: AccountTransactionRow[]) {
  return rows.reduce((sum, r) => sum + (r.type === "CRDT" ? -r.periods : r.periods), 0);
}

function creditsCell(periods: number) {
  if (periods === 0) return <span className="font-mono text-muted-foreground">0</span>;
  const cls = periods < 0 ? "text-rose-300" : "text-emerald-300";
  return <span className={cn("font-mono font-semibold tabular-nums", cls)}>{periods}</span>;
}

type Props = {
  rows: AccountTransactionRow[];
  /** Narrow sidebar: fixed table layout, wrapped dates, slim scrollbar — no ultra-wide min-width. */
  compact?: boolean;
};

type ColumnKey =
  | "transaction"
  | "type"
  | "credits"
  | "months"
  | "account"
  | "coverageStart"
  | "coverageEnd"
  | "remarks"
  | "timestamp";

const TABLE_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "transaction", label: "Transaction" },
  { key: "type", label: "Type" },
  { key: "credits", label: "Credits" },
  { key: "months", label: "Months" },
  { key: "account", label: "Sub-account" },
  { key: "coverageStart", label: "Coverage start" },
  { key: "coverageEnd", label: "Coverage end" },
  { key: "remarks", label: "Remarks" },
  { key: "timestamp", label: "Date / time" },
];

export function EndUserTransactionsTable({ rows, compact }: Props) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No data available in table.</p>;
  }

  /**
   * Narrow sidebar: `table-fixed` + `%` columns inside a ~360px card forces microscopic
   * column widths (per-character wrapping). Use one card per row instead.
   */
  if (compact) {
    return (
      <div className="space-y-2">
        <div className="thin-scrollbar flex max-h-[min(420px,55vh)] flex-col gap-2 overflow-y-auto pr-0.5">
          {rows.map((r, i) => {
            const remarks = formatTransactionRemarksForDisplay(r.remarks);
            return (
              <article
                key={`${r.transaction}-${i}`}
                className="rounded-xl border border-border/50 bg-muted/10 p-3 text-xs ring-1 ring-inset ring-black/[0.03] dark:ring-white/[0.04]"
              >
                <div className="mb-2.5 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] font-semibold tracking-tight text-foreground">
                      #{padTxnId(r.transaction)}
                    </span>
                    <span className="shrink-0">{typeBadge(r.type)}</span>
                  </div>
                  <time className="shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
                    {dash(r.timestamp)}
                  </time>
                </div>
                <dl className="grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-2 border-t border-border/40 pt-2.5 text-[11px] leading-snug sm:grid-cols-[6.5rem_1fr]">
                  <dt className="text-muted-foreground">Credits</dt>
                  <dd className="font-mono tabular-nums text-foreground">{r.periods}</dd>
                  <dt className="text-muted-foreground">Months</dt>
                  <dd className="font-mono tabular-nums text-foreground">{monthsCell(r)}</dd>
                  <dt className="text-muted-foreground">Sub-account</dt>
                  <dd className="min-w-0 break-words font-mono text-[10px] text-foreground">{dash(r.account)}</dd>
                  <dt className="text-muted-foreground">Coverage</dt>
                  <dd className="min-w-0 space-y-1 text-foreground">
                    <div>
                      <span className="text-[10px] text-muted-foreground">Start </span>
                      <span className="break-words font-mono text-[10px]">{dash(r.coverage_start)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground">End </span>
                      <span className="break-words font-mono text-[10px]">{dash(r.coverage_end)}</span>
                    </div>
                  </dd>
                  <dt className="text-muted-foreground">Remarks</dt>
                  <dd className="min-w-0 break-words text-muted-foreground" title={remarks || undefined}>
                    {dash(remarks)}
                  </dd>
                </dl>
              </article>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{rows.length}</span> transaction{rows.length === 1 ? "" : "s"}
          </span>
          <span>
            Net ledger (periods){" "}
            <span className="font-mono font-semibold tabular-nums text-foreground">{netLedgerPeriods(rows)}</span>
          </span>
        </div>
      </div>
    );
  }

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(() => new Set(TABLE_COLUMNS.map((c) => c.key)));
  const columnsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const columnsPopoverRef = useRef<HTMLDivElement | null>(null);
  const [columnsPopoverStyle, setColumnsPopoverStyle] = useState<{ top: number; left: number; maxHeight: number } | null>(null);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== "ALL" && r.type.toUpperCase() !== typeFilter) return false;
      if (!needle) return true;
      const hay = [
        r.transaction,
        r.type,
        String(r.periods),
        r.account ?? "",
        r.coverage_start ?? "",
        r.coverage_end ?? "",
        normalizeRemarks(r.remarks),
        r.timestamp ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [query, rows, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pagedRows = filteredRows.slice(start, start + pageSize);

  useEffect(() => {
    setPage(1);
  }, [query, typeFilter, pageSize]);

  useEffect(() => {
    if (!columnsOpen) return;
    const place = () => {
      const trigger = columnsTriggerRef.current;
      const pop = columnsPopoverRef.current;
      if (!trigger) return;
      const tr = trigger.getBoundingClientRect();
      const popWidth = pop?.offsetWidth ?? 192;
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
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-columns-popover]") || target.closest("[data-columns-trigger]")) return;
      setColumnsOpen(false);
    };
    const onResize = () => place();
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [columnsOpen]);

  const hasColumn = (key: ColumnKey) => visibleColumns.has(key);
  const visibleColCount = TABLE_COLUMNS.filter((c) => hasColumn(c.key)).length;
  const td = "px-2.5 py-2 align-middle leading-snug";
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-1.5 rounded-lg border border-border/45 bg-muted/15 p-1.5 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:max-w-md">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by ID, account, dates, remarks…"
            className="h-8 border-border/50 bg-background/80 text-sm shadow-sm transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground/70 focus-visible:border-primary/35 focus-visible:ring-2 focus-visible:ring-primary/15"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <SelectRoot value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger
              className="h-8 w-[118px] border-border/50 bg-background/80 text-xs shadow-sm transition-colors duration-200 hover:bg-muted/30"
              aria-label="Filter transaction type"
            >
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent position="popper" className="z-[380]">
              <SelectItem value="ALL">All types</SelectItem>
              <SelectItem value="DBIT">BUY</SelectItem>
              <SelectItem value="CRDT">CREDIT</SelectItem>
              <SelectItem value="BONUS">BONUS</SelectItem>
            </SelectContent>
          </SelectRoot>
          <SelectRoot value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger
              className="h-8 w-[118px] border-border/50 bg-background/80 text-xs shadow-sm transition-colors duration-200 hover:bg-muted/30"
              aria-label="Rows per page"
            >
              <SelectValue placeholder="10 / page" />
            </SelectTrigger>
            <SelectContent position="popper" className="z-[380]">
              <SelectItem value="10">10 / page</SelectItem>
              <SelectItem value="25">25 / page</SelectItem>
              <SelectItem value="50">50 / page</SelectItem>
            </SelectContent>
          </SelectRoot>
          <div className="relative">
            <button
              type="button"
              data-columns-trigger
              ref={columnsTriggerRef}
              onClick={() => setColumnsOpen((o) => !o)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/50 bg-background/80 text-foreground shadow-sm transition-[background-color,box-shadow] duration-200 hover:bg-muted/40 hover:shadow"
              aria-label="Table column settings"
              title="Choose visible columns"
            >
              <Settings2 className="h-4 w-4" aria-hidden />
            </button>
            {columnsOpen ? (
              <div
                ref={columnsPopoverRef}
                data-columns-popover
                className={`fixed z-[380] w-48 overflow-y-auto rounded-lg border border-border bg-popover p-1.5 shadow-xl ${columnsPopoverStyle ? "opacity-100" : "pointer-events-none opacity-0"}`}
                style={{ top: columnsPopoverStyle?.top ?? 0, left: columnsPopoverStyle?.left ?? 0, maxHeight: columnsPopoverStyle?.maxHeight ?? 320 }}
              >
                {TABLE_COLUMNS.map((col) => {
                  const checked = visibleColumns.has(col.key);
                  return (
                    <button
                      key={col.key}
                      type="button"
                      onClick={() => {
                        setVisibleColumns((prev) => {
                          const next = new Set(prev);
                          if (checked) {
                            if (next.size <= 1) return prev;
                            next.delete(col.key);
                            return next;
                          }
                          next.add(col.key);
                          return next;
                        });
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs text-foreground transition-colors duration-150 hover:bg-muted/55"
                    >
                      <span>{col.label}</span>
                      {checked ? <Check className="h-3.5 w-3.5 text-primary" aria-hidden /> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="app-data-table-scroll thin-scrollbar rounded-xl border border-border/40 bg-gradient-to-b from-background/30 to-muted/[0.12] shadow-inner [--app-data-table-max-h:min(52vh,26rem)]">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            {hasColumn("transaction") ? <th className={dataTableStickyTh("px-2.5 py-1.5 text-[10px] leading-tight")}>Transaction</th> : null}
            {hasColumn("type") ? <th className={dataTableStickyTh("px-2.5 py-1.5 text-[10px] leading-tight")}>Type</th> : null}
            {hasColumn("credits") ? <th className={dataTableStickyTh("px-2.5 py-1.5 text-[10px] leading-tight")}>Credits</th> : null}
            {hasColumn("months") ? <th className={dataTableStickyTh("px-2.5 py-1.5 text-[10px] leading-tight")}>Months</th> : null}
            {hasColumn("account") ? <th className={dataTableStickyTh("px-2.5 py-1.5 text-[10px] leading-tight")}>Sub-account</th> : null}
            {hasColumn("coverageStart") ? (
              <th className={dataTableStickyTh("px-2.5 py-1.5 text-[10px] leading-tight")}>Coverage start</th>
            ) : null}
            {hasColumn("coverageEnd") ? (
              <th className={dataTableStickyTh("px-2.5 py-1.5 text-[10px] leading-tight")}>Coverage end</th>
            ) : null}
            {hasColumn("remarks") ? <th className={dataTableStickyTh("px-2.5 py-1.5 text-[10px] leading-tight")}>Remarks</th> : null}
            {hasColumn("timestamp") ? <th className={dataTableStickyTh("px-2.5 py-1.5 text-[10px] leading-tight")}>Date / time</th> : null}
          </tr>
        </thead>
        <tbody>
          {filteredRows.length === 0 ? (
            <tr>
              <td colSpan={Math.max(1, visibleColCount)} className="px-4 py-10 text-center text-sm text-muted-foreground">
                No transactions match your search or filter.{" "}
                <button
                  type="button"
                  className="font-medium text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:decoration-primary"
                  onClick={() => {
                    setQuery("");
                    setTypeFilter("ALL");
                  }}
                >
                  Clear filters
                </button>
              </td>
            </tr>
          ) : null}
          {filteredRows.length > 0
            ? pagedRows.map((r, i) => (
            <tr key={`${r.transaction}-${i}`} className="border-b border-border/35 transition-[background-color] duration-150 ease-out odd:bg-background/[0.06] hover:bg-muted/30">
              {hasColumn("transaction") ? <td className={cn(td, "font-medium text-foreground")}>#{padTxnId(r.transaction)}</td> : null}
              {hasColumn("type") ? <td className={td}>{typeBadge(r.type)}</td> : null}
              {hasColumn("credits") ? <td className={td}>{creditsCell(r.periods)}</td> : null}
              {hasColumn("months") ? <td className={cn(td, "tabular-nums text-foreground")}>{monthsCell(r)}</td> : null}
              {hasColumn("account") ? <td className={cn(td, "text-foreground")}>{dash(r.account)}</td> : null}
              {hasColumn("coverageStart") ? <td className={cn(td, "max-w-[12rem]")}>
                {(() => {
                  const dt = formatDateTime(r.coverage_start);
                  if (typeof dt === "string") return <span className="text-muted-foreground">{dt}</span>;
                  return (
                    <span className="text-foreground" title={dt.compact}>
                      {dt.short}
                    </span>
                  );
                })()}
              </td> : null}
              {hasColumn("coverageEnd") ? <td className={cn(td, "max-w-[12rem]")}>
                {(() => {
                  const dt = formatDateTime(r.coverage_end);
                  if (typeof dt === "string") return <span className="text-muted-foreground">{dt}</span>;
                  return (
                    <span className="text-foreground" title={dt.compact}>
                      {dt.short}
                    </span>
                  );
                })()}
              </td> : null}
              {hasColumn("remarks") ? <td
                className={cn(td, "min-w-[20rem] max-w-[34rem] text-foreground")}
                title={normalizeRemarks(r.remarks) || undefined}
              >
                <span className="block line-clamp-1 whitespace-normal break-words leading-tight">{dash(normalizeRemarks(r.remarks))}</span>
              </td> : null}
              {hasColumn("timestamp") ? <td className={cn(td, "max-w-[12rem]")}>
                {(() => {
                  const dt = formatDateTime(r.timestamp);
                  if (typeof dt === "string") return <span className="text-muted-foreground">{dt}</span>;
                  return <span className="font-medium text-foreground">{dt.compact}</span>;
                })()}
              </td> : null}
            </tr>
          ))
            : null}
        </tbody>
      </table>
    </div>
      <div className="flex flex-col gap-1.5 rounded-lg border border-border/40 bg-muted/10 px-2 py-1.5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:px-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            Showing{" "}
            <span className="font-semibold tabular-nums text-foreground">{filteredRows.length === 0 ? 0 : pagedRows.length}</span>
            <span className="text-muted-foreground/80"> of </span>
            <span className="font-semibold tabular-nums text-foreground">{filteredRows.length}</span>
            <span className="text-muted-foreground/90"> matching</span>
          </span>
          <span className="hidden h-3 w-px bg-border/60 sm:inline" aria-hidden />
          <span
            className="inline-flex items-center gap-1"
            title="BUY rows add the Credits column value; CREDIT rows subtract it. Matches the legacy billing ledger (can be zero or negative while the account still has activity)."
          >
            <span className="text-muted-foreground/90">Net ledger</span>
            <span className="font-mono font-semibold tabular-nums text-foreground">{netLedgerPeriods(filteredRows)}</span>
            <span className="text-muted-foreground/70">periods</span>
          </span>
        </div>
        <div className="flex items-center gap-2 sm:shrink-0">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1 || filteredRows.length === 0}
            className="rounded-md border border-border/50 bg-background/60 px-2 py-1 text-xs font-medium text-foreground shadow-sm transition-[background-color,opacity,box-shadow] duration-200 hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <span className="tabular-nums text-muted-foreground">
            Page <span className="font-semibold text-foreground">{filteredRows.length === 0 ? 0 : currentPage}</span>
            <span className="text-muted-foreground/80"> / </span>
            <span className="font-semibold text-foreground">{filteredRows.length === 0 ? 0 : totalPages}</span>
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages || filteredRows.length === 0}
            className="rounded-md border border-border/50 bg-background/60 px-2 py-1 text-xs font-medium text-foreground shadow-sm transition-[background-color,opacity,box-shadow] duration-200 hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

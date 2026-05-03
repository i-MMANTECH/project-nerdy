"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import { useLayoutEffect, useMemo, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, Eye, ScanSearch, Search, Send } from "lucide-react";
import { sendMessageAction } from "@/actions/forms";
import type {
  AdminMessageAudiencePreviewCounts,
  AdminMessageRoleCounts,
  AdminRecentStalkerSendMessageRow,
  AdminStalkerMessageDashboardStats,
  StalkerMessageUserOption,
} from "@/lib/repos/billing";
import { Alert } from "@/components/ui/alert";
import { Button, buttonOutlineLinkClassName } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/forms/form-select";
import { cn } from "@/lib/cn";
import { dataTableStickyTh } from "@/lib/ui/dataTableSticky";

const LARGE_SEND_CONFIRM_THRESHOLD = 500;
const MAX_MESSAGE_LEN = 500;
const HISTORY_PAGE_SIZE = 100;

type MessageAudience = "all" | "active" | "expired" | "expiring" | "managers" | "resellers" | "inactive" | "custom";
type MessageStatusFilter = "all" | "delivered" | "queued";

const fieldLabelClass = "text-[11px] font-medium text-muted-foreground";

const selectClassName = cn(
  "h-10 w-full min-w-0 rounded-md border border-border/70 bg-background text-sm text-foreground",
  "focus-visible:border-cyan-500/40 focus-visible:ring-[2px] focus-visible:ring-cyan-500/20",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

const MESSAGE_AUDIENCE_OPTIONS = [
  { value: "all", label: "All subscribers (accounts -> STB users)" },
  { value: "active", label: "Active subscribers" },
  { value: "expired", label: "Expired subscribers" },
  { value: "expiring", label: "Expiring in 7 days" },
  { value: "managers", label: "Managers (portal notifications)" },
  { value: "resellers", label: "Resellers & dealers (portal notifications)" },
  { value: "inactive", label: "Inactive subscribers" },
  { value: "custom", label: "Custom subscribers" },
] as const;

const MESSAGE_PRIORITY_OPTIONS = [
  { value: "1", label: "High" },
  { value: "2", label: "Normal" },
  { value: "3", label: "Low" },
] as const;

const HISTORY_STATUS_OPTIONS = [
  { value: "all", label: "Status: All" },
  { value: "delivered", label: "Delivered" },
  { value: "queued", label: "Queued" },
] as const;

const HISTORY_PRIORITY_OPTIONS = [
  { value: "all", label: "Priority: All" },
  { value: "1", label: "High" },
  { value: "2", label: "Normal" },
  { value: "3", label: "Low" },
] as const;

const textareaClass = cn(
  "flex min-h-[180px] w-full min-w-0 rounded-md border border-border/70 bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-[color,box-shadow,border-color] duration-200 ease-out",
  "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground",
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  "focus-visible:border-cyan-500/40 focus-visible:ring-[2px] focus-visible:ring-cyan-500/20",
);

function formatInt(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

function priorityLabel(p: number | null | undefined) {
  const v = p ?? 2;
  if (v <= 1) return "High";
  if (v >= 3) return "Low";
  return "Normal";
}

function priorityPillClass(p: number | null | undefined) {
  const v = p ?? 2;
  if (v <= 1) return "border-rose-500/30 bg-rose-500/12 text-rose-200";
  if (v >= 3) return "border-slate-500/30 bg-slate-500/10 text-slate-200";
  return "border-border/60 bg-muted/35 text-muted-foreground";
}

function FormActions({ onReset }: { onReset: () => void }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-col gap-1.5 border-t border-border/60 pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-start sm:gap-2">
      <Link
        href="/admin/dashboard"
        className={buttonOutlineLinkClassName(
          "inline-flex min-h-10 w-full items-center justify-center rounded-md border-border/70 px-4 text-sm sm:w-auto",
        )}
      >
        Cancel
      </Link>
      <Button type="button" variant="outline" onClick={onReset} disabled={pending} className="min-h-10 w-full rounded-md sm:w-auto">
        Reset
      </Button>
      <Button
        type="submit"
        disabled={pending}
        className="min-h-10 w-full rounded-md border-0 bg-cyan-600 text-sm text-white shadow-sm hover:bg-cyan-700 sm:w-auto"
      >
        <Send className="h-4 w-4" aria-hidden />
        {pending ? "Sending…" : "Send message"}
      </Button>
    </div>
  );
}

export function AdminMessagesScreen({
  stalkerUsers,
  stalkerUserTotal,
  audiencePreview,
  roleCounts,
  stats,
  recent,
  sentByLabel,
}: {
  stalkerUsers: StalkerMessageUserOption[];
  stalkerUserTotal: number;
  audiencePreview: AdminMessageAudiencePreviewCounts;
  roleCounts: AdminMessageRoleCounts;
  stats: AdminStalkerMessageDashboardStats;
  recent: AdminRecentStalkerSendMessageRow[];
  sentByLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mainTab: "compose" | "history" = searchParams.get("tab") === "compose" ? "compose" : "history";

  function goTab(next: "compose" | "history") {
    const p = new URLSearchParams(searchParams.toString());
    if (next === "compose") p.delete("tab");
    else p.set("tab", "history");
    const q = p.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }

  // Safer default: operator explicitly picks recipients instead of broadcasting to all STB users.
  const [audience, setAudience] = useState<MessageAudience>("custom");
  const [priority, setPriority] = useState("2");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [messageBody, setMessageBody] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatus, setHistoryStatus] = useState<MessageStatusFilter>("all");
  const [historyPriority, setHistoryPriority] = useState("all");
  const [historyPage, setHistoryPage] = useState(1);
  const [detailRow, setDetailRow] = useState<AdminRecentStalkerSendMessageRow | null>(null);

  /** Subscribers table / row menu: `?account=LOGIN` or repeated `accounts=` (billing login) → custom + Stalker IDs. */
  useLayoutEffect(() => {
    const fromBulk = searchParams.getAll("accounts").flatMap((s) => s.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean));
    const single = (searchParams.get("account") ?? "").trim();
    const tokens = [...new Set([...fromBulk, ...(single ? [single] : [])])];
    if (!tokens.length) return;

    const matchedIds = new Set<number>();
    for (const raw of tokens) {
      const idKey = raw.replace(/^#/i, "");
      const hit = stalkerUsers.find(
        (u) => u.login.trim().toLowerCase() === raw.toLowerCase() || String(u.id) === idKey || String(u.id) === raw,
      );
      if (hit && Number.isFinite(hit.id) && hit.id > 0) matchedIds.add(hit.id);
    }
    setAudience("custom");
    setSelected(matchedIds);
    if (matchedIds.size === 1) {
      const only = stalkerUsers.find((u) => matchedIds.has(u.id));
      setSearch(only?.login ?? "");
    } else if (matchedIds.size > 1) {
      setSearch("");
    } else {
      setSearch(single || fromBulk[0] || "");
    }

    const p = new URLSearchParams(searchParams.toString());
    p.delete("account");
    p.delete("accounts");
    p.delete("tab");
    const next = p.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [searchParams, stalkerUsers, router, pathname]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stalkerUsers;
    return stalkerUsers.filter(
      (u) => u.login.toLowerCase().includes(q) || String(u.id).includes(q) || String(u.id) === q,
    );
  }, [stalkerUsers, search]);

  const selectedCount = selected.size;
  const recipientPreviewCount = useMemo(() => {
    if (audience === "custom") return selectedCount;
    if (audience === "all") return audiencePreview.all;
    return audiencePreview[audience];
  }, [audience, selectedCount, audiencePreview]);
  const delivered30d =
    stats.recipients30d > 0 && stats.deliveryPct != null ? Math.round((stats.recipients30d * stats.deliveryPct) / 100) : 0;
  const queued30d = Math.max(0, stats.recipients30d - delivered30d);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const u of filtered) {
        next.add(u.id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function lookupCustomer() {
    const raw = search.trim();
    if (!raw) return;
    const q = raw.replace(/^#/i, "");
    const hit = stalkerUsers.find(
      (u) => u.login.toLowerCase() === raw.toLowerCase() || String(u.id) === q || String(u.id) === raw,
    );
    if (!hit) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(hit.id)) return next;
      next.add(hit.id);
      return next;
    });
  }

  function resetForm() {
    setAudience("custom");
    setPriority("2");
    setSearch("");
    clearSelection();
    setMessageBody("");
  }

  function confirmLargeSend(e: FormEvent<HTMLFormElement>) {
    if (recipientPreviewCount <= LARGE_SEND_CONFIRM_THRESHOLD) return;
    const ok = window.confirm(`This send targets ${formatInt(recipientPreviewCount)} recipients. Continue?`);
    if (!ok) e.preventDefault();
  }

  const recipientSummaryReadOnly = useMemo(() => {
    if (audience === "all") return `All subscribers from billing accounts mapped to STB users (${formatInt(recipientPreviewCount)} recipients)`;
    if (audience === "active") return `${formatInt(audiencePreview.active)} active subscribers`;
    if (audience === "expired") return `${formatInt(audiencePreview.expired)} expired subscribers`;
    if (audience === "expiring") return `${formatInt(audiencePreview.expiring)} subscribers expiring within 7 days`;
    if (audience === "inactive") return `${formatInt(audiencePreview.inactive)} inactive subscribers`;
    if (audience === "managers") return `${formatInt(audiencePreview.managers)} active manager logins (portal notifications)`;
    if (audience === "resellers") return `${formatInt(audiencePreview.resellers)} active reseller & dealer logins (portal notifications)`;
    return "";
  }, [audience, recipientPreviewCount, audiencePreview]);
  const filteredRecent = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return recent.filter((row) => {
      const delivered = row.need_confirm === 0;
      if (historyStatus === "delivered" && !delivered) return false;
      if (historyStatus === "queued" && delivered) return false;
      if (historyPriority !== "all" && String(row.priority ?? 2) !== historyPriority) return false;
      if (!q) return true;
      const login = (row.login ?? "").toLowerCase();
      const msg = (row.msg ?? "").toLowerCase();
      const uid = String(row.uid ?? "");
      const addtime = (row.addtime ?? "").toLowerCase();
      return login.includes(q) || msg.includes(q) || uid.includes(q) || addtime.includes(q);
    });
  }, [recent, historySearch, historyStatus, historyPriority]);
  const historyTotalPages = Math.max(1, Math.ceil(filteredRecent.length / HISTORY_PAGE_SIZE));
  const historyPageSafe = Math.min(historyPage, historyTotalPages);
  const historyPageRows = useMemo(() => {
    const start = (historyPageSafe - 1) * HISTORY_PAGE_SIZE;
    return filteredRecent.slice(start, start + HISTORY_PAGE_SIZE);
  }, [filteredRecent, historyPageSafe]);
  const historyPageStart = filteredRecent.length === 0 ? 0 : (historyPageSafe - 1) * HISTORY_PAGE_SIZE + 1;
  const historyPageEnd = Math.min(filteredRecent.length, historyPageSafe * HISTORY_PAGE_SIZE);

  return (
    <div className="flex h-[calc(100vh-8.5rem)] min-h-0 flex-col gap-3 overflow-hidden">
      <section className="overflow-hidden rounded-lg border border-border/60 bg-card p-2.5 transition-colors duration-200">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-md border border-border/60 bg-muted/10 px-2 py-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Total</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground">{formatInt(stats.recipients30d)}</p>
          </div>
          <div className="rounded-md border border-emerald-500/25 bg-emerald-500/[0.07] px-2 py-1.5 transition-all duration-200 hover:bg-emerald-500/[0.1]">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-200/90">Delivered</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground">{formatInt(delivered30d)}</p>
            </div>
          <div className="rounded-md border border-amber-500/25 bg-amber-500/[0.07] px-2 py-1.5 transition-all duration-200 hover:bg-amber-500/[0.1]">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">Queued / pending</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground">{formatInt(queued30d)}</p>
          </div>
        </div>
      </section>
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/60 bg-card transition-colors duration-200">
        {mainTab === "compose" ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 backdrop-blur-[1px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="compose-message-modal-title"
            onClick={() => goTab("history")}
          >
            <div
              className="w-full max-w-[min(980px,96vw)] max-h-[92vh] overflow-auto rounded-xl border border-border/50 bg-card shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/50 bg-card px-3 py-2.5">
                <h2 id="compose-message-modal-title" className="text-sm font-medium text-foreground">
                  Compose message
                </h2>
                <button
                  type="button"
                  onClick={() => goTab("history")}
                  className="h-8 rounded-md border border-border/50 px-2 text-xs text-muted-foreground transition-colors hover:bg-muted/20 hover:text-foreground"
                >
                  Close
                </button>
              </div>
              <form action={sendMessageAction} onSubmit={confirmLargeSend} className="block">
            <div className="space-y-3 p-3 sm:p-4 lg:p-4">
              <p className="text-xs text-muted-foreground">Choose recipients, write your message, then send.</p>
              <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2 sm:col-span-1">
                  <label htmlFor="msg-audience" className={fieldLabelClass}>
                    Audience
                  </label>
                  <FormSelect
                    id="msg-audience"
                    name="audience"
                    value={audience}
                    onValueChange={(v) => setAudience(v as MessageAudience)}
                    options={[...MESSAGE_AUDIENCE_OPTIONS]}
                    placeholder="Choose audience"
                    className={selectClassName}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-1">
                  <label htmlFor="msg-priority" className={fieldLabelClass}>
                    Priority
                  </label>
                  <FormSelect
                    id="msg-priority"
                    name="priority"
                    value={priority}
                    onValueChange={setPriority}
                    options={[...MESSAGE_PRIORITY_OPTIONS]}
                    className={selectClassName}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-1">
                  <label htmlFor="est-reach" className={fieldLabelClass}>
                    Reach
                  </label>
                  <Input
                    id="est-reach"
                    readOnly
                    value={formatInt(recipientPreviewCount)}
                    className="h-10 border-border/70 bg-muted/15 font-mono text-sm tabular-nums"
                    title="Approximate recipients for this audience (billing rows or hand-picked count)."
                  />
                  <p className="text-[10px] text-muted-foreground">Estimated recipients for this send.</p>
                </div>
              </div>

              {audience !== "custom" ? (
                <div className="space-y-1.5">
                  <label htmlFor="msg-recipient-summary" className={fieldLabelClass}>
                    Who gets this
                  </label>
                  <Input id="msg-recipient-summary" readOnly value={recipientSummaryReadOnly} className="h-10 border-border/70 bg-muted/15 text-sm" />
                  <p className="text-[10px] text-muted-foreground">This summary updates automatically based on audience.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className={fieldLabelClass}>Selection</span>
                    <span className="rounded-md border border-border/50 bg-muted/15 px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                      {formatInt(selectedCount)} selected
                    </span>
                  </div>
                  <p className="rounded-lg border border-dashed border-border/50 bg-muted/5 px-2.5 py-1.5 text-sm text-muted-foreground">
                    {selectedCount ? (
                      <>
                        <span className="font-semibold tabular-nums text-foreground">{formatInt(selectedCount)}</span> customer
                        {selectedCount === 1 ? "" : "s"} selected
                      </>
                    ) : (
                      "Use Lookup or the list below to add customers."
                    )}
                  </p>
                </div>
              )}

              {audience === "custom" ? (
                <div className="space-y-3 rounded-lg border border-border/50 bg-muted/[0.06] p-3 sm:p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold text-foreground">Select customers</p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={addVisible} disabled={!stalkerUsers.length}>
                        Select all in view
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={clearSelection} disabled={!selectedCount}>
                        Clear all
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-stretch">
                    <div className="relative min-w-0 flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            lookupCustomer();
                          }
                        }}
                        placeholder="Search by login or STB user ID..."
                        className="h-9 border-border/60 bg-background pl-9 text-sm"
                        autoComplete="off"
                        aria-label="Search customers to add"
                      />
                    </div>
                    <Button type="button" variant="secondary" className="h-9 shrink-0 gap-1.5 rounded-md sm:min-w-[112px]" onClick={lookupCustomer}>
                      <ScanSearch className="h-4 w-4" aria-hidden />
                      Find
                    </Button>
                  </div>
                  {!stalkerUsers.length ? (
                    <Alert>
                      No Stalker directory loaded — check <span className="font-mono">STALKER_DATABASE_*</span>. You can still use broadcast audiences.
                    </Alert>
                  ) : (
                    <div
                      className="thin-scrollbar max-h-[min(260px,36vh)] overflow-y-auto overflow-x-hidden rounded-lg border border-border/50 bg-background shadow-inner"
                      style={{ scrollbarGutter: "stable" }}
                    >
                      {filtered.length === 0 ? (
                        <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matches for this filter.</p>
                      ) : (
                        <ul className="divide-y divide-border/40 p-0.5">
                          {filtered.map((u) => {
                            const checked = selected.has(u.id);
                            return (
                              <li key={u.id}>
                                <label
                                  className={cn(
                                    "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-muted/25",
                                    checked && "bg-cyan-500/[0.06]",
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 shrink-0 rounded border-border/80 text-cyan-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 dark:text-cyan-400"
                                    checked={checked}
                                    onChange={() => toggle(u.id)}
                                  />
                                  <span className="min-w-0 flex-1 font-mono text-sm text-foreground">{u.login}</span>
                                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">#{u.id}</span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                  {[...selected].map((id) => (
                    <input key={id} type="hidden" name="users" value={String(id)} />
                  ))}
                </div>
              ) : null}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-1.5">
                  <label htmlFor="admin-msg-body" className={fieldLabelClass}>
                    Message
                  </label>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {messageBody.length} / {MAX_MESSAGE_LEN}
                  </span>
                </div>
                <textarea
                  id="admin-msg-body"
                  name="message"
                  rows={6}
                  maxLength={MAX_MESSAGE_LEN}
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  placeholder="Write what users should see on screen..."
                  className={textareaClass}
                  required
                />
              </div>

              <FormActions onReset={resetForm} />
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                Audiences come from billing <span className="font-mono">accounts</span> matched to Stalker <span className="font-mono">users.login</span>. Unmatched accounts are skipped. Large sends require confirmation before queueing.
              </p>
            </div>
            </div>
              </form>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-muted/[0.04] px-2 py-2 sm:px-2.5">
              <Input
                value={historySearch}
                onChange={(e) => {
                  setHistorySearch(e.target.value);
                  setHistoryPage(1);
                }}
                placeholder="Search recipient, message, uid, time..."
                className="h-9 w-[min(100%,24rem)] border-border/70 bg-background text-sm"
                aria-label="Search messages"
              />
              <FormSelect
                id="history-status-filter"
                name="history-status-filter"
                value={historyStatus}
                onValueChange={(v) => {
                  setHistoryStatus(v as MessageStatusFilter);
                  setHistoryPage(1);
                }}
                options={[...HISTORY_STATUS_OPTIONS]}
                className="h-9 w-40 border-border/70 bg-background text-sm"
              />
              <FormSelect
                id="history-priority-filter"
                name="history-priority-filter"
                value={historyPriority}
                onValueChange={(v) => {
                  setHistoryPriority(v);
                  setHistoryPage(1);
                }}
                options={[...HISTORY_PRIORITY_OPTIONS]}
                className="h-9 w-40 border-border/70 bg-background text-sm"
              />
              <Link
                href="/admin/message?tab=compose"
                className="ml-auto inline-flex h-9 items-center rounded-md border border-border/70 bg-background px-3 text-xs font-medium text-foreground transition hover:bg-muted/20"
              >
                New message
              </Link>
            </div>
            <div className="app-data-table-scroll thin-scrollbar h-full min-h-0 [--app-data-table-max-h:100%] p-1.5 sm:p-0">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className={dataTableStickyTh("uppercase tracking-wide text-[11px]", "comfortable")}>Recipient</th>
                    <th className={dataTableStickyTh("uppercase tracking-wide text-[11px]", "comfortable")}>Message</th>
                    <th className={dataTableStickyTh("whitespace-nowrap uppercase tracking-wide text-[11px]", "comfortable")}>Priority</th>
                    <th className={dataTableStickyTh("whitespace-nowrap uppercase tracking-wide text-[11px]", "comfortable")}>Sent by</th>
                    <th className={dataTableStickyTh("whitespace-nowrap uppercase tracking-wide text-[11px]", "comfortable")}>Timestamp</th>
                    <th className={dataTableStickyTh("whitespace-nowrap uppercase tracking-wide text-[11px]", "comfortable")}>Status</th>
                    <th className={dataTableStickyTh("whitespace-nowrap uppercase tracking-wide text-[11px] text-right", "comfortable")}>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecent.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-14 text-center text-sm text-muted-foreground sm:px-6">
                        No messages match the current filters.
                      </td>
                    </tr>
                  ) : null}
                  {historyPageRows.map((row, i) => {
                      const preview = (row.msg ?? "").trim();
                      const short = preview.length > 96 ? `${preview.slice(0, 93)}…` : preview;
                      const delivered = row.need_confirm === 0;
                      return (
                        <tr
                          key={`${row.uid}-${row.addtime}-${i}`}
                          className="border-b border-border/45 transition-colors duration-150 hover:bg-muted/18 even:bg-muted/[0.03]"
                        >
                          <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-foreground">{row.login ?? `uid:${row.uid}`}</td>
                          <td className="max-w-[280px] px-4 py-2.5 text-foreground" title={preview || undefined}>
                            <span className="line-clamp-2">{short || "—"}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={cn("inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold", priorityPillClass(row.priority))}>
                              {priorityLabel(row.priority)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{sentByLabel}</td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">{row.addtime ?? "—"}</td>
                          <td className="px-4 py-2.5">
                            <span
                              className={cn(
                                "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors duration-150",
                                delivered
                                  ? "border-teal-500/30 bg-teal-500/[0.12] text-teal-200"
                                  : "border-amber-500/30 bg-amber-500/[0.1] text-amber-100",
                              )}
                            >
                              {delivered ? "Delivered" : "Queued"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => setDetailRow(row)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/70 bg-background text-foreground transition hover:bg-muted/25"
                              aria-label="View detail"
                              title="View detail"
                            >
                              <Eye className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            {filteredRecent.length > 0 ? (
              <div className="flex flex-wrap items-center justify-end gap-1 border-t border-border/60 bg-muted/[0.04] px-2 py-2 sm:px-2.5">
                <button
                  type="button"
                  onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  disabled={historyPageSafe <= 1}
                  className="h-8 rounded-md border border-border/70 bg-background px-2 text-xs text-muted-foreground transition hover:bg-muted/20 hover:text-foreground disabled:opacity-50"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={historyPageSafe}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d]/g, "");
                    if (!raw) return;
                    const n = Number(raw);
                    if (!Number.isFinite(n)) return;
                    setHistoryPage(Math.max(1, Math.min(historyTotalPages, Math.floor(n))));
                  }}
                  className="h-8 w-16 rounded-md border border-border/70 bg-background px-2 text-center text-xs text-foreground outline-none focus-visible:border-cyan-500/45 focus-visible:ring-2 focus-visible:ring-cyan-500/25"
                  aria-label="Page number"
                />
                <span className="px-1 text-xs text-muted-foreground">/ {historyTotalPages}</span>
                <button
                  type="button"
                  onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                  disabled={historyPageSafe >= historyTotalPages}
                  className="h-8 rounded-md border border-border/70 bg-background px-2 text-xs text-muted-foreground transition hover:bg-muted/20 hover:text-foreground disabled:opacity-50"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
      {detailRow ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="message-detail-title"
          onClick={() => setDetailRow(null)}
        >
          <div
            className="w-full max-w-2xl rounded-xl border border-border/70 bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
              <h3 id="message-detail-title" className="text-base font-semibold text-foreground">
                Message detail
              </h3>
              <button
                type="button"
                onClick={() => setDetailRow(null)}
                className="h-8 rounded-md border border-border/70 px-2 text-xs text-muted-foreground transition hover:bg-muted/25 hover:text-foreground"
              >
                Close
              </button>
            </div>
            <div className="space-y-3 px-4 py-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border border-border/60 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                  UID: <span className="font-mono text-foreground">{detailRow.uid}</span>
                </div>
                <div className="rounded-md border border-border/60 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                  Recipient login: <span className="font-mono text-foreground">{detailRow.login ?? "—"}</span>
                </div>
                <div className="rounded-md border border-border/60 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                  Timestamp: <span className="text-foreground">{detailRow.addtime ?? "—"}</span>
                </div>
                <div className="rounded-md border border-border/60 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                  <span className="mr-1">Priority:</span>
                  <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold", priorityPillClass(detailRow.priority))}>
                    {priorityLabel(detailRow.priority)}
                  </span>
                </div>
                <div className="rounded-md border border-border/60 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                  <span className="mr-1">Status:</span>
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                      detailRow.need_confirm === 0
                        ? "border-teal-500/30 bg-teal-500/[0.12] text-teal-200"
                        : "border-amber-500/30 bg-amber-500/[0.1] text-amber-100",
                    )}
                  >
                    {detailRow.need_confirm === 0 ? "Delivered" : "Queued / pending"}
                  </span>
                </div>
                <div className="rounded-md border border-border/60 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                  Sent by: <span className="text-foreground">{sentByLabel}</span>
                </div>
              </div>
              <div className="rounded-md border border-border/60 bg-muted/10 px-3 py-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Message</p>
                <p className="whitespace-pre-wrap break-words text-sm text-foreground">{detailRow.msg?.trim() || "—"}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

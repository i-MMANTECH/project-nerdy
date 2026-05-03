"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import { useLayoutEffect, useMemo, useState, type FormEvent } from "react";
import { Info, MessageSquare, ScanSearch, Search, Send, UsersRound } from "lucide-react";
import { sendOperatorPortalMessageAction } from "@/actions/forms";
import type {
  AdminMessageAudiencePreviewCounts,
  AdminRecentStalkerSendMessageRow,
  AdminStalkerMessageDashboardStats,
  StalkerMessageUserOption,
} from "@/lib/repos/billing";
import type { PortalBase } from "@/lib/portal-nav";
import { Alert } from "@/components/ui/alert";
import { Button, buttonOutlineLinkClassName } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardKpiCard } from "@/components/dashboard/DashboardKpiCard";
import { FormSelect } from "@/components/forms/form-select";
import {
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { dataTableStickyTh } from "@/lib/ui/dataTableSticky";

const LARGE_SEND_CONFIRM_THRESHOLD = 500;
const MAX_MESSAGE_LEN = 500;

type MessageAudience = "all" | "custom";

const fieldLabelClass = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

const selectClassName = cn(
  "h-11 w-full min-w-0 rounded-lg border border-border/80 bg-muted/20 text-base text-foreground md:h-9",
  "focus-visible:border-cyan-500/50 focus-visible:ring-[3px] focus-visible:ring-cyan-500/25",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

const PORTAL_PRIORITY_OPTIONS = [
  { value: "1", label: "High" },
  { value: "2", label: "Normal" },
  { value: "3", label: "Low" },
] as const;

const textareaClass = cn(
  "flex min-h-[220px] w-full min-w-0 rounded-lg border border-border/80 bg-muted/20 px-3 py-3 text-base text-foreground outline-none transition-[color,box-shadow,border-color] duration-200 ease-out",
  "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground",
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  "md:text-sm",
  "focus-visible:border-cyan-500/50 focus-visible:ring-[3px] focus-visible:ring-cyan-500/25",
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
  if (v <= 1) return "border-rose-500/40 bg-rose-500/15 text-rose-200";
  if (v >= 3) return "border-slate-500/40 bg-slate-500/12 text-slate-200";
  return "border-border bg-muted/40 text-muted-foreground";
}

function FormActions({ onReset, portalBase }: { onReset: () => void; portalBase: PortalBase }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-col gap-3 border-t border-border/60 pt-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-start sm:gap-3">
      <Link
        href={portalBase}
        className={buttonOutlineLinkClassName(
          "inline-flex min-h-11 w-full items-center justify-center px-4 sm:w-auto sm:min-h-10 border-border/80 bg-muted/15 hover:bg-muted/30",
        )}
      >
        Cancel
      </Link>
      <Button type="button" variant="outline" onClick={onReset} disabled={pending} className="w-full min-h-11 sm:w-auto sm:min-h-10">
        Reset form
      </Button>
      <Button
        type="submit"
        disabled={pending}
        size="lg"
        className="w-full min-h-11 border-0 bg-chart-2 text-white shadow-md hover:bg-cyan-700 sm:w-auto sm:min-h-10"
      >
        <Send className="h-4 w-4" aria-hidden />
        {pending ? "Sending…" : "Send message"}
      </Button>
    </div>
  );
}

function mainTabPillClass(active: boolean) {
  return cn(
    "rounded-full px-3.5 py-1.5 text-sm font-medium transition-[color,background-color,box-shadow,border-color] duration-200 ease-out",
    active
      ? "bg-chart-2 text-white shadow-sm ring-1 ring-cyan-400/35"
      : "border border-input bg-card text-foreground hover:bg-muted/50",
  );
}

export function PortalMessagesScreen({
  stalkerUsers,
  audiencePreview,
  stats,
  recent,
  sentByLabel,
  portalBase,
}: {
  stalkerUsers: StalkerMessageUserOption[];
  audiencePreview: AdminMessageAudiencePreviewCounts;
  stats: AdminStalkerMessageDashboardStats;
  recent: AdminRecentStalkerSendMessageRow[];
  sentByLabel: string;
  portalBase: PortalBase;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mainTab: "compose" | "history" = searchParams.get("tab") === "history" ? "history" : "compose";

  function goTab(next: "compose" | "history") {
    const p = new URLSearchParams(searchParams.toString());
    if (next === "compose") p.delete("tab");
    else p.set("tab", "history");
    const q = p.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }

  const [audience, setAudience] = useState<MessageAudience>("all");
  const [priority, setPriority] = useState("2");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [messageBody, setMessageBody] = useState("");

  /**
   * Deep link from subscribers: `?account=LOGIN` or `?accounts=a&accounts=b` (billing logins) →
   * custom audience + Stalker rows pre-selected (same matching rules as Lookup).
   */
  useLayoutEffect(() => {
    const fromBulk = searchParams.getAll("accounts").flatMap((s) => s.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean));
    const single = (searchParams.get("account") ?? "").trim();
    const tokens = [...new Set([...fromBulk, ...(single ? [single] : [])])];
    if (!tokens.length) return;

    const nextSelected = new Set<string>();
    for (const raw of tokens) {
      const idKey = raw.replace(/^#/i, "");
      const hit = stalkerUsers.find(
        (u) => u.login.trim().toLowerCase() === raw.toLowerCase() || String(u.id) === idKey || String(u.id) === raw,
      );
      const lo = hit?.login.trim();
      if (lo) nextSelected.add(lo);
    }
    setAudience("custom");
    setSelected(nextSelected);
    if (nextSelected.size === 1) {
      setSearch([...nextSelected][0] ?? "");
    } else if (nextSelected.size > 1) {
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
    return audiencePreview.all;
  }, [audience, selectedCount, audiencePreview]);

  const deliveryRateDisplay =
    stats.deliveryPct != null ? `${stats.deliveryPct}%` : stats.recipients30d === 0 ? "—" : "Pending";

  function toggle(login: string) {
    const key = login.trim();
    if (!key) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function addVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const u of filtered) {
        const lo = u.login.trim();
        if (lo) next.add(lo);
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
    const lo = hit.login.trim();
    if (!lo) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(lo)) return next;
      next.add(lo);
      return next;
    });
  }

  function confirmLargeSend(e: FormEvent<HTMLFormElement>) {
    if (recipientPreviewCount <= LARGE_SEND_CONFIRM_THRESHOLD) return;
    const ok = window.confirm(`This send targets ${formatInt(recipientPreviewCount)} recipients. Continue?`);
    if (!ok) e.preventDefault();
  }

  function resetForm() {
    setAudience("all");
    setPriority("2");
    setSearch("");
    clearSelection();
    setMessageBody("");
  }

  const recipientSummaryReadOnly = useMemo(() => {
    if (audience === "all") {
      return `All users under your access (${formatInt(audiencePreview.all)} STB rows with billing login)`;
    }
    return "";
  }, [audience, audiencePreview.all]);

  return (
    <div className="space-y-6">
      <div className="mx-auto grid max-w-6xl gap-3 sm:grid-cols-3">
        <DashboardKpiCard
          title="Messages sent today"
          value={formatInt(stats.sendsToday)}
          icon={MessageSquare}
          tone="cyan"
          trend="Scoped hierarchy (event rows)"
        />
        <DashboardKpiCard
          title="Total recipients"
          value={formatInt(stats.recipients30d)}
          icon={UsersRound}
          tone="emerald"
          trend="STB rows queued (30 days)"
        />
        <DashboardKpiCard
          title="Delivery rate"
          value={deliveryRateDisplay}
          icon={Send}
          tone="violet"
          trend={stats.deliveryPending ? "Some awaiting device ack" : stats.recipients30d ? "need_confirm cleared" : "No traffic yet"}
        />
      </div>

      <div className="mx-auto max-w-6xl min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-md ring-1 ring-black/[0.06] dark:bg-[hsl(222_47%_8%/0.92)] dark:ring-white/[0.08]">
        <div className="flex flex-wrap gap-2 border-b border-border/60 bg-muted/10 px-4 py-3 sm:px-5">
          <button type="button" onClick={() => goTab("compose")} className={mainTabPillClass(mainTab === "compose")}>
            Compose message
          </button>
          <button type="button" onClick={() => goTab("history")} className={mainTabPillClass(mainTab === "history")}>
            Recent messages
          </button>
        </div>
        {mainTab === "compose" ? (
          <form action={sendOperatorPortalMessageAction} onSubmit={confirmLargeSend} className="block">
            <input type="hidden" name="type" value={audience === "all" ? "All" : "Custom"} />
            <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_min(100%,320px)] lg:p-7">
              <div className="relative min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-md ring-1 ring-black/[0.06] dark:bg-[hsl(222_47%_8%/0.92)] dark:ring-white/[0.08]">
                <div
                  className="pointer-events-none absolute inset-0 opacity-[0.22] dark:opacity-100"
                  style={{
                    background:
                      "radial-gradient(720px 160px at 0% -20%, rgba(6, 182, 212, 0.14), transparent 55%), radial-gradient(520px 120px at 100% 0%, rgba(139, 92, 246, 0.06), transparent 50%)",
                  }}
                  aria-hidden
                />
                <div className="relative border-b border-border/60 bg-muted/5 px-5 py-4 sm:px-7">
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">New device message</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Queue a Stalker <span className="font-mono text-foreground/90">send_msg</span> event for STB devices in your hierarchy.
                  </p>
                </div>

                <div className="relative space-y-6 p-5 sm:p-7">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2 sm:col-span-1">
                      <label htmlFor="portal-msg-audience" className={fieldLabelClass}>
                        Message type
                      </label>
                      <SelectRoot value={audience} onValueChange={(v) => setAudience(v as MessageAudience)}>
                        <SelectTrigger id="portal-msg-audience" className={selectClassName}>
                          <SelectValue placeholder="Message type" />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          <SelectItem value="all">All users (your hierarchy)</SelectItem>
                          <SelectItem value="custom">Select customers</SelectItem>
                        </SelectContent>
                      </SelectRoot>
                    </div>
                    <div className="space-y-2 sm:col-span-1">
                      <label htmlFor="portal-msg-priority" className={fieldLabelClass}>
                        Priority
                      </label>
                      <FormSelect
                        id="portal-msg-priority"
                        name="priority"
                        value={priority}
                        onValueChange={setPriority}
                        options={[...PORTAL_PRIORITY_OPTIONS]}
                        className={selectClassName}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-1">
                      <label htmlFor="portal-est-reach" className={fieldLabelClass}>
                        Est. reach
                      </label>
                      <Input
                        id="portal-est-reach"
                        readOnly
                        value={formatInt(recipientPreviewCount)}
                        className="h-11 border-border/80 bg-muted/20 font-mono tabular-nums md:h-9"
                        title="Recipients for this send (broadcast uses every mapped STB under your access)."
                      />
                    </div>
                  </div>

                  {audience !== "custom" ? (
                    <div className="space-y-2">
                      <label htmlFor="portal-msg-recipient-summary" className={fieldLabelClass}>
                        Audience summary
                      </label>
                      <Input
                        id="portal-msg-recipient-summary"
                        readOnly
                        value={recipientSummaryReadOnly}
                        className="h-11 border-border/80 bg-muted/20 md:h-9"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className={fieldLabelClass}>Selection</span>
                        <span className="rounded-md border border-border/70 bg-muted/20 px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                          {formatInt(selectedCount)}
                        </span>
                      </div>
                      <p className="rounded-lg border border-dashed border-border/70 bg-muted/10 px-3 py-2 text-sm text-muted-foreground">
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
                    <div className="space-y-4 rounded-xl border border-border/70 bg-muted/[0.1] p-4 sm:p-5 dark:bg-muted/10">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-semibold text-foreground">Select customers</p>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={addVisible} disabled={!stalkerUsers.length}>
                            Add all in view
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={clearSelection} disabled={!selectedCount}>
                            Clear selection
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
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
                            placeholder="Login or Stalker user ID…"
                            className="h-11 border-border/80 bg-muted/20 pl-9 md:h-9"
                            autoComplete="off"
                            aria-label="Search customers to add"
                          />
                        </div>
                        <Button type="button" variant="secondary" className="h-11 shrink-0 gap-2 sm:min-w-[120px] md:h-9" onClick={lookupCustomer}>
                          <ScanSearch className="h-4 w-4" aria-hidden />
                          Lookup
                        </Button>
                      </div>
                      {!stalkerUsers.length ? (
                        <Alert>
                          No Stalker users matched your user accounts — check <span className="font-mono">STALKER_DATABASE_*</span> and
                          billing <span className="font-mono">accounts.account</span> = Stalker <span className="font-mono">login</span>.
                        </Alert>
                      ) : (
                        <div
                          className="thin-scrollbar max-h-[min(280px,38vh)] overflow-y-auto overflow-x-hidden rounded-lg border border-border/60 bg-card/90 shadow-inner"
                          style={{ scrollbarGutter: "stable" }}
                        >
                          {filtered.length === 0 ? (
                            <p className="px-4 py-8 text-center text-sm text-muted-foreground">No matches for this filter.</p>
                          ) : (
                            <ul className="divide-y divide-border/40 p-1">
                              {filtered.map((u) => {
                                const lo = u.login.trim();
                                const checked = lo ? selected.has(lo) : false;
                                return (
                                  <li key={u.id}>
                                    <label
                                      className={cn(
                                        "flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2.5 transition-colors hover:bg-muted/45",
                                        checked && "bg-cyan-500/[0.08]",
                                      )}
                                    >
                                      <input
                                        type="checkbox"
                                        className="h-4 w-4 shrink-0 rounded border-border/80 text-cyan-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 dark:text-cyan-400"
                                        checked={checked}
                                        onChange={() => lo && toggle(lo)}
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
                      {[...selected].map((login) => (
                        <input key={login} type="hidden" name="users" value={login} />
                      ))}
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label htmlFor="portal-msg-body" className={fieldLabelClass}>
                        Message
                      </label>
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {messageBody.length} / {MAX_MESSAGE_LEN}
                      </span>
                    </div>
                    <textarea
                      id="portal-msg-body"
                      name="message"
                      rows={9}
                      maxLength={MAX_MESSAGE_LEN}
                      value={messageBody}
                      onChange={(e) => setMessageBody(e.target.value)}
                      placeholder="Write the text users will see on the device…"
                      className={textareaClass}
                      required
                    />
                  </div>

                  <FormActions onReset={resetForm} portalBase={portalBase} />

                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground">All users</span> targets every Stalker user whose login matches a billing
                    account under your access (same as PHP portal broadcast). Large sends require confirmation before queueing.
                  </p>
                </div>
              </div>

              <div className="relative flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/95 p-5 shadow-md ring-1 ring-black/[0.06] dark:bg-[hsl(222_47%_8%/0.88)] dark:ring-white/[0.08] sm:p-6">
                <div
                  className="pointer-events-none absolute inset-0 opacity-[0.25] dark:opacity-100"
                  style={{
                    background: "radial-gradient(400px 120px at 50% 0%, rgba(14, 165, 233, 0.1), transparent 60%)",
                  }}
                  aria-hidden
                />
                <div className="relative">
                  <h2 className="text-base font-semibold tracking-tight text-foreground">Delivery preview</h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">What will be applied when you send from this form.</p>
                  <dl className="mt-5 space-y-5 text-sm">
                    <div>
                      <dt className={fieldLabelClass}>Recipient count</dt>
                      <dd className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-foreground">{formatInt(recipientPreviewCount)}</dd>
                    </div>
                    <div>
                      <dt className={fieldLabelClass}>Priority</dt>
                      <dd className="mt-2">
                        <span className={cn("inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold", priorityPillClass(Number(priority)))}>
                          {priorityLabel(Number(priority))}
                        </span>
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-6 flex gap-2 rounded-lg border border-cyan-500/25 bg-cyan-500/[0.06] px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400/90" aria-hidden />
                    <span>STBs pick up messages on their next poll. Keep copy short and under {MAX_MESSAGE_LEN} characters.</span>
                  </div>
                </div>
              </div>
            </div>
          </form>
        ) : (
          <div className="min-w-0">
            <div className="border-b border-border/60 bg-muted/5 px-5 py-4 sm:px-7">
              <h2 className="text-base font-semibold tracking-tight text-foreground">Recent messages</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Latest <span className="font-mono text-foreground/90">send_msg</span> rows for your users (newest first).
              </p>
            </div>
            <div className="app-data-table-scroll thin-scrollbar p-2 pb-6 sm:p-0">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className={dataTableStickyTh(undefined, "comfortable")}>Recipient</th>
                    <th className={dataTableStickyTh(undefined, "comfortable")}>Message</th>
                    <th className={dataTableStickyTh("whitespace-nowrap", "comfortable")}>Priority</th>
                    <th className={dataTableStickyTh("whitespace-nowrap", "comfortable")}>Sent by</th>
                    <th className={dataTableStickyTh("whitespace-nowrap", "comfortable")}>Timestamp</th>
                    <th className={dataTableStickyTh("whitespace-nowrap", "comfortable")}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-14 text-center text-sm text-muted-foreground sm:px-6">
                        No messages in this list.
                      </td>
                    </tr>
                  ) : null}
                  {recent.map((row, i) => {
                      const preview = (row.msg ?? "").trim();
                      const short = preview.length > 96 ? `${preview.slice(0, 93)}…` : preview;
                      const delivered = row.need_confirm === 0;
                      return (
                        <tr key={`${row.uid}-${row.addtime}-${i}`} className="border-b border-border/50 transition-colors hover:bg-muted/25">
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
                                "inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                                delivered ? "border-teal-500/40 bg-teal-500/15 text-teal-200" : "border-amber-500/35 bg-amber-500/12 text-amber-100",
                              )}
                            >
                              {delivered ? "Delivered" : "Queued"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquareText, MoreVertical, RotateCcw, Settings2, Ticket, Trash2, X } from "lucide-react";
import { dataTableStickyTh } from "@/lib/ui/dataTableSticky";
import { cn } from "@/lib/cn";
import type { ItvChannelRow, TicketDashboardTableRow, TvGenreRow } from "@/lib/repos/tickets";
import { FormSelect, type FormSelectOption } from "@/components/forms/form-select";
import { SearchableFormSelect } from "@/components/forms/SearchableFormSelect";

type ColumnKey =
  | "id"
  | "subject"
  | "category"
  | "channel"
  | "createdBy"
  | "assignedAgent"
  | "priority"
  | "status"
  | "content"
  | "comments"
  | "created"
  | "updated"
  | "actions";

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "id", label: "ID" },
  { key: "subject", label: "Subject" },
  { key: "category", label: "Category" },
  { key: "channel", label: "Channel" },
  { key: "createdBy", label: "Created by" },
  { key: "assignedAgent", label: "Assigned agent" },
  { key: "priority", label: "Priority" },
  { key: "status", label: "Status" },
  { key: "content", label: "Content" },
  { key: "comments", label: "Comments" },
  { key: "created", label: "Created" },
  { key: "updated", label: "Updated" },
  { key: "actions", label: "Actions" },
];

const STATUS_OPTIONS: FormSelectOption[] = [
  { value: "", label: "Status: Any" },
  { value: "1", label: "In progress" },
  { value: "2", label: "Fixed" },
  { value: "3", label: "Re-opened" },
];

const PRIORITY_OPTIONS: FormSelectOption[] = [
  { value: "", label: "Priority: Any" },
  { value: "1", label: "High" },
  { value: "2", label: "Normal" },
  { value: "3", label: "Low" },
];

type Props = {
  rows: TicketDashboardTableRow[];
  portalBase: "/manager" | "/dealer" | "/admin";
  genres: TvGenreRow[];
  initialSearch?: string;
  initialStatusFilter?: string;
  initialPriorityFilter?: string;
  sortFilter: string;
  headerSortHrefs: {
    id: string;
    subject: string;
    category: string;
    priority: string;
    status: string;
    comments: string;
    created: string;
    updated: string;
  };
};

export function PortalTicketsTableClient({
  rows,
  portalBase,
  genres,
  initialSearch = "",
  initialStatusFilter = "",
  initialPriorityFilter = "",
  sortFilter,
  headerSortHrefs,
}: Props) {
  type CreateFieldErrors = Partial<
    Record<"category" | "channel" | "subject" | "priority" | "channelNumber" | "description", string>
  >;
  const router = useRouter();
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(() => new Set(COLUMNS.map((c) => c.key)));
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [priorityFilter, setPriorityFilter] = useState(initialPriorityFilter);
  const [commentsModalTicket, setCommentsModalTicket] = useState<TicketDashboardTableRow | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState("");
  const [commentsRows, setCommentsRows] = useState<Array<{ id: number; html: string; author: string; updated_at: number }>>([]);
  const [replyText, setReplyText] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyError, setReplyError] = useState("");
  const [statusModalTicket, setStatusModalTicket] = useState<TicketDashboardTableRow | null>(null);
  const [priorityModalTicket, setPriorityModalTicket] = useState<TicketDashboardTableRow | null>(null);
  const [statusDraft, setStatusDraft] = useState("1");
  const [priorityDraft, setPriorityDraft] = useState("2");
  const [deleteModalTicket, setDeleteModalTicket] = useState<TicketDashboardTableRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSubject, setCreateSubject] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createPriority, setCreatePriority] = useState("2");
  const [createCategoryId, setCreateCategoryId] = useState(String(genres[0]?.id ?? ""));
  const [createChannelId, setCreateChannelId] = useState("");
  const [createChannelNumber, setCreateChannelNumber] = useState("");
  const [createChannels, setCreateChannels] = useState<ItvChannelRow[]>([]);
  const [createChannelLoadError, setCreateChannelLoadError] = useState("");
  const [createFieldErrors, setCreateFieldErrors] = useState<CreateFieldErrors>({});
  const [createFlags, setCreateFlags] = useState({
    no_audio: false,
    no_video: false,
    stream_error: false,
    no_epg: false,
    catch_up_needed: false,
    epg_needed: false,
    file_missing: false,
    wrong_channel_name: false,
  });
  const [openActionMenu, setOpenActionMenu] = useState<{
    ticketId: number;
    top: number;
    left: number;
    placement: "up" | "down";
  } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const columnsMenuRef = useRef<HTMLDivElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  const hasColumn = (key: ColumnKey) => visibleColumns.has(key);

  const displayedCount = visibleColumns.size;
  const allSelected = displayedCount === COLUMNS.length;

  useEffect(() => {
    if (!columnsOpen) return;
    const onPointerDown = (ev: PointerEvent) => {
      const target = ev.target as Node | null;
      if (!target) return;
      if (columnsMenuRef.current?.contains(target)) return;
      setColumnsOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [columnsOpen]);

  useEffect(() => {
    if (openActionMenu == null) return;
    const onPointerDown = (ev: PointerEvent) => {
      const target = ev.target as Node | null;
      if (!target) return;
      if (actionMenuRef.current?.contains(target)) return;
      setOpenActionMenu(null);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [openActionMenu]);

  useEffect(() => {
    setSearch(initialSearch);
    setStatusFilter(initialStatusFilter);
    setPriorityFilter(initialPriorityFilter);
  }, [initialSearch, initialStatusFilter, initialPriorityFilter]);

  useEffect(() => {
    const categoryId = Number(createCategoryId);
    if (!Number.isFinite(categoryId) || categoryId <= 0) {
      setCreateChannels([]);
      setCreateChannelId("");
      setCreateChannelLoadError("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setCreateChannelLoadError("");
        const res = await fetch(`/api/admin/tickets/channels?id=${categoryId}`, { credentials: "same-origin" });
        if (!res.ok) throw new Error("load_channels_failed");
        const data = (await res.json()) as ItvChannelRow[];
        if (cancelled) return;
        const deduped: ItvChannelRow[] = [];
        const seen = new Set<number>();
        for (const ch of data) {
          const id = Number(ch.id ?? 0);
          if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
          seen.add(id);
          deduped.push({
            id,
            name: String(ch.name ?? ""),
            number: Number(ch.number ?? 0),
            tv_genre_id: Number(ch.tv_genre_id ?? 0),
          });
        }
        setCreateChannels(deduped);
        if (!deduped.length) {
          setCreateChannelId("");
          return;
        }
        const selected = deduped.find((c) => String(c.id) === createChannelId) ?? deduped[0];
        setCreateChannelId(String(selected.id));
        setCreateChannelNumber(String(selected.number ?? ""));
        if (!createSubject.trim()) setCreateSubject(String(selected.name ?? ""));
      } catch {
        if (cancelled) return;
        setCreateChannels([]);
        setCreateChannelId("");
        setCreateChannelLoadError("Channels unavailable for this category.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [createCategoryId]);

  const onCreateTicket = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (createBusy) return;
    setCreateError("");
    const payload = {
      subject: createSubject.trim(),
      description: createDescription,
      priority: Number(createPriority),
      category_id: Number(createCategoryId),
      channel_id: Number(createChannelId),
      channel_number: Number(createChannelNumber),
      flags: createFlags,
    };
    const nextErrors: CreateFieldErrors = {};
    if (!Number.isFinite(payload.category_id) || payload.category_id <= 0) nextErrors.category = "Please select category.";
    if (!Number.isFinite(payload.channel_id) || payload.channel_id <= 0) nextErrors.channel = "Please select channel.";
    if (!payload.subject || payload.subject.length < 3) nextErrors.subject = "Subject must be at least 3 characters.";
    if (!Number.isFinite(payload.priority) || payload.priority < 1 || payload.priority > 3) nextErrors.priority = "Please select priority.";
    if (!Number.isFinite(payload.channel_number) || payload.channel_number <= 0) {
      nextErrors.channelNumber = "Channel number must be a positive number.";
    }
    if (!payload.description.trim()) nextErrors.description = "Description is required.";
    setCreateFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setCreateError("Please fix the highlighted fields.");
      return;
    }
    setCreateBusy(true);
    try {
      const res = await fetch("/api/tickets/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
      if (!res.ok) {
        const reason = data.detail || data.error || `HTTP ${res.status}`;
        setCreateError(`Create failed: ${reason}`);
        return;
      }
      setCreateOpen(false);
      setCreateDescription("");
      setCreateFlags({
        no_audio: false,
        no_video: false,
        stream_error: false,
        no_epg: false,
        catch_up_needed: false,
        epg_needed: false,
        file_missing: false,
        wrong_channel_name: false,
      });
      router.refresh();
    } catch {
      setCreateError("Create failed. Please try again.");
    } finally {
      setCreateBusy(false);
    }
  };

  const sortArrow = (ascKey: string, descKey: string) => {
    if (sortFilter === ascKey) return " ↑";
    if (sortFilter === descKey) return " ↓";
    return "";
  };

  const formatTs = (value: number) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return "—";
    return new Date(n * 1000).toLocaleString(undefined, {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  const toPlain = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const shorten = (text: string, max = 120) => (text.length > max ? `${text.slice(0, max)}…` : text);

  const priorityLabel = (v: number) => (v === 1 ? "High" : v === 2 ? "Normal" : v === 3 ? "Low" : String(v));
  const statusLabel = (v: number) => (v === 1 ? "In progress" : v === 2 ? "Fixed" : v === 3 ? "Re-opened" : String(v));
  const statusBadgeClass = (statusId: number) =>
    statusId === 1
      ? "border-cyan-400/40 bg-cyan-500/12 text-cyan-300"
      : statusId === 2
        ? "border-emerald-400/40 bg-emerald-500/12 text-emerald-300"
        : statusId === 3
          ? "border-amber-400/40 bg-amber-500/12 text-amber-300"
          : "border-border/70 bg-muted/30 text-muted-foreground";
  const priorityBadgeClass = (priorityId: number) =>
    priorityId === 1
      ? "border-amber-400/40 bg-amber-500/12 text-amber-300"
      : priorityId === 2
        ? "border-cyan-400/40 bg-cyan-500/12 text-cyan-300"
        : priorityId === 3
          ? "border-emerald-400/40 bg-emerald-500/12 text-emerald-300"
          : "border-border/70 bg-muted/30 text-muted-foreground";

  const colSpan = useMemo(() => Math.max(1, visibleColumns.size), [visibleColumns]);
  const filterControlClass =
    "h-8 rounded-lg border border-border/70 bg-muted/20 px-2.5 text-xs text-foreground outline-none transition-[border-color,box-shadow,background-color] duration-200 ease-out hover:bg-muted/30 focus-visible:border-cyan-500/45 focus-visible:ring-2 focus-visible:ring-cyan-500/30";
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = rows.filter((r) => {
      if (statusFilter && String(r.status_id) !== statusFilter) return false;
      if (priorityFilter && String(r.priority_id) !== priorityFilter) return false;
      if (q) {
        const haystack =
          `${r.id} ${r.subject} ${r.categoryTitle} ${r.channelName} ${r.creatorUsername} ${r.agentUsername} ${r.content}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    return matched;
  }, [rows, search, statusFilter, priorityFilter]);

  async function loadComments(ticketId: number) {
    const res = await fetch(`/api/tickets/${ticketId}/comments`, { credentials: "same-origin" });
    if (!res.ok) throw new Error("Failed to load comments");
    const data = (await res.json()) as { comments?: Array<{ id: number; html: string; author: string; updated_at: number }> };
    setCommentsRows(Array.isArray(data.comments) ? data.comments : []);
  }

  async function openCommentsModal(ticket: TicketDashboardTableRow, focusReply = false) {
    setCommentsModalTicket(ticket);
    setCommentsOpen(true);
    setCommentsError("");
    setReplyError("");
    if (focusReply) setReplyText("");
    setCommentsLoading(true);
    try {
      await loadComments(ticket.id);
    } catch {
      setCommentsRows([]);
      setCommentsError("Could not load comments for this ticket.");
    } finally {
      setCommentsLoading(false);
    }
  }

  async function submitReply() {
    if (!commentsModalTicket) return;
    const comment = replyText.trim();
    if (!comment) {
      setReplyError("Please write a reply.");
      return;
    }
    setReplyBusy(true);
    setReplyError("");
    try {
      const res = await fetch(`/api/tickets/${commentsModalTicket.id}/comments`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment }),
      });
      if (!res.ok) throw new Error("Failed to post reply");
      setReplyText("");
      await loadComments(commentsModalTicket.id);
    } catch {
      setReplyError("Could not send reply. Please try again.");
    } finally {
      setReplyBusy(false);
    }
  }

  async function submitTicketUpdate(ticketId: number, status: number, priority: number) {
    setActionBusy(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/manage`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", status, priority }),
      });
      if (!res.ok) throw new Error("update_failed");
      setStatusModalTicket(null);
      setPriorityModalTicket(null);
      router.refresh();
    } finally {
      setActionBusy(false);
    }
  }

  async function submitTicketDelete(ticketId: number) {
    setActionBusy(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/manage`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete" }),
      });
      if (!res.ok) throw new Error("delete_failed");
      setDeleteModalTicket(null);
      router.refresh();
    } finally {
      setActionBusy(false);
    }
  }

  function openStatusModal(ticket: TicketDashboardTableRow) {
    setStatusModalTicket(ticket);
    setStatusDraft(String(ticket.status_id || 1));
  }

  function openPriorityModal(ticket: TicketDashboardTableRow) {
    setPriorityModalTicket(ticket);
    setPriorityDraft(String(ticket.priority_id || 2));
  }

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ID, subject, channel, content..."
            className={cn("w-[min(100%,24rem)]", filterControlClass)}
          />
          <FormSelect
            name="ticket-status-filter"
            id="ticket-status-filter"
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={STATUS_OPTIONS}
            placeholder="Status: Any"
            className={cn("w-40", filterControlClass)}
            contentClassName="min-w-[12rem]"
          />
          <FormSelect
            name="ticket-priority-filter"
            id="ticket-priority-filter"
            value={priorityFilter}
            onValueChange={setPriorityFilter}
            options={PRIORITY_OPTIONS}
            placeholder="Priority: Any"
            className={cn("w-40", filterControlClass)}
            contentClassName="min-w-[12rem]"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setCreateError("");
              setCreateOpen(true);
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/70 px-2.5 text-xs font-medium text-muted-foreground transition hover:bg-muted/30 hover:text-foreground"
            aria-label="Create ticket"
            title="Create ticket"
          >
            <Ticket className="h-3.5 w-3.5" aria-hidden />
            <span>Create</span>
          </button>
        </div>
        <div ref={columnsMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setColumnsOpen((v) => !v)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:text-foreground"
            aria-label="Column settings"
            title="Column settings"
          >
            <Settings2 className="h-3.5 w-3.5" aria-hidden />
          </button>
          {columnsOpen ? (
            <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-border/70 bg-card p-2 shadow-xl">
              <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Visible columns</p>
              <label className="flex items-center gap-2 rounded px-2 py-1 text-xs text-foreground hover:bg-muted/40">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => {
                    if (e.target.checked) setVisibleColumns(new Set(COLUMNS.map((c) => c.key)));
                    else setVisibleColumns(new Set<ColumnKey>(["id", "subject", "status", "updated"]));
                  }}
                />
                All columns
              </label>
              {COLUMNS.map((col) => (
                <label key={col.key} className="flex items-center gap-2 rounded px-2 py-1 text-xs text-foreground hover:bg-muted/40">
                  <input
                    type="checkbox"
                    checked={visibleColumns.has(col.key)}
                    onChange={(e) => {
                      setVisibleColumns((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(col.key);
                        else next.delete(col.key);
                        if (next.size === 0) next.add("id");
                        return next;
                      });
                    }}
                  />
                  {col.label}
                </label>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className="app-data-table-scroll thin-scrollbar">
        <table className="w-full min-w-[1560px] border-collapse text-[13px]">
          <thead>
            <tr>
              {hasColumn("id") ? (
                <th className={dataTableStickyTh("p-2 whitespace-nowrap")}>
                  <Link href={headerSortHrefs.id} className="hover:text-foreground/90">
                    ID{sortArrow("id_asc", "id_desc")}
                  </Link>
                </th>
              ) : null}
              {hasColumn("subject") ? (
                <th className={dataTableStickyTh("p-2 whitespace-nowrap")}>
                  <Link href={headerSortHrefs.subject} className="hover:text-foreground/90">
                    Subject{sortArrow("subject_asc", "subject_desc")}
                  </Link>
                </th>
              ) : null}
              {hasColumn("category") ? (
                <th className={dataTableStickyTh("p-2 whitespace-nowrap")}>
                  <Link href={headerSortHrefs.category} className="hover:text-foreground/90">
                    Category{sortArrow("category_asc", "category_desc")}
                  </Link>
                </th>
              ) : null}
              {hasColumn("channel") ? <th className={dataTableStickyTh("p-2 whitespace-nowrap")}>Channel</th> : null}
              {hasColumn("createdBy") ? <th className={dataTableStickyTh("p-2 whitespace-nowrap")}>Created by</th> : null}
              {hasColumn("assignedAgent") ? <th className={dataTableStickyTh("p-2 whitespace-nowrap")}>Assigned agent</th> : null}
              {hasColumn("priority") ? (
                <th className={dataTableStickyTh("p-2 whitespace-nowrap")}>
                  <Link href={headerSortHrefs.priority} className="hover:text-foreground/90">
                    Priority{sortArrow("priority_asc", "priority_desc")}
                  </Link>
                </th>
              ) : null}
              {hasColumn("status") ? (
                <th className={dataTableStickyTh("p-2 whitespace-nowrap")}>
                  <Link href={headerSortHrefs.status} className="hover:text-foreground/90">
                    Status{sortArrow("status_asc", "status_desc")}
                  </Link>
                </th>
              ) : null}
              {hasColumn("content") ? <th className={dataTableStickyTh("p-2 whitespace-nowrap")}>Content</th> : null}
              {hasColumn("comments") ? (
                <th className={dataTableStickyTh("p-2 whitespace-nowrap")}>
                  <Link href={headerSortHrefs.comments} className="hover:text-foreground/90">
                    Comments{sortArrow("comments_asc", "comments_desc")}
                  </Link>
                </th>
              ) : null}
              {hasColumn("created") ? (
                <th className={dataTableStickyTh("p-2 whitespace-nowrap")}>
                  <Link href={headerSortHrefs.created} className="hover:text-foreground/90">
                    Created{sortArrow("created_asc", "created_desc")}
                  </Link>
                </th>
              ) : null}
              {hasColumn("updated") ? (
                <th className={dataTableStickyTh("p-2 whitespace-nowrap")}>
                  <Link href={headerSortHrefs.updated} className="hover:text-foreground/90">
                    Updated{sortArrow("updated_asc", "updated_desc")}
                  </Link>
                </th>
              ) : null}
              {hasColumn("actions") ? <th className={dataTableStickyTh("p-2 whitespace-nowrap text-right")}>Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No matching tickets.
                </td>
              </tr>
            ) : null}
            {filteredRows.map((r, idx) => (
              <tr key={`${String(r.id ?? idx)}`} className="border-b border-border/70 odd:bg-muted/10">
                {hasColumn("id") ? <td className="p-2 align-top whitespace-nowrap text-cyan-300">{r.id}</td> : null}
                {hasColumn("subject") ? (
                  <td className="max-w-[260px] truncate p-2 align-top text-foreground">{r.subject || "—"}</td>
                ) : null}
                {hasColumn("category") ? <td className="max-w-[260px] truncate p-2 align-top">{r.categoryTitle || "—"}</td> : null}
                {hasColumn("channel") ? <td className="max-w-[240px] truncate p-2 align-top">{r.channelName || "-"}</td> : null}
                {hasColumn("createdBy") ? <td className="p-2 align-top whitespace-nowrap">{r.creatorUsername || "—"}</td> : null}
                {hasColumn("assignedAgent") ? <td className="p-2 align-top whitespace-nowrap">{r.agentUsername || "—"}</td> : null}
                {hasColumn("priority") ? (
                  <td className="p-2 align-top whitespace-nowrap">
                    <span
                      className={cn(
                        "inline-flex h-5 items-center rounded-full border px-2 text-[11px] font-semibold leading-none",
                        priorityBadgeClass(r.priority_id),
                      )}
                    >
                      {priorityLabel(r.priority_id)}
                    </span>
                  </td>
                ) : null}
                {hasColumn("status") ? (
                  <td className="p-2 align-top whitespace-nowrap">
                    <span
                      className={cn(
                        "inline-flex h-5 items-center rounded-full border px-2 text-[11px] font-semibold leading-none",
                        statusBadgeClass(r.status_id),
                      )}
                    >
                      {statusLabel(r.status_id)}
                    </span>
                  </td>
                ) : null}
                {hasColumn("content") ? (
                  <td className="max-w-[320px] truncate p-2 align-top text-muted-foreground">{r.content || "—"}</td>
                ) : null}
                {hasColumn("comments") ? (
                  <td className="p-2 align-top whitespace-nowrap">
                    {r.commentCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => void openCommentsModal(r)}
                        title={r.latestComment ? `${r.latestCommentUser || "Unknown user"}: ${r.latestComment}` : "No comment preview"}
                        className="inline-flex h-5 items-center rounded-full border border-border/70 bg-muted/30 px-2 text-[11px] font-semibold leading-none text-foreground transition hover:bg-muted/50"
                      >
                        {r.commentCount}
                      </button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                ) : null}
                {hasColumn("created") ? (
                  <td className="p-2 align-top whitespace-nowrap text-muted-foreground">{formatTs(r.created_at)}</td>
                ) : null}
                {hasColumn("updated") ? (
                  <td className="p-2 align-top whitespace-nowrap text-muted-foreground">{formatTs(r.updated_at)}</td>
                ) : null}
                {hasColumn("actions") ? (
                  <td className="p-2 align-top">
                    <div className="relative flex justify-end">
                      <button
                        type="button"
                        onClick={(e) => {
                          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                          const menuWidth = 208;
                          const nextLeft = Math.max(8, rect.right - menuWidth);
                          const openUp = rect.top > 220;
                          setOpenActionMenu((prev) => {
                            if (prev?.ticketId === r.id) return null;
                            return {
                              ticketId: r.id,
                              left: nextLeft,
                              top: openUp ? rect.top - 8 : rect.bottom + 8,
                              placement: openUp ? "up" : "down",
                            };
                          });
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground transition hover:bg-muted/30 hover:text-foreground"
                        aria-label="Ticket actions"
                        title="Ticket actions"
                      >
                        <MoreVertical className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {createOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-ticket-modal-title"
          onClick={() => !createBusy && setCreateOpen(false)}
        >
          <div
            className="w-full max-w-3xl rounded-xl border border-border/70 bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
              <h2 id="create-ticket-modal-title" className="text-base font-semibold text-foreground">
                Create new ticket
              </h2>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 text-muted-foreground transition hover:bg-muted/30 hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={onCreateTicket} className="space-y-4 px-4 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Category</label>
                  <SearchableFormSelect
                    name="create-ticket-category"
                    id="create-ticket-category"
                    value={createCategoryId}
                    onValueChange={(v) => {
                      setCreateCategoryId(v);
                      setCreateFieldErrors((prev) => ({ ...prev, category: undefined }));
                    }}
                    options={genres.map((g) => ({ value: String(g.id), label: g.title }))}
                    placeholder="Select category"
                    searchPlaceholder="Search category..."
                    className="w-full"
                  />
                  {createFieldErrors.category ? <p className="text-xs text-destructive">{createFieldErrors.category}</p> : null}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Channel</label>
                  <SearchableFormSelect
                    name="create-ticket-channel"
                    id="create-ticket-channel"
                    value={createChannelId}
                    onValueChange={(v) => {
                      const next = createChannels.find((c) => String(c.id) === v);
                      setCreateChannelId(v);
                      setCreateFieldErrors((prev) => ({ ...prev, channel: undefined }));
                      if (next) {
                        setCreateChannelNumber(String(next.number ?? ""));
                        if (!createSubject.trim()) setCreateSubject(String(next.name ?? ""));
                      }
                    }}
                    options={
                      !createChannels.length
                        ? [{ value: "", label: "No channels" }]
                        : createChannels.map((c) => ({ value: String(c.id), label: c.name }))
                    }
                    placeholder="Select channel"
                    searchPlaceholder="Search channel..."
                    className="w-full"
                    disabled={!createChannels.length}
                  />
                  {createChannelLoadError ? <p className="text-xs text-destructive">{createChannelLoadError}</p> : null}
                  {createFieldErrors.channel ? <p className="text-xs text-destructive">{createFieldErrors.channel}</p> : null}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subject</label>
                  <input
                    value={createSubject}
                    onChange={(e) => {
                      setCreateSubject(e.target.value);
                      setCreateFieldErrors((prev) => ({ ...prev, subject: undefined }));
                    }}
                    className="h-9 w-full rounded-lg border border-border/70 bg-muted/20 px-2 text-sm text-foreground"
                    required
                  />
                  {createFieldErrors.subject ? <p className="text-xs text-destructive">{createFieldErrors.subject}</p> : null}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Priority</label>
                  <FormSelect
                    name="create-ticket-priority"
                    id="create-ticket-priority"
                    value={createPriority}
                    onValueChange={(v) => {
                      setCreatePriority(v);
                      setCreateFieldErrors((prev) => ({ ...prev, priority: undefined }));
                    }}
                    options={[
                      { value: "1", label: "High" },
                      { value: "2", label: "Normal" },
                      { value: "3", label: "Low" },
                    ]}
                    placeholder="Select priority"
                    className="h-9 text-sm"
                  />
                  {createFieldErrors.priority ? <p className="text-xs text-destructive">{createFieldErrors.priority}</p> : null}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Channel number</label>
                <input
                  value={createChannelNumber}
                  onChange={(e) => {
                    setCreateChannelNumber(e.target.value);
                    setCreateFieldErrors((prev) => ({ ...prev, channelNumber: undefined }));
                  }}
                  className="h-9 w-full rounded-lg border border-border/70 bg-muted/20 px-2 text-sm text-foreground"
                  required
                />
                {createFieldErrors.channelNumber ? <p className="text-xs text-destructive">{createFieldErrors.channelNumber}</p> : null}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</label>
                <textarea
                  value={createDescription}
                  onChange={(e) => {
                    setCreateDescription(e.target.value);
                    setCreateFieldErrors((prev) => ({ ...prev, description: undefined }));
                  }}
                  className="min-h-24 w-full rounded-lg border border-border/70 bg-muted/20 px-2 py-2 text-sm text-foreground"
                  placeholder="Describe the issue..."
                />
                {createFieldErrors.description ? <p className="text-xs text-destructive">{createFieldErrors.description}</p> : null}
              </div>
              <div className="grid gap-2 rounded-lg border border-border/70 bg-muted/10 p-3 sm:grid-cols-2">
                {(
                  [
                    ["no_audio", "No audio"],
                    ["no_video", "No video"],
                    ["stream_error", "Stream error"],
                    ["no_epg", "No EPG"],
                    ["catch_up_needed", "Catch up needed"],
                    ["epg_needed", "EPG needed"],
                    ["file_missing", "File missing"],
                    ["wrong_channel_name", "Wrong channel name"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={createFlags[key]}
                      onChange={(e) => setCreateFlags((prev) => ({ ...prev, [key]: e.target.checked }))}
                    />
                    {label}
                  </label>
                ))}
              </div>
              {createError ? <p className="text-sm text-destructive">{createError}</p> : null}
              <div className="flex items-center justify-end gap-2 border-t border-border/70 pt-3">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  disabled={createBusy}
                  className="h-9 rounded-lg border border-border/70 px-3 text-sm text-muted-foreground transition hover:bg-muted/30 hover:text-foreground disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createBusy}
                  className="h-9 rounded-lg bg-cyan-600 px-3 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:opacity-60"
                >
                  {createBusy ? "Creating..." : "Create ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {openActionMenu ? (
        <div
          ref={actionMenuRef}
          className={cn(
            "fixed z-40 w-52 overflow-hidden rounded-xl border border-border/70 bg-card shadow-xl",
            openActionMenu.placement === "up" ? "-translate-y-full" : "",
          )}
          style={{ top: openActionMenu.top, left: openActionMenu.left }}
        >
          {(() => {
            const active = rows.find((row) => row.id === openActionMenu.ticketId);
            if (!active) return null;
            return (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setOpenActionMenu(null);
                    void openCommentsModal(active, true);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground transition hover:bg-muted/40"
                >
                  <MessageSquareText className="h-4 w-4 opacity-80" aria-hidden />
                  Reply
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenActionMenu(null);
                    openStatusModal(active);
                  }}
                  className="flex w-full items-center gap-2 border-t border-border/60 px-3 py-2 text-left text-sm text-foreground transition hover:bg-muted/40"
                >
                  <RotateCcw className="h-4 w-4 opacity-80" aria-hidden />
                  Set status
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenActionMenu(null);
                    openPriorityModal(active);
                  }}
                  className="flex w-full items-center gap-2 border-t border-border/60 px-3 py-2 text-left text-sm text-foreground transition hover:bg-muted/40"
                >
                  <RotateCcw className="h-4 w-4 opacity-80" aria-hidden />
                  Set priority
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenActionMenu(null);
                    setDeleteModalTicket(active);
                  }}
                  className="flex w-full items-center gap-2 border-t border-border/60 px-3 py-2 text-left text-sm text-rose-400 transition hover:bg-rose-500/10"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Delete
                </button>
              </>
            );
          })()}
        </div>
      ) : null}
      {commentsOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ticket-comments-modal-title"
          onClick={() => setCommentsOpen(false)}
        >
          <div
            className="w-full max-w-4xl rounded-xl border border-border/70 bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
              <div>
                <h2 id="ticket-comments-modal-title" className="text-base font-semibold text-foreground">
                  Ticket #{commentsModalTicket?.id} details
                </h2>
                <p className="mt-1 max-w-[46rem] truncate text-sm text-foreground">{commentsModalTicket?.subject || "—"}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex h-5 items-center rounded-full border border-border/70 bg-muted/30 px-2 text-[11px] text-muted-foreground">
                    Channel: {commentsModalTicket?.channelName || "-"}
                  </span>
                  <span className="inline-flex h-5 items-center rounded-full border border-border/70 bg-muted/30 px-2 text-[11px] text-muted-foreground">
                    Created by: {commentsModalTicket?.creatorUsername || "—"}
                  </span>
                  <span className="inline-flex h-5 items-center rounded-full border border-border/70 bg-muted/30 px-2 text-[11px] text-muted-foreground">
                    Agent: {commentsModalTicket?.agentUsername || "—"}
                  </span>
                  <span className={cn("inline-flex h-5 items-center rounded-full border px-2 text-[11px] font-semibold", statusBadgeClass(commentsModalTicket?.status_id ?? 0))}>
                    {statusLabel(commentsModalTicket?.status_id ?? 0)}
                  </span>
                  <span className={cn("inline-flex h-5 items-center rounded-full border px-2 text-[11px] font-semibold", priorityBadgeClass(commentsModalTicket?.priority_id ?? 0))}>
                    {priorityLabel(commentsModalTicket?.priority_id ?? 0)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCommentsOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
                aria-label="Close comments modal"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="max-h-[72vh] space-y-4 overflow-y-auto p-4">
              {commentsModalTicket?.content ? (
                <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ticket content</p>
                    <p className="text-xs text-muted-foreground">
                      Created {formatTs(commentsModalTicket.created_at)} · Updated {formatTs(commentsModalTicket.updated_at)}
                    </p>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{commentsModalTicket.content}</p>
                </div>
              ) : null}
              {commentsLoading ? (
                <div className="space-y-2 rounded-lg border border-border/70 bg-muted/10 p-3">
                  <p className="text-sm text-muted-foreground">Loading comments...</p>
                  <div className="h-10 animate-pulse rounded bg-muted/40" />
                  <div className="h-16 animate-pulse rounded bg-muted/30" />
                </div>
              ) : null}
              {!commentsLoading && commentsError ? <p className="text-sm text-destructive">{commentsError}</p> : null}
              {!commentsLoading && !commentsError && commentsRows.length === 0 ? (
                <div className="rounded-lg border border-border/70 bg-muted/10 p-3 text-sm text-muted-foreground">No comments yet.</div>
              ) : null}
              {!commentsLoading && !commentsError && commentsRows.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-border/70 bg-card">
                  <div className="max-h-[40vh] overflow-y-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          <th className="sticky top-0 z-[1] bg-muted/30 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Author
                          </th>
                          <th className="sticky top-0 z-[1] bg-muted/30 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Reply
                          </th>
                          <th className="sticky top-0 z-[1] bg-muted/30 px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Time
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {commentsRows.map((c) => (
                          <tr key={c.id} className="border-t border-border/60 align-top">
                            <td className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">{c.author}</td>
                            <td className="px-3 py-2.5 text-foreground" title={toPlain(c.html)}>
                              {shorten(toPlain(c.html))}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs text-muted-foreground">
                              {formatTs(c.updated_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
              <div id="modal-reply-box" className="rounded-lg border border-border/70 bg-muted/10 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reply</p>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={4}
                  placeholder="Write your reply..."
                  className="w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/30"
                />
                {replyError ? <p className="mt-2 text-xs text-destructive">{replyError}</p> : null}
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => void submitReply()}
                    disabled={replyBusy}
                    className="inline-flex h-8 items-center rounded-md border border-cyan-500/40 bg-cyan-500/15 px-3 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {replyBusy ? "Sending..." : "Send reply"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {statusModalTicket ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ticket-set-status-title"
          onClick={() => setStatusModalTicket(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border/70 bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
              <h2 id="ticket-set-status-title" className="text-sm font-semibold text-foreground">
                Set status for ticket #{statusModalTicket.id}
              </h2>
              <button
                type="button"
                onClick={() => setStatusModalTicket(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
                aria-label="Close status modal"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <form
              className="space-y-3 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                void submitTicketUpdate(statusModalTicket.id, Number(statusDraft), statusModalTicket.priority_id);
              }}
            >
              <input type="hidden" name="ticket_id" value={statusModalTicket.id} />
              <input type="hidden" name="priority" value={String(statusModalTicket.priority_id)} />
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Status</label>
                <FormSelect
                  name="status"
                  value={statusDraft}
                  onValueChange={setStatusDraft}
                  options={[
                    { value: "1", label: "In progress" },
                    { value: "2", label: "Fixed" },
                    { value: "3", label: "Re-opened" },
                  ]}
                  className="w-full"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStatusModalTicket(null)}
                  className="inline-flex h-8 items-center rounded-md border border-border/70 px-3 text-xs text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionBusy}
                  className="inline-flex h-8 items-center rounded-md border border-cyan-500/40 bg-cyan-500/15 px-3 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/25"
                >
                  {actionBusy ? "Saving..." : "Save status"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {priorityModalTicket ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ticket-set-priority-title"
          onClick={() => setPriorityModalTicket(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border/70 bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
              <h2 id="ticket-set-priority-title" className="text-sm font-semibold text-foreground">
                Set priority for ticket #{priorityModalTicket.id}
              </h2>
              <button
                type="button"
                onClick={() => setPriorityModalTicket(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
                aria-label="Close priority modal"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <form
              className="space-y-3 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                void submitTicketUpdate(priorityModalTicket.id, priorityModalTicket.status_id, Number(priorityDraft));
              }}
            >
              <input type="hidden" name="ticket_id" value={priorityModalTicket.id} />
              <input type="hidden" name="status" value={String(priorityModalTicket.status_id)} />
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Priority</label>
                <FormSelect
                  name="priority"
                  value={priorityDraft}
                  onValueChange={setPriorityDraft}
                  options={[
                    { value: "1", label: "High" },
                    { value: "2", label: "Normal" },
                    { value: "3", label: "Low" },
                  ]}
                  className="w-full"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPriorityModalTicket(null)}
                  className="inline-flex h-8 items-center rounded-md border border-border/70 px-3 text-xs text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionBusy}
                  className="inline-flex h-8 items-center rounded-md border border-cyan-500/40 bg-cyan-500/15 px-3 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/25"
                >
                  {actionBusy ? "Saving..." : "Save priority"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {deleteModalTicket ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ticket-delete-title"
          onClick={() => setDeleteModalTicket(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border/70 bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
              <h2 id="ticket-delete-title" className="text-sm font-semibold text-foreground">
                Delete ticket #{deleteModalTicket.id}?
              </h2>
              <button
                type="button"
                onClick={() => setDeleteModalTicket(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
                aria-label="Close delete modal"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="space-y-4 p-4">
              <p className="text-sm text-muted-foreground">This will permanently delete this ticket and its comments.</p>
              <div className="rounded-md border border-border/70 bg-muted/20 p-2 text-sm text-foreground">
                {deleteModalTicket.subject || "—"}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteModalTicket(null)}
                  className="inline-flex h-8 items-center rounded-md border border-border/70 px-3 text-xs text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
                >
                  Cancel
                </button>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submitTicketDelete(deleteModalTicket.id);
                  }}
                >
                  <input type="hidden" name="ticket_id" value={deleteModalTicket.id} />
                  <button
                    type="submit"
                    disabled={actionBusy}
                    className="inline-flex h-8 items-center rounded-md border border-rose-500/40 bg-rose-500/15 px-3 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/25"
                  >
                    {actionBusy ? "Deleting..." : "Delete ticket"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}


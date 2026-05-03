"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ScanSearch, Search } from "lucide-react";
import type { ItvChannelRow, TvGenreRow } from "@/lib/repos/tickets";
import { FormField } from "@/components/forms/form-field";
import { FormStack } from "@/components/forms/form-stack";
import { FormActions } from "@/components/forms/form-actions";
import { Button, buttonOutlineLinkClassName } from "@/components/ui/button";
import { FormSelect } from "@/components/forms/form-select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/cn";

const fieldLabelClass = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

const controlClass = cn(
  "rounded-lg border border-border/80 bg-muted/20 text-foreground outline-none transition-[color,box-shadow,border-color] duration-200 ease-out",
  "focus-visible:border-cyan-500/50 focus-visible:ring-[3px] focus-visible:ring-cyan-500/25",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

const problems: { name: string; field: ProblemField }[] = [
  { name: "No audio", field: "no_audio" },
  { name: "No video", field: "no_video" },
  { name: "Stream Error", field: "stream_error" },
  { name: "No EPG", field: "no_epg" },
  { name: "Catch Up Needed", field: "catch_up_needed" },
  { name: "EPG needed", field: "epg_needed" },
  { name: "File Missing On Catch Up", field: "file_missing" },
  { name: "Wrong Channel Name", field: "wrong_channel_name" },
];

type ProblemField =
  | "no_audio"
  | "no_video"
  | "stream_error"
  | "no_epg"
  | "catch_up_needed"
  | "epg_needed"
  | "file_missing"
  | "wrong_channel_name";

type Props = {
  genres: TvGenreRow[];
  action: (formData: FormData) => void | Promise<void>;
  ticketsApiBase?: string;
};

export function CreateTicketForm({ genres, action, ticketsApiBase = "/api/admin/tickets" }: Props) {
  const genreOptions = useMemo(() => {
    const out: TvGenreRow[] = [];
    const seen = new Set<number>();
    for (const g of genres) {
      const id = Number(g.id ?? 0);
      if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, title: String(g.title ?? "") });
    }
    return out;
  }, [genres]);

  const firstGenreId = genreOptions[0]?.id ?? 0;
  const [categoryId, setCategoryId] = useState<number>(firstGenreId);
  const [channels, setChannels] = useState<ItvChannelRow[]>([]);
  const [channelId, setChannelId] = useState<string>("");
  const [channelNumber, setChannelNumber] = useState("");
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [channelLoadError, setChannelLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!categoryId) {
      void Promise.resolve().then(() => {
        setChannels([]);
        setChannelLoadError(null);
      });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setChannelLoadError(null);
        const res = await fetch(`${ticketsApiBase}/channels?id=${categoryId}`, { credentials: "same-origin" });
        if (!res.ok) {
          throw new Error("Failed to load channels");
        }
        if (cancelled) return;
        const data = (await res.json()) as ItvChannelRow[];
        const deduped: ItvChannelRow[] = [];
        const seen = new Set<number>();
        for (const c of data) {
          const id = Number(c.id ?? 0);
          if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
          seen.add(id);
          deduped.push({
            id,
            name: String(c.name ?? ""),
            number: Number(c.number ?? 0),
            tv_genre_id: Number(c.tv_genre_id ?? 0),
          });
        }
        if (cancelled) return;
        setChannels(deduped);
        if (deduped.length) {
          setChannelId(String(deduped[0].id));
          setChannelNumber(String(deduped[0].number));
          setSubject(deduped[0].name);
        } else {
          setChannelId("");
          setSubject("");
        }
      } catch {
        if (cancelled) return;
        setChannels([]);
        setChannelId("");
        setChannelLoadError("Channels unavailable for this category (Stalker ITV table missing or inaccessible).");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [categoryId, ticketsApiBase]);

  useEffect(() => {
    const ch = channels.find((c) => String(c.id) === channelId);
    if (!ch) return;
    void Promise.resolve().then(() => {
      setChannelNumber(String(ch.number));
      setSubject(ch.name);
    });
  }, [channelId, channels]);

  async function lookupByNumber() {
    const n = Number(channelNumber.trim());
    if (!Number.isFinite(n) || n <= 0) return;
    setLookupBusy(true);
    try {
      const res = await fetch(`${ticketsApiBase}/channel-by-number?number=${n}`, { credentials: "same-origin" });
      if (!res.ok) return;
      const arr = (await res.json()) as ItvChannelRow[];
      const row = arr[0];
      if (!row) return;
      setCategoryId(row.tv_genre_id);
      setChannelId(String(row.id));
      setSubject(row.name);
    } finally {
      setLookupBusy(false);
    }
  }

  return (
    <form action={action} className="mx-auto w-full max-w-4xl">
      <FormStack className="gap-5 sm:gap-6">
        <FormField id="ct-channel-num" label="Enter your channel number" labelClassName={fieldLabelClass}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="ct-channel-num"
                name="channel_number"
                value={channelNumber}
                onChange={(e) => setChannelNumber(e.target.value)}
                onBlur={() => void lookupByNumber()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void lookupByNumber();
                  }
                }}
                placeholder="Channel number…"
                className={cn("h-11 min-w-0 pl-9 sm:min-w-[200px] md:h-9", controlClass)}
                autoComplete="off"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void lookupByNumber()}
              disabled={lookupBusy}
              className="h-11 w-full shrink-0 gap-2 border-border/80 bg-muted/10 hover:bg-muted/25 sm:w-auto sm:min-w-[120px] md:h-9"
            >
              <ScanSearch className="h-4 w-4 shrink-0" aria-hidden />
              {lookupBusy ? "Looking up…" : "Lookup"}
            </Button>
          </div>
        </FormField>
        <FormField id="ct-subject" label="Subject" labelClassName={fieldLabelClass}>
          <Input
            id="ct-subject"
            name="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            className={cn("h-11 md:h-9", controlClass)}
          />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-3 sm:gap-5">
          <FormField id="ct-priority" label="Priority" labelClassName={fieldLabelClass}>
            <FormSelect
              id="ct-priority"
              name="priority"
              required
              initialUnset
              placeholder="Select priority"
              value={priority}
              onValueChange={setPriority}
              options={[
                { value: "1", label: "High" },
                { value: "2", label: "Normal" },
                { value: "3", label: "Low" },
              ]}
              className={cn("h-11 md:h-9", controlClass)}
            />
          </FormField>
          <FormField id="ct-category" label="Category" labelClassName={fieldLabelClass}>
            <FormSelect
              id="ct-category"
              name="category"
              required
              value={String(categoryId)}
              onValueChange={(v) => setCategoryId(Number(v))}
              options={genreOptions.map((g) => ({ value: String(g.id), label: g.title }))}
              className={cn("h-11 md:h-9", controlClass)}
            />
          </FormField>
          <FormField id="ct-channel" label="Channel" labelClassName={fieldLabelClass}>
            <FormSelect
              id="ct-channel"
              name="channel"
              required
              value={channelId}
              onValueChange={setChannelId}
              options={
                channels.length === 0
                  ? [{ value: "", label: channelLoadError ? "Channels unavailable" : "No channels" }]
                  : channels.map((c) => ({ value: String(c.id), label: c.name }))
              }
              className={cn("h-11 md:h-9", controlClass)}
            />
            {channelLoadError ? <p className="mt-1 text-xs text-destructive">{channelLoadError}</p> : null}
          </FormField>
        </div>
        <div className="space-y-3">
          <p className={fieldLabelClass}>Problem</p>
          <div className="grid gap-1 rounded-xl border border-border/70 bg-muted/10 p-3 sm:grid-cols-2 sm:gap-x-2 sm:gap-y-1 sm:p-4 dark:bg-muted/[0.12]">
            {problems.map((p) => (
              <label
                key={p.field}
                className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-foreground transition-colors hover:bg-muted/40"
              >
                <Checkbox name={p.field} className="border-border/80 text-cyan-600 focus-visible:ring-cyan-500/40 dark:text-cyan-400" />
                <span>{p.name}</span>
              </label>
            ))}
          </div>
        </div>
        <FormField id="ct-desc" label="Description" labelClassName={fieldLabelClass}>
          <Textarea
            id="ct-desc"
            name="description"
            rows={8}
            placeholder="Describe the issue, steps to reproduce, and what the user sees…"
            className={cn("min-h-[200px] resize-y py-3", controlClass)}
          />
        </FormField>
        <FormActions className="border-t border-border/60 pt-6 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <Button
            type="submit"
            className="w-full min-h-11 border-0 bg-chart-2 text-white shadow-md hover:bg-cyan-700 sm:w-auto sm:min-h-10"
          >
            Submit
          </Button>
          <Link
            href="/admin/tickets"
            className={buttonOutlineLinkClassName(
              "w-full min-h-11 justify-center border-border/80 bg-muted/10 hover:bg-muted/25 sm:w-auto sm:min-h-10",
            )}
          >
            Cancel
          </Link>
        </FormActions>
      </FormStack>
    </form>
  );
}

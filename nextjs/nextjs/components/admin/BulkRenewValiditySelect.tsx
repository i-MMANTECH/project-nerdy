"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { Input } from "@/components/ui/input";

export type BulkRenewValidityOption = { value: string; label: string };

function splitValidityLabel(label: string): { primary: string; secondary: string | null } {
  const trimmed = label.trim();
  const match = /^(.+?)\s*\((.+)\)\s*$/.exec(trimmed);
  if (!match) return { primary: trimmed, secondary: null };
  return { primary: match[1].trim(), secondary: match[2].trim() };
}

export function BulkRenewValiditySelect({
  value,
  onValueChange,
  options,
  triggerClassName,
  labelledBy,
}: {
  value: string;
  onValueChange: (next: string) => void;
  options: BulkRenewValidityOption[];
  triggerClassName?: string;
  labelledBy?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (root.contains(target)) return;
      setOpen(false);
      setQuery("");
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-border/80 bg-muted/20 px-3 text-left text-sm font-medium text-foreground transition hover:bg-muted/30 md:h-9",
          triggerClassName,
        )}
        aria-labelledby={labelledBy}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="line-clamp-1">{selected?.label ?? "Validity"}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground opacity-80" aria-hidden />
      </button>

      {open ? (
        <div className="absolute left-0 z-[120] mt-2 w-full max-w-full overflow-hidden rounded-lg border border-border bg-card shadow-xl ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
          <div className="border-b border-border/60 bg-card/95 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search validity..."
                className="h-9 border-border/80 bg-muted/15 pl-8 text-sm md:h-9"
                autoFocus
              />
            </div>
          </div>
          <div className="thin-scrollbar max-h-72 overflow-x-hidden overflow-y-auto p-1.5" role="listbox" aria-labelledby={labelledBy}>
            {filteredOptions.map((o) => {
              const parts = splitValidityLabel(o.label);
              const selectedRow = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onValueChange(o.value);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "flex w-full min-w-0 items-start gap-2 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-muted/60",
                    selectedRow && "bg-muted/70",
                  )}
                  role="option"
                  aria-selected={selectedRow}
                >
                  <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center">
                    {selectedRow ? <Check className="h-3.5 w-3.5 text-primary" aria-hidden /> : null}
                  </span>
                  <span className="block min-w-0 leading-snug">
                    <span className="block text-sm font-semibold text-foreground">{parts.primary}</span>
                    {parts.secondary ? (
                      <span className="block break-words text-xs font-normal text-muted-foreground">{parts.secondary}</span>
                    ) : null}
                  </span>
                </button>
              );
            })}
            {filteredOptions.length === 0 ? <div className="px-3 py-2.5 text-sm text-muted-foreground">No validity options match your search.</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

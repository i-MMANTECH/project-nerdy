"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export type SearchableFormSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SearchableFormSelectProps = {
  id: string;
  name: string;
  options: SearchableFormSelectOption[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (next: string) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  initialUnset?: boolean;
  className?: string;
};

export function SearchableFormSelect({
  id,
  name,
  options,
  defaultValue,
  value,
  onValueChange,
  disabled,
  required,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  initialUnset,
  className,
}: SearchableFormSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isControlled = value !== undefined;
  const initialValue = initialUnset ? "" : (defaultValue ?? "");
  const [internalSelected, setInternalSelected] = useState(initialValue);
  const selected = isControlled ? (value ?? "") : internalSelected;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedOption = useMemo(
    () => options.find((o) => o.value === selected),
    [options, selected],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const root = rootRef.current;
      const target = event.target;
      if (!root || !(target instanceof Node)) return;
      if (root.contains(target)) return;
      setOpen(false);
      setQuery("");
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (isControlled) return;
    if (defaultValue === undefined) return;
    setInternalSelected(defaultValue);
  }, [defaultValue, isControlled]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <input type="hidden" id={id} name={name} value={selected} required={required} />
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-left text-sm text-foreground shadow-sm transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={cn("truncate pr-2", !selectedOption && "text-muted-foreground")}>
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-[230] mt-1 rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-xl">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="mb-2 h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          />
          <div
            role="listbox"
            className={cn(
              "max-h-56 overflow-y-auto rounded-md border border-border/60 bg-background/40 py-1",
              "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border/60",
              "hover:scrollbar-thumb-border/80",
              "[scrollbar-gutter:stable]",
              "[&::-webkit-scrollbar]:w-2.5",
              "[&::-webkit-scrollbar-thumb]:rounded-full",
              "[&::-webkit-scrollbar-thumb]:border-2",
              "[&::-webkit-scrollbar-thumb]:border-transparent",
              "[&::-webkit-scrollbar-thumb]:bg-border/70",
              "[&::-webkit-scrollbar-thumb:hover]:bg-border",
              "[&::-webkit-scrollbar-track]:bg-transparent",
            )}
          >
            {filtered.length ? (
              filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    if (opt.disabled) return;
                    if (!isControlled) setInternalSelected(opt.value);
                    onValueChange?.(opt.value);
                    setOpen(false);
                    setQuery("");
                  }}
                  disabled={opt.disabled}
                  className="flex w-full items-center justify-between px-2.5 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <span className="truncate">{opt.label}</span>
                  {selected === opt.value ? <Check className="h-3.5 w-3.5 text-primary" aria-hidden /> : null}
                </button>
              ))
            ) : (
              <p className="px-2.5 py-2 text-xs text-muted-foreground">No matching options.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  id: string;
  name: string;
  min: number;
  max: number;
  defaultValue: number;
  value?: number;
  bonusChargedMap?: Record<number, number>;
  className?: string;
  onValueChange?: (next: number) => void;
};

const VISIBLE_LIMIT = 120;
const VIEW_MARGIN = 8;

export function CreditsCombobox({ id, name, min, max, defaultValue, value, bonusChargedMap, className, onValueChange }: Props) {
  const safeMin = Math.max(1, min);
  const safeMax = Math.max(safeMin, max);
  const initial = Math.min(Math.max(defaultValue, safeMin), safeMax);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(initial);
  const [mounted, setMounted] = useState(false);
  const [box, setBox] = useState({ top: 0, left: 0, width: 0, maxHeight: 224 });

  const options = useMemo(() => {
    const out: number[] = [];
    for (let i = safeMin; i <= safeMax; i += 1) out.push(i);
    return out;
  }, [safeMin, safeMax]);

  useEffect(() => {
    if (value == null) return;
    const next = Math.min(Math.max(value, safeMin), safeMax);
    setSelected(next);
  }, [value, safeMin, safeMax]);

  const filtered = useMemo(() => {
    const needle = query.trim();
    if (!needle) return options.slice(0, VISIBLE_LIMIT);
    return options.filter((n) => String(n).includes(needle)).slice(0, VISIBLE_LIMIT);
  }, [options, query]);

  const formatOptionLabel = (amount: number) => {
    const charged = bonusChargedMap?.[amount];
    if (!charged || charged >= amount) return `${amount} credits`;
    const bonus = amount - charged;
    return `${charged} credits + ${bonus} bonus (${amount} total)`;
  };

  const hasBonus = (amount: number) => {
    const charged = bonusChargedMap?.[amount];
    return Boolean(charged && charged < amount);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    function reposition() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const r = trigger.getBoundingClientRect();
      const dropdown = dropdownRef.current;
      const desiredHeight = dropdown?.scrollHeight ?? 224;
      const spaceBelow = window.innerHeight - r.bottom - VIEW_MARGIN;
      const spaceAbove = r.top - VIEW_MARGIN;
      const openUp = desiredHeight > spaceBelow && spaceAbove > spaceBelow;
      const maxHeight = Math.max(120, openUp ? spaceAbove - 6 : spaceBelow - 6);
      const top = openUp ? Math.max(VIEW_MARGIN, r.top - Math.min(desiredHeight, maxHeight) - 4) : r.bottom + 4;
      const left = Math.max(VIEW_MARGIN, Math.min(r.left, window.innerWidth - r.width - VIEW_MARGIN));
      setBox({ top, left, width: r.width, maxHeight });
    }
    reposition();
    const raf = requestAnimationFrame(reposition);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
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

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <input type="hidden" id={id} name={name} value={selected} />
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-left text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <span className="truncate pr-2">{formatOptionLabel(selected)}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      {open && mounted
        ? createPortal(
            <div
              ref={dropdownRef}
              className="fixed z-[340] rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-xl"
              style={{ top: box.top, left: box.left, width: box.width }}
            >
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="Search credits..."
            className="mb-2 h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          />
          <div role="listbox" className="overflow-y-auto rounded-md border border-border/60 bg-background/40 py-1" style={{ maxHeight: box.maxHeight }}>
            {filtered.length ? (
              filtered.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => {
                    setSelected(amount);
                    onValueChange?.(amount);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex w-full items-center justify-between px-2.5 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-primary/10"
                >
                  <span className={cn("tabular-nums", hasBonus(amount) && "font-semibold text-emerald-600 dark:text-emerald-400")}>
                    {formatOptionLabel(amount)}
                  </span>
                  {selected === amount ? <Check className="h-3.5 w-3.5 text-primary" aria-hidden /> : null}
                </button>
              ))
            ) : (
              <p className="px-2.5 py-2 text-xs text-muted-foreground">No matching credits found.</p>
            )}
          </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";
import { FloatingMenuPortal } from "@/components/ui/FloatingMenuPortal";

type Props = {
  selectedColumns: string[];
  labels: Record<string, string>;
  currentQuery: {
    q?: string;
    p?: number;
    ps?: number;
    type?: string;
    status?: string;
    sort?: string;
    dir?: string;
    quick?: string;
    bq?: string;
    bs?: string;
  };
};

export function ManagersColumnSettings({ selectedColumns, labels, currentQuery }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const allColumns = useMemo(() => Object.keys(labels), [labels]);
  const [checked, setChecked] = useState<string[]>(selectedColumns.length ? selectedColumns : allColumns);
  const [open, setOpen] = useState(false);

  const applyColumns = (nextChecked: string[]) => {
    const params = new URLSearchParams();
    const q = (currentQuery.q ?? "").trim();
    if (q) params.set("q", q);
    if (currentQuery.ps && [10, 25, 50, 100].includes(currentQuery.ps)) params.set("ps", String(currentQuery.ps));
    if (currentQuery.type && ["manager", "reseller", "dealer"].includes(currentQuery.type)) params.set("type", currentQuery.type);
    if (currentQuery.status && ["active", "inactive"].includes(currentQuery.status)) params.set("status", currentQuery.status);
    if (currentQuery.sort) params.set("sort", currentQuery.sort);
    if (currentQuery.dir) params.set("dir", currentQuery.dir);
    if (currentQuery.quick === "1") params.set("quick", "1");
    const bq = (currentQuery.bq ?? "").trim();
    if (bq) params.set("bq", bq);
    if (currentQuery.bs && ["active", "inactive"].includes(currentQuery.bs)) params.set("bs", currentQuery.bs);
    if (currentQuery.p && currentQuery.p > 1) params.set("p", String(currentQuery.p));

    if (nextChecked.length > 0 && nextChecked.length < allColumns.length) {
      for (const col of nextChecked) params.append("cols", col);
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const onToggle = (col: string, enabled: boolean) => {
    const next = enabled ? [...checked, col] : checked.filter((x) => x !== col);
    if (next.length === 0) return;
    setChecked(next);
    applyColumns(next);
  };

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (!open) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted/40"
        aria-label="Column settings"
        title="Column settings"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <SlidersHorizontal className="h-[18px] w-[18px]" aria-hidden />
      </button>
      <FloatingMenuPortal open={open} onOpenChange={setOpen} anchorRef={buttonRef} menuClassName="w-56 p-2.5">
        <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Visible columns</p>
        <div className="space-y-1" role="menu">
          {allColumns.map((col) => (
            <label key={col} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-muted/40">
              <input
                type="checkbox"
                checked={checked.includes(col)}
                onChange={(e) => onToggle(col, e.target.checked)}
                className={cn("accent-primary")}
              />
              <span>{labels[col]}</span>
            </label>
          ))}
        </div>
      </FloatingMenuPortal>
    </div>
  );
}

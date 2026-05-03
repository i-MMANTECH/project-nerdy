"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowRight, Bell, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

const iconBtn =
  "flex h-9 w-9 shrink-0 list-none items-center justify-center rounded-lg text-muted-foreground transition-[color,background-color] duration-200 ease-out hover:bg-muted hover:text-foreground [&::-webkit-details-marker]:hidden";

export type HeaderTicketPreviewItem = {
  id: number;
  subject: string;
  statusLabel: string;
};

/**
 * Top bar: quick add + bell (badge = open ticket count from DB, hidden when 0).
 * When `ticketPreview` is passed, the bell opens a preview popover; "View all" still goes to the tickets list.
 */
export function HeaderQuickActions({
  addHref,
  notificationsHref,
  notificationCount,
  notificationLabel = "Open tickets",
  ticketPreview,
  className,
}: {
  addHref: string;
  notificationsHref: string;
  notificationCount: number;
  notificationLabel?: string;
  /** When provided (including `[]`), bell uses a preview menu instead of navigating on first click. */
  ticketPreview?: HeaderTicketPreviewItem[];
  className?: string;
}) {
  const n = Math.max(0, Math.floor(notificationCount));
  const label = n === 0 ? "Tickets" : `${notificationLabel}: ${n}`;
  const bellMenuRef = useRef<HTMLDetailsElement>(null);

  function closeBellMenu() {
    const el = bellMenuRef.current;
    if (el) el.open = false;
  }

  useEffect(() => {
    const closeOnOutside = (e: PointerEvent) => {
      const el = bellMenuRef.current;
      if (!el?.open) return;
      const t = e.target;
      if (t instanceof Node && el.contains(t)) return;
      el.open = false;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const el = bellMenuRef.current;
      if (e.key === "Escape" && el?.open) el.open = false;
    };
    document.addEventListener("pointerdown", closeOnOutside, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);

  const bellAsPreview = ticketPreview !== undefined;

  return (
    <div className={cn("flex shrink-0 items-center gap-0.5", className)}>
      <Link href={addHref} className={iconBtn} title="Quick add subscriber">
        <Plus className="h-5 w-5" strokeWidth={2} aria-hidden />
      </Link>
      {bellAsPreview ? (
        <details ref={bellMenuRef} className="relative">
          <summary
            className={cn(iconBtn, "relative cursor-pointer")}
            title={label}
            aria-label={label}
            aria-haspopup="menu"
          >
            <Bell className="h-5 w-5" strokeWidth={2} aria-hidden />
            {n > 0 ? (
              <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold tabular-nums leading-none text-destructive-foreground shadow-sm">
                {n > 99 ? "99+" : n}
              </span>
            ) : null}
          </summary>
          <div
            role="menu"
            className="absolute right-0 z-50 mt-1 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
          >
            <div className="border-b border-border px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{notificationLabel}</p>
              <p className="text-[11px] text-muted-foreground">Open tickets — newest first</p>
            </div>
            <ul className="max-h-[min(60vh,320px)] overflow-y-auto py-1">
              {ticketPreview.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-muted-foreground">No open tickets.</li>
              ) : (
                ticketPreview.map((t) => (
                  <li key={t.id}>
                    <Link
                      role="menuitem"
                      href={`${notificationsHref.replace(/\/$/, "")}/${t.id}`}
                      onClick={closeBellMenu}
                      className="block border-b border-border/50 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-accent hover:text-accent-foreground"
                    >
                      <span className="line-clamp-2 text-sm font-medium text-foreground">{t.subject || `Ticket #${t.id}`}</span>
                      <span className="mt-1 inline-block rounded-full border border-border/80 bg-muted/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {t.statusLabel}
                      </span>
                    </Link>
                  </li>
                ))
              )}
            </ul>
            <div className="border-t border-border px-2 py-1.5">
              <Link
                href={notificationsHref}
                onClick={closeBellMenu}
                className="inline-flex w-full items-center justify-center gap-0.5 rounded-md py-1 text-xs font-medium text-primary underline-offset-2 transition-colors hover:bg-muted/50 hover:underline"
              >
                All tickets
                <ArrowRight className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
              </Link>
            </div>
          </div>
        </details>
      ) : (
        <Link href={notificationsHref} className={cn(iconBtn, "relative")} title={label} aria-label={label}>
          <Bell className="h-5 w-5" strokeWidth={2} aria-hidden />
          {n > 0 ? (
            <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold tabular-nums leading-none text-destructive-foreground shadow-sm">
              {n > 99 ? "99+" : n}
            </span>
          ) : null}
        </Link>
      )}
    </div>
  );
}

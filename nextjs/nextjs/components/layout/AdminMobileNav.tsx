"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";
import { getAdminNavShellItems, isAdminNavActive, type AdminNavShellItem } from "@/lib/admin-nav-shell";
import type { PortalBase, PortalNavItem } from "@/lib/portal-nav";
import { getPortalNavItems, isPortalNavActive } from "@/lib/portal-nav";

const MAX_MAIN = 4;

export function AdminMobileNav({ portalBase }: { portalBase?: PortalBase }) {
  const pathname = usePathname() ?? "";
  const [moreOpen, setMoreOpen] = useState(false);
  const moreWrapRef = useRef<HTMLDivElement>(null);

  const all = portalBase ? getPortalNavItems(portalBase) : getAdminNavShellItems();
  const main = all.slice(0, MAX_MAIN);
  const more = all.slice(MAX_MAIN);
  const moreActive = portalBase
    ? (more as PortalNavItem[]).some((item) => isPortalNavActive(pathname, item))
    : (more as AdminNavShellItem[]).some((item) => isAdminNavActive(pathname, item));

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    function onPointerDown(e: PointerEvent) {
      const root = moreWrapRef.current;
      if (!root || root.contains(e.target as Node)) return;
      setMoreOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMoreOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [moreOpen]);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/90 bg-card/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_-4px_rgba(15,23,42,0.08)] backdrop-blur-lg supports-[backdrop-filter]:bg-card/90 dark:shadow-black/40 lg:hidden"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around px-1 pt-2">
        {main.map((item) => {
          const Icon = item.icon;
          const active = portalBase
            ? isPortalNavActive(pathname, item as PortalNavItem)
            : isAdminNavActive(pathname, item as AdminNavShellItem);
          return (
            <Link
              key={portalBase ? (item as PortalNavItem).href : (item as AdminNavShellItem).key}
              href={item.href}
              className={cn(
                "flex min-w-[56px] flex-col items-center justify-center rounded-lg px-2 py-2 transition-[color,background-color] duration-200 ease-out",
                active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <Icon className="mb-0.5 h-5 w-5 shrink-0" aria-hidden />
              <span className="max-w-[72px] truncate text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}

        {more.length > 0 ? (
          <div ref={moreWrapRef} className="relative min-w-[56px]">
            <button
              type="button"
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              aria-controls="admin-mobile-nav-more"
              id="admin-mobile-nav-more-trigger"
              onClick={() => setMoreOpen((o) => !o)}
              className={cn(
                "flex w-full cursor-pointer flex-col items-center justify-center rounded-lg px-2 py-2 transition-colors",
                moreActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <MoreHorizontal className="mb-0.5 h-5 w-5" aria-hidden />
              <span className="text-xs font-medium">More</span>
            </button>
            {moreOpen ? (
              <div
                id="admin-mobile-nav-more"
                role="menu"
                aria-labelledby="admin-mobile-nav-more-trigger"
                className="absolute bottom-full right-0 z-50 mb-2 min-w-[200px] rounded-lg border border-border bg-popover p-1 shadow-lg"
              >
                {more.map((item) => {
                  const Icon = item.icon;
                  const active = portalBase
                    ? isPortalNavActive(pathname, item as PortalNavItem)
                    : isAdminNavActive(pathname, item as AdminNavShellItem);
                  return (
                    <Link
                      key={portalBase ? (item as PortalNavItem).href : (item as AdminNavShellItem).key}
                      href={item.href}
                      role="menuitem"
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-3 py-2.5 text-sm",
                        active ? "bg-accent text-accent-foreground" : "text-popover-foreground hover:bg-accent/50",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { getAdminRouteMeta } from "@/lib/admin-route-meta";
import type { PortalBase } from "@/lib/portal-nav";
import { getPortalRouteMeta } from "@/lib/portal-route-meta";
import type { SessionPayload } from "@/lib/session";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HeaderQuickActions, type HeaderTicketPreviewItem } from "@/components/layout/HeaderQuickActions";
import { logoutAction } from "@/actions/auth";

export function AdminAppHeader({
  session,
  openTicketCount = 0,
  portalBase,
  notificationsHref: notificationsHrefProp,
  notificationLabel = "Open tickets",
  ticketPreview,
}: {
  session: SessionPayload;
  openTicketCount?: number;
  portalBase?: PortalBase;
  /** When `portalBase` is set, target for the bell (e.g. tickets or messages). */
  notificationsHref?: string;
  notificationLabel?: string;
  /** When set, bell opens a ticket preview popover (admin / manager / dealer). */
  ticketPreview?: HeaderTicketPreviewItem[];
}) {
  const profileMenuRef = useRef<HTMLDetailsElement>(null);

  function closeProfileMenu() {
    const el = profileMenuRef.current;
    if (el) el.open = false;
  }

  useEffect(() => {
    const closeOnOutside = (e: PointerEvent) => {
      const el = profileMenuRef.current;
      if (!el?.open) return;
      const t = e.target;
      if (t instanceof Node && el.contains(t)) return;
      el.open = false;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const el = profileMenuRef.current;
      if (e.key === "Escape" && el?.open) el.open = false;
    };
    document.addEventListener("pointerdown", closeOnOutside, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);

  const pathname = usePathname() ?? "";
  const meta = portalBase ? getPortalRouteMeta(portalBase, pathname) : getAdminRouteMeta(pathname);
  const addHref = portalBase ? `${portalBase}/users/new` : "/admin/users/new";
  const bellHref =
    notificationsHrefProp ?? (portalBase ? `${portalBase}/tickets` : "/admin/tickets");
  const profileHref = portalBase ? `${portalBase}/profile` : "/admin/profile";

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-card/90 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="flex h-auto min-h-14 flex-col gap-2 px-4 py-2.5 lg:h-14 lg:flex-row lg:items-center lg:justify-between lg:gap-5 lg:px-6 lg:py-0">
        <div className="min-w-0 shrink-0 rounded-lg px-1 py-0.5 lg:max-w-[min(360px,40%)]">
          <h1 className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">{meta.title}</h1>
          {meta.subtitle ? <p className="truncate text-xs text-muted-foreground sm:text-sm">{meta.subtitle}</p> : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
          <HeaderQuickActions
            addHref={addHref}
            notificationsHref={bellHref}
            notificationCount={openTicketCount}
            notificationLabel={notificationLabel}
            ticketPreview={ticketPreview}
          />
          <ThemeToggle />
          <details ref={profileMenuRef} className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-1.5 py-1 transition-all duration-200 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 [&::-webkit-details-marker]:hidden">
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-sm font-medium text-primary"
                aria-hidden
              >
                {session.displayName?.charAt(0) ?? "A"}
              </span>
            </summary>
            <div className="absolute right-0 z-50 mt-1 min-w-[200px] rounded-lg border border-border bg-popover py-1 text-popover-foreground shadow-lg">
              <p className="border-b border-border px-3 py-2 text-xs text-muted-foreground">{session.displayName}</p>
              <Link
                className="block px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                href={profileHref}
                onClick={closeProfileMenu}
              >
                My profile
              </Link>
              {portalBase ? null : (
                <Link
                  className="block px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                  href="/admin/settings"
                  onClick={closeProfileMenu}
                >
                  Settings
                </Link>
              )}
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                  onClick={closeProfileMenu}
                >
                  Logout
                </button>
              </form>
            </div>
          </details>
        </div>
      </div>

    </header>
  );
}

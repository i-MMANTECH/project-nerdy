"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, LogOut } from "lucide-react";
import { cn } from "@/lib/cn";
import { getAdminNavShellItems, isAdminNavActive, type AdminNavShellItem } from "@/lib/admin-nav-shell";
import type { PortalBase } from "@/lib/portal-nav";
import { getPortalNavItems, isPortalNavActive } from "@/lib/portal-nav";
import type { SessionPayload } from "@/lib/session";
import { logoutAction } from "@/actions/auth";

const roleLabels: Record<string, string> = {
  ROOT: "Admin",
  MNGR: "Manager",
  SRSLR: "Reseller",
  RSLR: "Dealer",
};

export function AdminSidebar({ session, portalBase }: { session: SessionPayload; portalBase?: PortalBase }) {
  const pathname = usePathname() ?? "";
  const role = roleLabels[session.type] ?? session.type;
  const logoHref = portalBase ?? "/admin/dashboard";
  const portalItems = portalBase ? getPortalNavItems(portalBase) : null;
  const adminItems = portalBase ? null : getAdminNavShellItems();

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r border-border bg-card lg:flex">
      <div className="border-b border-border p-6">
        <Link href={logoHref} className="flex items-center gap-3 transition-opacity duration-200 hover:opacity-90">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Package className="h-6 w-6 text-primary" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground">IPTV Billing</p>
            <p className="text-xs text-muted-foreground">Management System</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto p-4" aria-label="Main navigation">
        <div className="space-y-1">
          {portalItems
            ? portalItems.map((item) => {
                const Icon = item.icon;
                const active = isPortalNavActive(pathname, item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-base transition-colors",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden />
                    <span>{item.label}</span>
                  </Link>
                );
              })
            : (adminItems as AdminNavShellItem[]).map((item) => {
                const Icon = item.icon;
                const active = isAdminNavActive(pathname, item);
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-base transition-colors",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
        </div>
      </nav>

      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-medium text-primary">
            {session.displayName?.charAt(0) ?? "A"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{session.displayName}</p>
            <p className="text-xs text-muted-foreground">{role}</p>
          </div>
        </div>
        <form action={logoutAction} className="mt-2">
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden />
            Logout
          </button>
        </form>
      </div>
    </aside>
  );
}

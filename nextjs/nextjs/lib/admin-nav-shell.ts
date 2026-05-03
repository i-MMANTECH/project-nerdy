import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  BarChart3,
  DollarSign,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Ticket,
  Users,
  UsersRound,
} from "lucide-react";
import { adminNav, type NavKey } from "@/lib/nav";

const iconByKey: Record<NavKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  managers: UsersRound,
  users: Users,
  transactions: ArrowLeftRight,
  deductions: DollarSign,
  message: MessageSquare,
  tickets: Ticket,
  reports: BarChart3,
  settings: Settings,
};

export type AdminNavShellItem = (typeof adminNav)[number] & { icon: LucideIcon };

export function getAdminNavShellItems(): AdminNavShellItem[] {
  return adminNav.map((item) => ({ ...item, icon: iconByKey[item.key] }));
}

/** Active link: exact match or nested path; dashboard only matches `/admin/dashboard`. */
export function isAdminNavActive(pathname: string, item: AdminNavShellItem): boolean {
  if (item.key === "dashboard") {
    return pathname === "/admin/dashboard" || pathname.startsWith("/admin/dashboard/");
  }
  if (item.key === "managers") {
    const staffRoots = ["/admin/managers", "/admin/resellers", "/admin/dealers"];
    return staffRoots.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

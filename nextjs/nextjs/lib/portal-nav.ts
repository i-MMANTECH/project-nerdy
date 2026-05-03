import type { LucideIcon } from "lucide-react";
import {
  CreditCard,
  Fingerprint,
  LayoutDashboard,
  LifeBuoy,
  MessageSquare,
  User,
  Users,
  Building2,
  Store,
} from "lucide-react";

export type PortalBase = "/manager" | "/reseller" | "/dealer";

export type PortalNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
};

export function isPortalNavActive(pathname: string, item: PortalNavItem): boolean {
  return item.match(pathname);
}

export function getPortalNavItems(portalBase: PortalBase): PortalNavItem[] {
  const tickets =
    portalBase === "/manager" || portalBase === "/dealer"
      ? [
          {
            href: `${portalBase}/tickets`,
            label: "Tickets",
            icon: LifeBuoy,
            match: (path: string) => path.startsWith(`${portalBase}/tickets`),
          },
        ]
      : [];
  const managerHierarchy =
    portalBase === "/manager"
      ? [
          {
            href: `${portalBase}/resellers`,
            label: "Resellers",
            icon: Store,
            match: (path: string) => path.startsWith(`${portalBase}/resellers`),
          },
          {
            href: `${portalBase}/dealers`,
            label: "Dealers",
            icon: Building2,
            match: (path: string) => path.startsWith(`${portalBase}/dealers`),
          },
        ]
      : [];
  const resellerDealers =
    portalBase === "/reseller"
      ? [
          {
            href: `${portalBase}/dealers`,
            label: "Dealers",
            icon: Building2,
            match: (path: string) => path.startsWith(`${portalBase}/dealers`),
          },
        ]
      : [];

  return [
    {
      href: portalBase,
      label: "Dashboard",
      icon: LayoutDashboard,
      match: (path: string) => path === portalBase || path === `${portalBase}/`,
    },
    {
      href: `${portalBase}/users`,
      label: "Users",
      icon: Users,
      match: (path: string) => path.startsWith(`${portalBase}/users`),
    },
    ...resellerDealers,
    ...managerHierarchy,
    ...tickets,
    {
      href: `${portalBase}/transactions`,
      label: "Transactions",
      icon: CreditCard,
      match: (path: string) => path.startsWith(`${portalBase}/transactions`),
    },
    {
      href: `${portalBase}/check-mac`,
      label: "Check MAC",
      icon: Fingerprint,
      match: (path: string) => path.startsWith(`${portalBase}/check-mac`),
    },
    {
      href: `${portalBase}/message`,
      label: "Messages",
      icon: MessageSquare,
      match: (path: string) => path.startsWith(`${portalBase}/message`),
    },
    {
      href: `${portalBase}/profile`,
      label: "Profile",
      icon: User,
      match: (path: string) => path.startsWith(`${portalBase}/profile`),
    },
  ];
}

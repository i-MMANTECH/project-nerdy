import type { PortalBase } from "@/lib/portal-nav";

export function getPortalPageTitle(portalBase: PortalBase, pathname: string): string {
  return getPortalRouteMeta(portalBase, pathname).title;
}

export function getPortalRouteMeta(portalBase: PortalBase, pathname: string): { title: string; subtitle?: string } {
  const rules: { test: (p: string) => boolean; title: string; subtitle?: string }[] = [
    { test: (p) => p === portalBase || p === `${portalBase}/`, title: "Dashboard", subtitle: "Overview of your billing operations" },
    { test: (p) => p.startsWith(`${portalBase}/users`), title: "Users", subtitle: "Manage and monitor user accounts" },
    { test: (p) => p.startsWith(`${portalBase}/resellers`), title: "Resellers", subtitle: "Reseller accounts" },
    { test: (p) => p.startsWith(`${portalBase}/dealers`), title: "Dealers", subtitle: "Dealer accounts" },
    { test: (p) => p.startsWith(`${portalBase}/tickets`), title: "Support Tickets", subtitle: "Manage customer support requests" },
    { test: (p) => p.startsWith(`${portalBase}/transactions`), title: "Transactions", subtitle: "Track and manage credit ledger" },
    { test: (p) => p.startsWith(`${portalBase}/check-mac`), title: "Check MAC", subtitle: "Validate device MAC" },
    {
      test: (p) => p.startsWith(`${portalBase}/message`),
      title: "Messages",
      subtitle: "Send messages to user devices (STB)",
    },
    { test: (p) => p.startsWith(`${portalBase}/profile`), title: "My profile", subtitle: "Account" },
  ];
  for (const row of rules) {
    if (row.test(pathname)) return { title: row.title, subtitle: row.subtitle };
  }
  return { title: "Portal", subtitle: undefined };
}

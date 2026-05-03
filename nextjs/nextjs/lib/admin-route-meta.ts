/** Page titles for sticky header (temp-figma TopBar pattern). */
export function getAdminRouteMeta(pathname: string): { title: string; subtitle?: string } {
  if (!pathname.startsWith("/admin")) {
    return { title: "Admin", subtitle: "Billing" };
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/dashboard")) {
    return { title: "Dashboard", subtitle: "Overview of your billing operations" };
  }
  if (pathname.startsWith("/admin/managers")) {
    return { title: "Staff", subtitle: "Managers, resellers & dealers" };
  }
  if (pathname.startsWith("/admin/resellers")) {
    return { title: "Resellers", subtitle: "Reseller accounts" };
  }
  if (pathname.startsWith("/admin/dealers")) {
    return { title: "Dealers", subtitle: "Dealer accounts" };
  }
  if (pathname.startsWith("/admin/users")) {
    return { title: "Users", subtitle: "Manage and monitor all user accounts" };
  }
  if (pathname.startsWith("/admin/transactions")) {
    return { title: "Transactions", subtitle: "Track and manage credit ledger" };
  }
  if (pathname.startsWith("/admin/deductions")) {
    return { title: "Credit Deductions", subtitle: "Credits charged for each subscription length" };
  }
  if (pathname.startsWith("/admin/message")) {
    return { title: "Messages", subtitle: "Send messages to user devices (STB)" };
  }
  if (pathname.startsWith("/admin/tickets")) {
    return { title: "Support Tickets", subtitle: "Manage customer support requests" };
  }
  if (pathname.startsWith("/admin/reports")) {
    return { title: "Reports", subtitle: "Analytics and insights" };
  }
  if (pathname.startsWith("/admin/settings")) {
    return { title: "Settings", subtitle: "System configuration" };
  }
  if (pathname.startsWith("/admin/bonus-rules")) {
    return { title: "Bonus rules", subtitle: "Promo 1 & Promo 2 tier configuration" };
  }
  if (pathname.startsWith("/admin/profile")) {
    return { title: "My profile", subtitle: "Account" };
  }
  return { title: "Admin", subtitle: "Billing panel" };
}

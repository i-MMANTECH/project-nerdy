export type NavKey =
  | "dashboard"
  | "managers"
  | "users"
  | "transactions"
  | "deductions"
  | "message"
  | "tickets"
  | "reports"
  | "settings";

export const adminNav: { key: NavKey; href: string; label: string }[] = [
  { key: "dashboard", href: "/admin/dashboard", label: "Dashboard" },
  { key: "managers", href: "/admin/managers", label: "Resellers" },
  { key: "users", href: "/admin/users", label: "Users" },
  { key: "transactions", href: "/admin/transactions", label: "Transactions" },
  { key: "deductions", href: "/admin/deductions", label: "Credit Deductions" },
  { key: "message", href: "/admin/message", label: "Messages" },
  { key: "tickets", href: "/admin/tickets/dashboard", label: "Tickets" },
  { key: "reports", href: "/admin/reports", label: "Reports" },
  { key: "settings", href: "/admin/settings", label: "Settings" },
];

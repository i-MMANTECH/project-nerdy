import { Search } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminTransactionsClient } from "@/components/admin/AdminTransactionsClient";
import { getCreditFlowByDayForUsername, getOperatorTransactions } from "@/lib/data";
import type { PortalBase } from "@/lib/portal-nav";

export async function OperatorTransactionsPage({
  portalBase,
  operatorUsername,
}: {
  portalBase: PortalBase;
  operatorUsername: string;
}) {
  const u = operatorUsername.trim();
  const [rows, creditFlow] = await Promise.all([
    u ? getOperatorTransactions(u).catch(() => []) : Promise.resolve([]),
    u ? getCreditFlowByDayForUsername(u, 366).catch(() => []) : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto w-full max-w-[min(100%,1920px)] space-y-6 pb-10">
      <PageHeader
        title="Transactions"
        breadcrumb="Home › Transactions"
        showBack={false}
        actions={
          <form action={`${portalBase}/users`} method="get" className="w-full min-w-0 sm:max-w-md">
            <label className="sr-only" htmlFor="portal-txn-search">
              Search users
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                id="portal-txn-search"
                name="query"
                type="search"
                placeholder="Search users, MAC account…"
                className="h-10 w-full rounded-lg border border-border/80 bg-background/80 py-2 pl-10 pr-3 text-sm text-foreground shadow-inner outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </form>
        }
      />
      <AdminTransactionsClient rows={rows} creditFlow={creditFlow} />
    </div>
  );
}

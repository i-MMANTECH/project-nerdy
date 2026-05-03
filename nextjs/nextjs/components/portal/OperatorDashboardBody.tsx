import Link from "next/link";
import { Store, TrendingUp, UserCheck, UserX, Users, Wallet } from "lucide-react";
import { CreditFlowBarChart, StatusMixPieChart, SubscriberGrowthChart } from "@/components/dashboard/DashboardCharts";
import { buildStatusSlices } from "@/components/dashboard/dashboard-status";
import { StatInsightCard } from "@/components/dashboard/StatInsightCard";
import type { DashboardDayCreditPoint, DashboardMonthPoint, OperatorDashboardStats } from "@/lib/repos/billing";

export function OperatorDashboardBody({
  portal,
  portalBase,
  displayName,
  stats,
  charts,
}: {
  portal: "MNGR" | "SRSLR" | "RSLR";
  portalBase: "/manager" | "/reseller" | "/dealer";
  displayName: string;
  stats: OperatorDashboardStats;
  charts: {
    monthlySignups: DashboardMonthPoint[];
    creditFlow: DashboardDayCreditPoint[];
  };
}) {
  const usersBase = `${portalBase}/users`;
  const statusSlices = buildStatusSlices({
    active: stats.activeAccounts,
    expired: stats.expiredAccounts,
    inactive: stats.inactiveAccounts,
  });

  const portalLabel = portal === "MNGR" ? "Manager" : portal === "SRSLR" ? "Reseller" : "Dealer";

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-primary/[0.05] p-5 shadow-sm sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" aria-hidden />
        <div className="relative space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">{portalLabel} portal</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Hello, {displayName}</h1>
          <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
            Here is what matters today: credits, user health, and recent activity. Use the shortcuts on each card to drill in.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Link
              href={usersBase}
              className="inline-flex min-h-10 items-center rounded-lg border border-border bg-background/80 px-3 text-sm font-medium transition hover:border-primary/40 hover:bg-primary/5"
            >
              All users
            </Link>
            <Link
              href={`${portalBase}/transactions`}
              className="inline-flex min-h-10 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              Transactions
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="op-kpis">
        <h2 id="op-kpis" className="sr-only">
          Key metrics
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatInsightCard
            title="Credits remaining"
            value={stats.balance}
            hint="Your billing balance"
            icon={Wallet}
            href={`${portalBase}/transactions`}
            accent="primary"
          />

          {portal === "MNGR" ? (
            <>
              <StatInsightCard
                title="Total users"
                value={stats.totalAccounts}
                hint="Across your tree"
                icon={Users}
                href={usersBase}
                accent="accent"
              />
              <StatInsightCard
                title="Resellers"
                value={stats.resellerCount ?? 0}
                hint="SRSLR under you"
                icon={TrendingUp}
                accent="muted"
              />
              <StatInsightCard
                title="Dealers"
                value={stats.dealerCount ?? 0}
                hint="RSLR in scope"
                icon={Store}
                accent="muted"
              />
            </>
          ) : null}

          {portal === "SRSLR" ? (
            <>
              <StatInsightCard
                title="Active users"
                value={stats.activeAccounts}
                hint="Status on"
                icon={UserCheck}
                href={`${usersBase}?status=active`}
                accent="accent"
              />
              <StatInsightCard
                title="Expired"
                value={stats.expiredAccounts}
                hint="Renewal candidates"
                icon={UserX}
                href={`${usersBase}?status=expired`}
                accent="danger"
              />
              <StatInsightCard
                title="Dealers"
                value={stats.dealerCount ?? 0}
                hint="RSLR logins"
                icon={Store}
                accent="muted"
              />
            </>
          ) : null}

          {portal === "RSLR" ? (
            <>
              <StatInsightCard
                title="Total users"
                value={stats.totalAccounts}
                hint="Your accounts"
                icon={Users}
                href={usersBase}
                accent="accent"
              />
              <StatInsightCard
                title="Active"
                value={stats.activeAccounts}
                hint="Status on"
                icon={UserCheck}
                href={`${usersBase}?status=active`}
                accent="muted"
              />
              <StatInsightCard
                title="Expired"
                value={stats.expiredAccounts}
                hint="Past expiry"
                icon={UserX}
                href={`${usersBase}?status=expired`}
                accent="danger"
              />
            </>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3" aria-labelledby="op-charts">
        <h2 id="op-charts" className="sr-only">
          Trends
        </h2>
        <div className="lg:col-span-2">
          <SubscriberGrowthChart data={charts.monthlySignups} title="New users in your scope" />
        </div>
        <StatusMixPieChart data={statusSlices} title="User status" />
        <div className="lg:col-span-3">
          <CreditFlowBarChart data={charts.creditFlow} title="Your credit activity (14 days)" />
        </div>
      </section>
    </div>
  );
}

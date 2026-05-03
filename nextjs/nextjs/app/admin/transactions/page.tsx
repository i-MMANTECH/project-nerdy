import { getCreditFlowByDayForUsername, getTransactions } from "@/lib/data";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminTransactionsClient } from "@/components/admin/AdminTransactionsClient";
import { getSession } from "@/lib/session";

export default async function TransactionsPage() {
  const session = await getSession();
  const username = session?.username ?? "";

  const [rows, creditFlow] = await Promise.all([
    getTransactions(),
    username ? getCreditFlowByDayForUsername(username, 366).catch(() => []) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-5 pb-10">
      <PageHeader title="Transactions" breadcrumb="Home › Transactions" />
      <AdminTransactionsClient rows={rows} creditFlow={creditFlow} />
    </div>
  );
}

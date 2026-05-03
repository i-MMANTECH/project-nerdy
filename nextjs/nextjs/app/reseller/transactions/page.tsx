import { redirect } from "next/navigation";
import { OperatorTransactionsPage } from "@/components/portal/OperatorTransactionsPage";
import { getSession } from "@/lib/session";

export default async function ResellerTransactionsPage() {
  const s = await getSession();
  if (!s || s.type !== "SRSLR") redirect("/login?error=forbidden");
  return <OperatorTransactionsPage portalBase="/reseller" operatorUsername={s.username} />;
}

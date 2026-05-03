import { redirect } from "next/navigation";
import { OperatorTransactionsPage } from "@/components/portal/OperatorTransactionsPage";
import { getSession } from "@/lib/session";

export default async function ManagerTransactionsPage() {
  const s = await getSession();
  if (!s || s.type !== "MNGR") redirect("/login?error=forbidden");
  return <OperatorTransactionsPage portalBase="/manager" operatorUsername={s.username} />;
}

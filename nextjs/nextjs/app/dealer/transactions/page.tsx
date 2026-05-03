import { redirect } from "next/navigation";
import { OperatorTransactionsPage } from "@/components/portal/OperatorTransactionsPage";
import { getSession } from "@/lib/session";

export default async function DealerTransactionsPage() {
  const s = await getSession();
  if (!s || s.type !== "RSLR") redirect("/login?error=forbidden");
  return <OperatorTransactionsPage portalBase="/dealer" operatorUsername={s.username} />;
}

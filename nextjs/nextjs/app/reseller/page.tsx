import { redirect } from "next/navigation";
import { OperatorDashboardPage } from "@/components/portal/OperatorDashboardPage";
import { getSession } from "@/lib/session";

export default async function ResellerDashboardPage() {
  const s = await getSession();
  if (!s || s.type !== "SRSLR") redirect("/login?error=forbidden");
  return (
    <OperatorDashboardPage
      ownerType="SRSLR"
      portalBase="/reseller"
      operatorUsername={s.username}
    />
  );
}

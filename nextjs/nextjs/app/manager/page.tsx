import { redirect } from "next/navigation";
import { OperatorDashboardPage } from "@/components/portal/OperatorDashboardPage";
import { getSession } from "@/lib/session";

export default async function ManagerDashboardPage() {
  const s = await getSession();
  if (!s || s.type !== "MNGR") redirect("/login?error=forbidden");
  return (
    <OperatorDashboardPage
      ownerType="MNGR"
      portalBase="/manager"
      operatorUsername={s.username}
    />
  );
}

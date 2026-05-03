import { redirect } from "next/navigation";
import { OperatorDashboardPage } from "@/components/portal/OperatorDashboardPage";
import { getSession } from "@/lib/session";

export default async function DealerDashboardPage() {
  const s = await getSession();
  if (!s || s.type !== "RSLR") redirect("/login?error=forbidden");
  return (
    <OperatorDashboardPage
      ownerType="RSLR"
      portalBase="/dealer"
      operatorUsername={s.username}
    />
  );
}

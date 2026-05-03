import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { ManagerDealersPage } from "@/components/portal/ManagerDealersPage";

export default async function ManagerDealersRoute({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session || session.type !== "MNGR") redirect("/login?error=forbidden");

  const sp = (await searchParams) ?? {};
  return <ManagerDealersPage managerUsername={session.username} searchParams={sp} />;
}

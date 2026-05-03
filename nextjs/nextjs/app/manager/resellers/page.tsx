import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { ManagerResellersPage } from "@/components/portal/ManagerResellersPage";

export default async function ManagerResellersRoute({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session || session.type !== "MNGR") redirect("/login?error=forbidden");

  const sp = (await searchParams) ?? {};
  return <ManagerResellersPage managerUsername={session.username} searchParams={sp} />;
}

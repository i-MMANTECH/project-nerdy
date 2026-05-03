import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { ResellerDealersPage } from "@/components/portal/ResellerDealersPage";

export default async function ResellerDealersRoute({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session || session.type !== "SRSLR") redirect("/login?error=forbidden");

  const sp = (await searchParams) ?? {};
  return <ResellerDealersPage resellerUsername={session.username} searchParams={sp} />;
}

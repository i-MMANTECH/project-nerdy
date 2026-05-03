import { redirect } from "next/navigation";
import { OperatorCheckMacPage } from "@/components/portal/OperatorCheckMacPage";
import { getSession } from "@/lib/session";

type Props = {
  searchParams?: Promise<{ out?: string; expired?: string; e?: string }>;
};

export default async function ManagerCheckMacPage({ searchParams }: Props) {
  const s = await getSession();
  if (!s || s.type !== "MNGR") redirect("/login?error=forbidden");
  const sp = (await searchParams) ?? {};
  return <OperatorCheckMacPage portalBase="/manager" ownerType="MNGR" searchParams={sp} />;
}

import { redirect } from "next/navigation";
import { OperatorMessagesPage } from "@/components/portal/OperatorMessagesPage";
import { getSession } from "@/lib/session";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ManagerMessagePage({ searchParams }: Props) {
  const s = await getSession();
  if (!s || s.type !== "MNGR") redirect("/login?error=forbidden");
  const sp = (await searchParams) ?? {};
  return (
    <OperatorMessagesPage
      portalBase="/manager"
      ownerType="MNGR"
      operatorUsername={s.username}
      displayName={s.displayName ?? s.username}
      searchParams={sp}
    />
  );
}

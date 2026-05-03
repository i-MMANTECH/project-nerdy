import { redirect } from "next/navigation";
import { OperatorSubscribersPage } from "@/components/portal/OperatorSubscribersPage";
import { getSession } from "@/lib/session";

type Props = {
  searchParams?: Promise<{
    query?: string;
    reseller?: string;
    dealer?: string;
    ok?: string;
    error?: string;
    bal?: string;
    req?: string;
    renew_acc?: string;
    status?: string;
    page?: string;
    pageSize?: string;
    sort?: string;
    dir?: string;
  }>;
};

export default async function ManagerUsersPage({ searchParams }: Props) {
  const s = await getSession();
  if (!s || s.type !== "MNGR") redirect("/login?error=forbidden");
  const sp = (await searchParams) ?? {};
  return (
    <OperatorSubscribersPage
      ownerType="MNGR"
      portalBase="/manager"
      usersPath="/manager/users"
      operatorUsername={s.username}
      searchParams={sp}
    />
  );
}

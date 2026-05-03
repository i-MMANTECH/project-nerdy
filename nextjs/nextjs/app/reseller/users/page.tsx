import { redirect } from "next/navigation";
import { OperatorSubscribersPage } from "@/components/portal/OperatorSubscribersPage";
import { getSession } from "@/lib/session";

type Props = {
  searchParams?: Promise<{
    query?: string;
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

export default async function ResellerUsersPage({ searchParams }: Props) {
  const s = await getSession();
  if (!s || s.type !== "SRSLR") redirect("/login?error=forbidden");
  const sp = (await searchParams) ?? {};
  return (
    <OperatorSubscribersPage
      ownerType="SRSLR"
      portalBase="/reseller"
      usersPath="/reseller/users"
      operatorUsername={s.username}
      searchParams={sp}
    />
  );
}

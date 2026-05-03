import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { managerOwnsDealer } from "@/lib/data";
import { OperatorSubscribersPage } from "@/components/portal/OperatorSubscribersPage";

type Props = {
  params: Promise<{ username: string }>;
  searchParams?: Promise<{
    query?: string;
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

export default async function ManagerDealerUsersPage({ params, searchParams }: Props) {
  const s = await getSession();
  if (!s || s.type !== "MNGR") redirect("/login?error=forbidden");

  const { username: raw } = await params;
  const dealerLogin = decodeURIComponent(raw);
  if (!(await managerOwnsDealer(s.username, dealerLogin))) {
    redirect("/manager/dealers?error=forbidden");
  }

  const sp = (await searchParams) ?? {};
  const usersPath = `/manager/dealers/${encodeURIComponent(dealerLogin)}/users`;

  return (
    <OperatorSubscribersPage
      ownerType="MNGR"
      portalBase="/manager"
      usersPath={usersPath}
      operatorUsername={s.username}
      searchParams={sp}
      dealerLoginFixed={dealerLogin}
      newSubscriberHref={`${usersPath}/new`}
    />
  );
}

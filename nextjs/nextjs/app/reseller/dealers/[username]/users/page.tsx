import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { resellerOwnsDealer } from "@/lib/data";
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

export default async function ResellerDealerUsersPage({ params, searchParams }: Props) {
  const s = await getSession();
  if (!s || s.type !== "SRSLR") redirect("/login?error=forbidden");

  const { username: raw } = await params;
  const dealerLogin = decodeURIComponent(raw);
  if (!(await resellerOwnsDealer(s.username, dealerLogin))) {
    redirect("/reseller/dealers?error=forbidden");
  }

  const sp = (await searchParams) ?? {};
  const usersPath = `/reseller/dealers/${encodeURIComponent(dealerLogin)}/users`;

  return (
    <OperatorSubscribersPage
      ownerType="SRSLR"
      portalBase="/reseller"
      usersPath={usersPath}
      operatorUsername={s.username}
      searchParams={sp}
      dealerLoginFixed={dealerLogin}
      newSubscriberHref={`${usersPath}/new`}
    />
  );
}

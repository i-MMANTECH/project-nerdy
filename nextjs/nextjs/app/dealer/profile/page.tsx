import { redirect } from "next/navigation";
import { OperatorProfilePage } from "@/components/portal/OperatorProfilePage";
import { getSession } from "@/lib/session";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DealerProfilePage({ searchParams }: Props) {
  const s = await getSession();
  if (!s || s.type !== "RSLR") redirect("/login?error=forbidden");
  const sp = (await searchParams) ?? {};
  return (
    <OperatorProfilePage
      portalBase="/dealer"
      username={s.username}
      displayName={s.displayName ?? s.username}
      searchParams={sp}
    />
  );
}

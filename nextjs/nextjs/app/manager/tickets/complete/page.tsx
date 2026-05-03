import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { PortalTicketsList } from "@/components/portal/PortalTicketsList";
import { portalTicketListFlashItems } from "@/lib/urlFlashToasts";

type Props = { searchParams?: Promise<{ ok?: string; error?: string }> };

export default async function ManagerTicketsCompletePage({ searchParams }: Props) {
  const s = await getSession();
  if (!s || s.type !== "MNGR") redirect("/login?next=/manager/tickets/complete");

  const sp = (await searchParams) ?? {};
  const flashItems = portalTicketListFlashItems(sp);

  return (
    <PortalTicketsList portalBase="/manager" role="MNGR" username={s.username} filter="completed" flashItems={flashItems} />
  );
}

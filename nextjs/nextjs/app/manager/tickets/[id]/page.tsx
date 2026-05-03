import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { PortalTicketDetail } from "@/components/portal/PortalTicketDetail";
import { ticketDetailFlashItems } from "@/lib/urlFlashToasts";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ ok?: string; error?: string }>;
};

export default async function ManagerTicketDetailPage({ params, searchParams }: Props) {
  const s = await getSession();
  if (!s || s.type !== "MNGR") redirect("/login?next=/manager/tickets");

  const { id: rawId } = await params;
  const ticketId = Number(decodeURIComponent(rawId));
  if (!Number.isFinite(ticketId) || ticketId <= 0) redirect("/manager/tickets?error=ticket");

  const sp = (await searchParams) ?? {};
  const flashItems = ticketDetailFlashItems(sp);

  return (
    <PortalTicketDetail
      portalBase="/manager"
      role="MNGR"
      username={s.username}
      ticketId={ticketId}
      flashItems={flashItems}
    />
  );
}

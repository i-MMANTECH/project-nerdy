import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { PortalTicketDetail } from "@/components/portal/PortalTicketDetail";
import { ticketDetailFlashItems } from "@/lib/urlFlashToasts";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ ok?: string; error?: string }>;
};

export default async function DealerTicketDetailPage({ params, searchParams }: Props) {
  const s = await getSession();
  if (!s || s.type !== "RSLR") redirect("/login?next=/dealer/tickets");

  const { id: rawId } = await params;
  const ticketId = Number(decodeURIComponent(rawId));
  if (!Number.isFinite(ticketId) || ticketId <= 0) redirect("/dealer/tickets?error=ticket");

  const sp = (await searchParams) ?? {};
  const flashItems = ticketDetailFlashItems(sp);

  return (
    <PortalTicketDetail
      portalBase="/dealer"
      role="RSLR"
      username={s.username}
      ticketId={ticketId}
      flashItems={flashItems}
    />
  );
}

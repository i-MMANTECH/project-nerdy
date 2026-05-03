import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { PortalTicketsCreate } from "@/components/portal/PortalTicketsCreate";
import { portalTicketCreateFlashItems } from "@/lib/urlFlashToasts";

type Props = { searchParams?: Promise<{ error?: string }> };

export default async function ManagerTicketsCreatePage({ searchParams }: Props) {
  const s = await getSession();
  if (!s || s.type !== "MNGR") redirect("/login?next=/manager/tickets/create");

  const sp = (await searchParams) ?? {};
  const flashItems = portalTicketCreateFlashItems(sp);

  return <PortalTicketsCreate flashItems={flashItems} />;
}

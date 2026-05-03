import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { PortalTicketsDashboard } from "@/components/portal/PortalTicketsDashboard";

type Props = {
  searchParams?: Promise<{ q?: string; status?: string; priority?: string; sort?: string }>;
};

export default async function ManagerTicketsDashboardPage({ searchParams }: Props) {
  const s = await getSession();
  if (!s || s.type !== "MNGR") redirect("/login?next=/manager/tickets/dashboard");
  const sp = (await searchParams) ?? {};

  return <PortalTicketsDashboard portalBase="/manager" filters={sp} viewer={{ type: s.type, username: s.username }} />;
}

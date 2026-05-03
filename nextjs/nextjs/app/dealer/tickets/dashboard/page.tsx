import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { PortalTicketsDashboard } from "@/components/portal/PortalTicketsDashboard";

type Props = {
  searchParams?: Promise<{ q?: string; status?: string; priority?: string; sort?: string }>;
};

export default async function DealerTicketsDashboardPage({ searchParams }: Props) {
  const s = await getSession();
  if (!s || s.type !== "RSLR") redirect("/login?next=/dealer/tickets/dashboard");
  const sp = (await searchParams) ?? {};

  return <PortalTicketsDashboard portalBase="/dealer" filters={sp} viewer={{ type: s.type, username: s.username }} />;
}

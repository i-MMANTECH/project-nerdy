import { redirect } from "next/navigation";
import { AdminTicketsListView } from "@/components/admin/AdminTicketsListView";
import type { AdminActiveTicketStatusFilter } from "@/lib/repos/tickets";

type Props = { searchParams?: Promise<{ ok?: string; error?: string; filter?: string; status?: string }> };

function parseActiveOpenStatus(raw: string | undefined): AdminActiveTicketStatusFilter | undefined {
  const s = raw?.trim().toLowerCase();
  if (s === "1") return 1;
  if (s === "3") return 3;
  if (s === "other") return "other";
  return undefined;
}

export default async function TicketsPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  if (sp.filter === "completed") {
    const q = new URLSearchParams();
    if (sp.ok) q.set("ok", sp.ok);
    if (sp.error) q.set("error", sp.error);
    const suffix = q.toString() ? `?${q.toString()}` : "";
    redirect(`/admin/tickets/complete${suffix}`);
  }

  const activeOpenStatus = parseActiveOpenStatus(sp.status);

  return <AdminTicketsListView filter="active" flash={sp} activeOpenStatus={activeOpenStatus} />;
}

import { AdminTicketsListView } from "@/components/admin/AdminTicketsListView";

type Props = { searchParams?: Promise<{ ok?: string; error?: string }> };

/** PHP `admin/Tickets::complete` — completed tickets list at `/admin/tickets/complete`. */
export default async function AdminTicketsCompletePage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  return <AdminTicketsListView filter="completed" flash={sp} />;
}

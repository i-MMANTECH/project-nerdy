import { redirect } from "next/navigation";
import { getSession, homePathForUserType } from "@/lib/session";
import { Footer } from "@/components/admin/Footer";
import { AppMain } from "@/components/layout/app-main";
import { AdminAppHeader } from "@/components/layout/AdminAppHeader";
import { AdminMobileNav } from "@/components/layout/AdminMobileNav";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { countOpenTicketsForPortalUser, listRecentOpenTicketsForPortalUser, statusLabel } from "@/lib/repos/tickets";

export default async function DealerLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/dealer");
  if (session.type !== "RSLR") {
    const home = homePathForUserType(session.type);
    redirect(home ?? "/login?error=forbidden");
  }

  let notificationCount = 0;
  let ticketPreview: { id: number; subject: string; statusLabel: string }[] = [];
  try {
    const [count, rows] = await Promise.all([
      countOpenTicketsForPortalUser(session.username, "RSLR"),
      listRecentOpenTicketsForPortalUser(session.username, "RSLR", 8),
    ]);
    notificationCount = count;
    ticketPreview = rows.map((r) => ({
      id: r.id,
      subject: r.subject,
      statusLabel: statusLabel(r.status_id),
    }));
  } catch {
    notificationCount = 0;
    ticketPreview = [];
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20 lg:pb-0">
      <AdminSidebar session={session} portalBase="/dealer" />
      <AdminMobileNav portalBase="/dealer" />
      <div className="flex min-h-screen flex-col lg:ml-64">
        <AdminAppHeader
          session={session}
          openTicketCount={notificationCount}
          portalBase="/dealer"
          notificationsHref="/dealer/tickets"
          ticketPreview={ticketPreview}
        />
        <AppMain>{children}</AppMain>
        <Footer />
      </div>
    </div>
  );
}

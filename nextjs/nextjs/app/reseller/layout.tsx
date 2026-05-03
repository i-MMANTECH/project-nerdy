import { redirect } from "next/navigation";
import { getSession, homePathForUserType } from "@/lib/session";
import { Footer } from "@/components/admin/Footer";
import { AppMain } from "@/components/layout/app-main";
import { AdminAppHeader } from "@/components/layout/AdminAppHeader";
import { AdminMobileNav } from "@/components/layout/AdminMobileNav";
import { AdminSidebar } from "@/components/layout/AdminSidebar";

export default async function ResellerLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/reseller");
  if (session.type !== "SRSLR") {
    const home = homePathForUserType(session.type);
    redirect(home ?? "/login?error=forbidden");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20 lg:pb-0">
      <AdminSidebar session={session} portalBase="/reseller" />
      <AdminMobileNav portalBase="/reseller" />
      <div className="flex min-h-screen flex-col lg:ml-64">
        <AdminAppHeader
          session={session}
          openTicketCount={0}
          portalBase="/reseller"
          notificationsHref="/reseller/message"
          notificationLabel="Messages"
        />
        <AppMain>{children}</AppMain>
        <Footer />
      </div>
    </div>
  );
}

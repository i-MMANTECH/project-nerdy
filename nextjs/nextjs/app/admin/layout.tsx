import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_LOGIN_NEXT_HEADER } from "@/lib/billingCookies";
import { getSession, homePathForUserType } from "@/lib/session";

/** Session + DB reads in this tree must not be statically cached (avoids RSC / cookie edge cases on Vercel). */
export const dynamic = "force-dynamic";
import { AppMain } from "@/components/layout/app-main";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { AdminMobileNav } from "@/components/layout/AdminMobileNav";
import { AdminAppHeader } from "@/components/layout/AdminAppHeader";
import { CommandPalette } from "@/components/admin/CommandPalette";
import { OnboardingTour } from "@/components/admin/OnboardingTour";
import { MeshBackdrop } from "@/components/hud/MeshBackdrop";
import { DEFAULT_ADMIN_NOTIFICATION_PREFS, getAdminNotificationPrefs } from "@/lib/data";
import { countOpenTicketsForAdmin, listRecentOpenTicketsForAdmin, statusLabel } from "@/lib/repos/tickets";

function safeAdminLoginNext(raw: string | null): string | null {
  const next = raw?.trim() ?? "";
  if (!next.startsWith("/admin") || next.startsWith("//") || next.includes("..")) return null;
  return next;
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    const next = safeAdminLoginNext((await headers()).get(ADMIN_LOGIN_NEXT_HEADER));
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }
  if (session.type !== "ROOT") {
    const home = homePathForUserType(session.type);
    redirect(home ?? "/login?error=forbidden");
  }

  const notifyPrefs = await getAdminNotificationPrefs().catch(() => DEFAULT_ADMIN_NOTIFICATION_PREFS);
  let openTicketCount = 0;
  if (notifyPrefs.notifyNewTickets) {
    try {
      openTicketCount = await countOpenTicketsForAdmin();
    } catch {
      openTicketCount = 0;
    }
  }

  let ticketPreview: { id: number; subject: string; statusLabel: string }[] = [];
  try {
    const rows = await listRecentOpenTicketsForAdmin(8);
    ticketPreview = rows.map((r) => ({
      id: r.id,
      subject: r.subject,
      statusLabel: statusLabel(r.status_id),
    }));
  } catch {
    ticketPreview = [];
  }

  return (
    <div className="relative isolate flex min-h-screen flex-col bg-background pb-20 lg:pb-0">
      {/* Sunset mesh-gradient backdrop — three drifting radial orbs, GPU-only. */}
      <MeshBackdrop />

      <AdminSidebar session={session} />
      <AdminMobileNav />
      <div className="flex min-h-screen flex-col lg:ml-64">
        <AdminAppHeader session={session} openTicketCount={openTicketCount} ticketPreview={ticketPreview} />
        <AppMain>{children}</AppMain>
      </div>

      {/* Global power-user features — render once, available everywhere. */}
      <CommandPalette />
      <OnboardingTour />
    </div>
  );
}

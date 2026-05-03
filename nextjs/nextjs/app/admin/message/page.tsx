import { Suspense } from "react";
import type { FlashToastItem } from "@/components/FlashToasts";
import { FlashToastsBoundary } from "@/components/FlashToasts";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminMessagesScreen } from "@/components/admin/AdminMessagesScreen";
import {
  countStalkerUsers,
  getAdminMessageAudiencePreviewCounts,
  getAdminMessageRoleCounts,
  getAdminStalkerMessageDashboardStats,
  listAdminRecentStalkerSendMessages,
  listStalkerUsersForMessageSelect,
} from "@/lib/data";
import { getSession } from "@/lib/session";

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

export default async function MessagePage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const initialTab = "history";
  const session = await getSession();
  const sentByLabel = session?.displayName?.trim() || session?.username || "admin";

  const [stalkerUsers, stalkerUserTotal, recent, audiencePreview, roleCounts, stats] = await Promise.all([
    listStalkerUsersForMessageSelect(),
    countStalkerUsers(),
    listAdminRecentStalkerSendMessages(0).catch(() => []),
    getAdminMessageAudiencePreviewCounts().catch(() => ({
      all: 0,
      active: 0,
      expired: 0,
      expiring: 0,
      inactive: 0,
      managers: 0,
      resellers: 0,
    })),
    getAdminMessageRoleCounts().catch(() => ({ admin: 1, manager: 0, reseller: 0, dealer: 0 })),
    getAdminStalkerMessageDashboardStats().catch(() => ({
      sendsToday: 0,
      recipients30d: 0,
      deliveryPct: null,
      deliveryPending: false,
    })),
  ]);

  const errCode = Array.isArray(sp.error) ? sp.error[0] : sp.error;
  const err =
    errCode === "empty"
      ? "Message is required."
      : errCode === "events_table"
        ? "This Stalker database has no `events` table (Ministra stores device messages there). Point STALKER_DATABASE_* at a full Stalker schema, or create the `events` table."
        : errCode === "stalker"
          ? "Configure Stalker DB env (STALKER_DATABASE_*), or no messages were queued (e.g. no Stalker users, or all inserts failed)."
          : errCode === "none_selected"
            ? "Choose at least one Stalker user when using custom selection."
            : errCode === "no_recipients"
              ? "No Stalker devices matched this audience (e.g. no billing login maps to a Stalker user for the selected filter)."
              : null;

  const okVal = Array.isArray(sp.ok) ? sp.ok[0] : sp.ok;
  const messageFlashes: FlashToastItem[] = [
    ...(okVal
      ? [
          {
            type: "success" as const,
            message: "Message queued",
            description: "Devices receive it on their next poll (Ministra / STB).",
          },
        ]
      : []),
    ...(err ? [{ type: "error" as const, message: err }] : []),
  ];

  return (
    <div className="space-y-6">
      {messageFlashes.length ? (
        <FlashToastsBoundary items={messageFlashes} stripParams={["ok", "error", "account", "accounts"]} />
      ) : null}
      <PageHeader title={initialTab === "history" ? "Recent messages" : "Messages"} breadcrumb="Home › Messages" />
      <Suspense
        fallback={
          <div className="w-full space-y-4" aria-busy="true">
            <div className="h-24 animate-pulse rounded-2xl bg-muted/25" />
            <div className="h-[min(28rem,55vh)] animate-pulse rounded-2xl bg-muted/20" />
          </div>
        }
      >
        <AdminMessagesScreen
          stalkerUsers={stalkerUsers}
          stalkerUserTotal={stalkerUserTotal}
          audiencePreview={audiencePreview}
          roleCounts={roleCounts}
          stats={stats}
          recent={recent}
          sentByLabel={sentByLabel}
        />
      </Suspense>
    </div>
  );
}

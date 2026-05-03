import Link from "next/link";
import { Suspense } from "react";
import { Search } from "lucide-react";
import type { FlashToastItem } from "@/components/FlashToasts";
import { FlashToastsBoundary } from "@/components/FlashToasts";
import { PageHeader } from "@/components/admin/PageHeader";
import { PortalMessagesScreen } from "@/components/portal/PortalMessagesScreen";
import {
  getOperatorMessageAudiencePreviewCounts,
  getOperatorStalkerMessageDashboardStats,
  listOperatorRecentStalkerSendMessages,
  listStalkerUsersForMessageSelectScoped,
} from "@/lib/data";
import type { PortalBase } from "@/lib/portal-nav";

type OwnerType = "MNGR" | "SRSLR" | "RSLR";

function firstString(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export async function OperatorMessagesPage({
  portalBase,
  ownerType,
  operatorUsername,
  displayName,
  searchParams: sp,
}: {
  portalBase: PortalBase;
  ownerType: OwnerType;
  operatorUsername: string;
  displayName: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const tabParam = firstString(sp.tab);
  const initialTab = tabParam === "history" ? "history" : "compose";
  const who = displayName?.trim() || operatorUsername;
  const u = operatorUsername.trim();

  const [stalkerUsers, audiencePreview, stats, recent] = await Promise.all([
    listStalkerUsersForMessageSelectScoped({ ownerType, ownerUsername: u }).catch(() => []),
    getOperatorMessageAudiencePreviewCounts({ ownerType, ownerUsername: u }).catch(() => ({
      all: 0,
      active: 0,
      expired: 0,
      expiring: 0,
      inactive: 0,
      managers: 0,
      resellers: 0,
    })),
    getOperatorStalkerMessageDashboardStats({ ownerType, ownerUsername: u }).catch(() => ({
      sendsToday: 0,
      recipients30d: 0,
      deliveryPct: null as number | null,
      deliveryPending: false,
    })),
    listOperatorRecentStalkerSendMessages({ ownerType, ownerUsername: u }, 30).catch(() => []),
  ]);

  const errCode = firstString(sp.error);
  const err =
    errCode === "empty"
      ? "Message is required."
      : errCode === "events_table"
        ? "This Stalker database has no `events` table (Ministra stores device messages there). Point STALKER_DATABASE_* at a full Stalker schema, or create the `events` table."
        : errCode === "stalker"
          ? "Configure Stalker DB env (STALKER_DATABASE_*), or no messages were queued (e.g. no Stalker users, or all inserts failed)."
          : errCode === "none_selected"
            ? "Choose at least one customer when using custom selection."
            : errCode === "no_recipients"
              ? "No Stalker devices matched this audience."
              : null;

  const okVal = firstString(sp.ok);
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
    <div className="mx-auto w-full max-w-[min(100%,1920px)] space-y-5 pb-10">
      {messageFlashes.length ? (
        <FlashToastsBoundary items={messageFlashes} stripParams={["ok", "error", "account", "accounts"]} />
      ) : null}
      <PageHeader
        title={initialTab === "history" ? "Recent messages" : "Messages"}
        breadcrumb={
          <nav className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5" aria-label="Breadcrumb">
            <Link href={portalBase} className="text-primary hover:underline">
              Dashboard
            </Link>
            <span aria-hidden className="text-border">
              /
            </span>
            {initialTab === "history" ? (
              <>
                <Link href={`${portalBase}/message`} className="text-primary hover:underline">
                  Messages
                </Link>
                <span aria-hidden className="text-border">
                  /
                </span>
                <span className="font-medium text-foreground">Recent</span>
              </>
            ) : (
              <span className="font-medium text-foreground">Messages</span>
            )}
          </nav>
        }
        showBack={false}
        actions={
          <form action={`${portalBase}/users`} method="get" className="w-full min-w-0 sm:max-w-md">
            <label className="sr-only" htmlFor="portal-msg-global-search">
              Search subscribers
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                id="portal-msg-global-search"
                name="query"
                type="search"
                placeholder="Search subscribers, MAC account…"
                className="h-10 w-full rounded-lg border border-border/80 bg-background/80 py-2 pl-10 pr-3 text-sm text-foreground shadow-inner outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </form>
        }
      />
      <p className="text-sm text-muted-foreground">Send messages to subscriber devices (STB). Signed in as {who}.</p>

      <Suspense
        fallback={
          <div className="mx-auto max-w-6xl space-y-4" aria-busy="true">
            <div className="h-24 animate-pulse rounded-2xl bg-muted/25" />
            <div className="h-[min(28rem,55vh)] animate-pulse rounded-2xl bg-muted/20" />
          </div>
        }
      >
        <PortalMessagesScreen
          stalkerUsers={stalkerUsers}
          audiencePreview={audiencePreview}
          stats={stats}
          recent={recent}
          sentByLabel={who}
          portalBase={portalBase}
        />
      </Suspense>
    </div>
  );
}

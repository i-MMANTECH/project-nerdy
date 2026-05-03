import { Suspense } from "react";
import type { FlashToastItem } from "@/components/FlashToasts";
import { FlashToastsBoundary } from "@/components/FlashToasts";
import { getSettings } from "@/lib/data";
import { AdminSettingsView } from "@/components/admin/AdminSettingsView";
import { getTicketsDbHealth } from "@/lib/repos/tickets";

type Props = { searchParams?: Promise<{ ok?: string; error?: string }> };

export default async function SettingsPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  let settings: Awaited<ReturnType<typeof getSettings>> | undefined;
  let ticketsHealth: Awaited<ReturnType<typeof getTicketsDbHealth>> | undefined;
  let settingsLoadFailed = false;
  let settingsLoadMessage = "";
  try {
    [settings, ticketsHealth] = await Promise.all([getSettings(), getTicketsDbHealth()]);
  } catch (err) {
    console.error("[admin/settings] getSettings:", err);
    settingsLoadFailed = true;
    settingsLoadMessage =
      process.env.NODE_ENV === "development"
        ? err instanceof Error
          ? err.message
          : String(err)
        : "Could not read the `settings` / `configs` tables from MySQL. Confirm DATABASE_* on the server and that the billing schema is migrated.";
  }

  const settingsFlashes: FlashToastItem[] = [
    ...(sp.ok ? [{ type: "success" as const, message: "Saved." }] : []),
    ...(sp.error === "nosettings"
      ? [{ type: "error" as const, message: "No settings row found in MySQL." }]
      : []),
    ...(sp.error === "validation"
      ? [
          {
            type: "error" as const,
            message:
              "Check fields: title (3–50 characters), credit limits (1–2000), default PIN (4 digits), retry trial count (0 or more).",
          },
        ]
      : []),
    ...(sp.error === "match" ? [{ type: "error" as const, message: "New passwords do not match." }] : []),
    ...(sp.error === "old" ? [{ type: "error" as const, message: "Current password is incorrect." }] : []),
    ...(sp.error === "old_len"
      ? [{ type: "error" as const, message: "Current password must be between 3 and 100 characters." }]
      : []),
    ...(sp.error === "new_len"
      ? [{ type: "error" as const, message: "New password must be between 4 and 12 characters." }]
      : []),
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {settingsFlashes.length ? <FlashToastsBoundary items={settingsFlashes} stripParams={["ok", "error"]} /> : null}
      {settingsLoadFailed ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-4 text-sm text-foreground shadow-sm"
        >
          <p className="font-semibold text-destructive">Settings data unavailable</p>
          <p className="mt-2 leading-relaxed text-muted-foreground">{settingsLoadMessage}</p>
        </div>
      ) : settings ? (
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading settings…</p>}>
          <AdminSettingsView settings={settings} ticketsHealth={ticketsHealth} />
        </Suspense>
      ) : null}
    </div>
  );
}

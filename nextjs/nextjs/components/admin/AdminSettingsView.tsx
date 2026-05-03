"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Bell,
  Check,
  Copy,
  DollarSign,
  Globe,
  Lock,
  Mail,
  Megaphone,
  Palette,
  Type,
  KeyRound,
  Repeat2,
  X,
} from "lucide-react";
import { changePasswordAction, saveSettingsAction } from "@/actions/forms";
import type { SettingsBundle } from "@/lib/repos/billing";
import type { TicketsDbHealth } from "@/lib/repos/tickets";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import { HIERARCHY_ADD_CREDITS_MAX } from "@/lib/constants/hierarchyCredits";

const TABS = [
  { id: "general", label: "General" },
  { id: "announcement", label: "Announcement" },
  { id: "billing", label: "Billing" },
  { id: "notifications", label: "Notifications" },
  { id: "security", label: "Security" },
  { id: "appearance", label: "Appearance" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const TAB_SET = new Set<string>(TABS.map((t) => t.id));

const sectionKickerClass =
  "flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

const controlShellClass =
  "rounded-lg border border-input bg-input-background transition-[border-color,box-shadow] duration-200 ease-out focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40";

function tabFromSearch(raw: string | null): TabId {
  const t = (raw ?? "general").toLowerCase();
  return (TAB_SET.has(t) ? t : "general") as TabId;
}

function trialRetryDisplayValue(raw: string): string {
  const n = Number.parseInt(String(raw ?? "").trim(), 10);
  return Number.isFinite(n) && n >= 0 ? String(n) : "0";
}

type NotificationConfigKey =
  | "notify_expiring_subscriptions"
  | "notify_low_credit"
  | "notify_new_tickets"
  | "notify_device_offline";

function NotificationSwitchRow({
  name,
  title,
  description,
  defaultChecked,
}: {
  name: NotificationConfigKey;
  title: string;
  description: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg px-1 py-3.5 transition-[background-color] duration-200 hover:bg-muted/20 sm:items-center sm:py-4">
      <span className="min-w-0 space-y-1 pr-2">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="block text-xs leading-snug text-muted-foreground">{description}</span>
      </span>
      <span className="relative inline-flex h-6 w-10 shrink-0 items-center">
        <input
          type="checkbox"
          name={name}
          value="1"
          defaultChecked={defaultChecked}
          className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
        />
        <span
          className={cn(
            "pointer-events-none h-6 w-10 rounded-full bg-muted shadow-inner transition-[background-color] duration-200 ease-out",
            "peer-focus-visible:outline-none peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50",
            "peer-checked:bg-primary",
          )}
          aria-hidden
        />
        <span
          className={cn(
            "pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-out",
            "peer-checked:translate-x-4",
          )}
          aria-hidden
        />
      </span>
    </label>
  );
}

export function AdminSettingsView({ settings, ticketsHealth }: { settings: SettingsBundle; ticketsHealth?: TicketsDbHealth }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = useMemo(() => tabFromSearch(searchParams.get("tab")), [searchParams]);
  const formRef = useRef<HTMLFormElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ticketsHealthOpen, setTicketsHealthOpen] = useState(false);
  const [checksCopied, setChecksCopied] = useState(false);
  /** True only for the one programmatic submit after confirm — avoids sticky state if the form does not remount. */
  const allowRealSubmitRef = useRef(false);
  const pendingInvalidFocusRef = useRef<HTMLElement | null>(null);

  const setTab = (id: TabId) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", id);
    router.push(`/admin/settings?${next.toString()}`);
  };

  const jumpToInvalidField = () => {
    const form = formRef.current;
    if (!form) return false;
    const firstInvalid = form.querySelector<HTMLElement>(":invalid");
    if (!firstInvalid) return false;

    const panel = firstInvalid.closest<HTMLElement>("section[id^='settings-panel-']");
    const panelTab = panel?.id.replace("settings-panel-", "") as TabId | undefined;
    if (panelTab && panelTab !== tab) {
      pendingInvalidFocusRef.current = firstInvalid;
      setTab(panelTab);
    } else {
      window.requestAnimationFrame(() => {
        firstInvalid.focus({ preventScroll: false });
        firstInvalid.scrollIntoView({ block: "center", behavior: "smooth" });
        if (firstInvalid instanceof HTMLInputElement || firstInvalid instanceof HTMLTextAreaElement) {
          firstInvalid.reportValidity();
        }
      });
    }

    return true;
  };

  useEffect(() => {
    const el = pendingInvalidFocusRef.current;
    if (!el) return;
    const panel = el.closest<HTMLElement>("section[id^='settings-panel-']");
    const panelTab = (panel?.id.replace("settings-panel-", "") ?? "") as TabId;
    if (!panelTab || panelTab !== tab) return;

    pendingInvalidFocusRef.current = null;
    const id = window.requestAnimationFrame(() => {
      el.focus({ preventScroll: false });
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.reportValidity();
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, [tab]);

  const ticketHealthSqlChecks = `SELECT COUNT(*) AS bad_status_rows FROM tickets WHERE status_id NOT IN (1,2,3);
SELECT COUNT(*) AS bad_priority_rows FROM tickets WHERE priority_id NOT IN (1,2,3);
SELECT COUNT(*) AS orphan_comments
FROM tickets_comments tc
LEFT JOIN tickets t ON t.id = tc.ticket_id
WHERE t.id IS NULL;
SHOW INDEX FROM tickets;
SHOW INDEX FROM tickets_comments;`;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground">Settings</h2>
          <p className="text-sm text-muted-foreground">Manage your system configuration and preferences.</p>
        </div>
        <Link
          href="/admin/dashboard"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:decoration-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to dashboard
        </Link>
      </div>

      {ticketsHealth ? (
        <button
          type="button"
          onClick={() => setTicketsHealthOpen(true)}
          className="w-full rounded-xl border border-border bg-card/70 px-4 py-3 text-left text-xs text-muted-foreground shadow-sm transition-colors hover:bg-muted/20"
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-semibold text-foreground">Tickets DB health</span>
            <span className="text-primary underline decoration-primary/40 underline-offset-2">View details</span>
            <span>tickets: {ticketsHealth.billing.ticketsTable ? "ok" : "missing"}</span>
            <span>comments: {ticketsHealth.billing.commentsTable ? "ok" : "missing"}</span>
            <span>orphan comments: <span className={cn(ticketsHealth.billing.orphanComments > 0 && "text-amber-300")}>{ticketsHealth.billing.orphanComments}</span></span>
            <span>bad status: <span className={cn(ticketsHealth.billing.badStatusRows > 0 && "text-amber-300")}>{ticketsHealth.billing.badStatusRows}</span></span>
            <span>bad priority: <span className={cn(ticketsHealth.billing.badPriorityRows > 0 && "text-amber-300")}>{ticketsHealth.billing.badPriorityRows}</span></span>
            <span>tv_genre: {ticketsHealth.stalker.tvGenreTable ? `${ticketsHealth.stalker.tvGenreRows}` : "missing"}</span>
            <span>itv: {ticketsHealth.stalker.itvTable ? `${ticketsHealth.stalker.itvRows}` : "missing"}</span>
          </div>
        </button>
      ) : null}

      <div
        role="tablist"
        aria-label="Settings sections"
        className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted/30 p-1 shadow-sm sm:flex sm:flex-wrap"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`settings-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`settings-panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={cn(
              "min-h-9 flex-1 rounded-lg px-2 py-1.5 text-center text-xs font-medium transition-[color,background-color,box-shadow,transform] duration-200 ease-out sm:text-sm",
              tab === t.id
                ? "bg-card text-foreground shadow-sm ring-1 ring-border/60"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form
        ref={formRef}
        action={saveSettingsAction}
        className="space-y-4"
        onSubmit={(event) => {
          if (allowRealSubmitRef.current) {
            allowRealSubmitRef.current = false;
            return;
          }
          event.preventDefault();
          const form = formRef.current;
          if (form && !form.checkValidity()) {
            jumpToInvalidField();
            return;
          }
          setConfirmOpen(true);
        }}
      >
        <input type="hidden" name="active_tab" value={tab} />

        <section
          id="settings-panel-general"
          role="tabpanel"
          aria-labelledby="settings-tab-general"
          className={cn(
            "overflow-hidden rounded-xl border border-border bg-card shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.04]",
            tab !== "general" && "hidden",
          )}
        >
          <header className="border-b border-border/70 bg-gradient-to-b from-muted/25 to-transparent px-4 py-4 sm:px-5 sm:py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 shadow-inner"
                aria-hidden
              >
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="text-lg font-semibold tracking-tight text-foreground">System configuration</h3>
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Set how your billing panel is titled, where system notices go, and what users see by default.
                </p>
              </div>
            </div>
          </header>

          <div className="space-y-6 px-4 py-4 sm:px-5 sm:py-6">
            <div className="space-y-3">
              <div className={sectionKickerClass}>
                <Type className="h-3.5 w-3.5 opacity-70" aria-hidden />
                Branding &amp; contact
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-[13px]">
                    Panel title
                  </Label>
                  <p className="text-xs leading-snug text-muted-foreground">Shown in the browser and billing header.</p>
                  <div className={controlShellClass}>
                    <Input
                      id="title"
                      name="title"
                      required
                      minLength={3}
                      maxLength={50}
                      defaultValue={settings.title}
                      className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                      placeholder="e.g. ZAAPTV4K"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="inline-flex items-center gap-1.5 text-[13px]">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    Admin email
                  </Label>
                  <p className="text-xs leading-snug text-muted-foreground">Primary contact for system and billing notices.</p>
                  <div className={controlShellClass}>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      defaultValue={settings.adminEmail}
                      className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                      placeholder="admin@example.com"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 shadow-inner sm:p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className={cn(sectionKickerClass, "normal-case tracking-normal")}>
                  <KeyRound className="h-3.5 w-3.5 opacity-70" aria-hidden />
                  <span className="text-sm font-semibold text-foreground">PIN &amp; trial access</span>
                </div>
              </div>
              <p className="mb-3 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
                Default PIN applies to new users. Trial retries control how many times a user may restart a trial when allowed.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pin_default" className="text-[13px]">
                    Default user PIN
                  </Label>
                  <p className="text-xs text-muted-foreground">Exactly four digits.</p>
                  <div className={controlShellClass}>
                    <Input
                      id="pin_default"
                      name="pin_default"
                      inputMode="numeric"
                      pattern="\d{4}"
                      maxLength={4}
                      required
                      defaultValue={settings.pinDefault}
                      className="max-w-full border-0 bg-transparent font-mono text-base tracking-widest shadow-none focus-visible:ring-0 sm:max-w-[11rem]"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="number_retry_trial" className="inline-flex items-center gap-1.5 text-[13px]">
                    <Repeat2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    Trial retry count
                  </Label>
                  <p className="text-xs text-muted-foreground">Used only when retry trial is enabled.</p>
                  <div className={controlShellClass}>
                    <Input
                      id="number_retry_trial"
                      name="number_retry_trial"
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      autoComplete="off"
                      required
                      defaultValue={trialRetryDisplayValue(settings.numberRetryTrial)}
                      className="max-w-full border-0 bg-transparent font-mono text-base tabular-nums shadow-none focus-visible:ring-0 sm:max-w-[11rem]"
                    />
                  </div>
                </div>
              </div>
              <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-lg border border-border/60 bg-card/80 p-3 transition-[border-color,background-color] duration-200 hover:border-border hover:bg-card sm:items-center sm:p-3.5">
                <input
                  type="checkbox"
                  name="is_retry_trial"
                  value="1"
                  defaultChecked={settings.isRetryTrial}
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0 rounded border-input bg-background text-primary shadow-sm",
                    "transition-[box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:mt-0",
                    "accent-primary enabled:cursor-pointer",
                  )}
                />
                <span className="min-w-0 space-y-0.5">
                  <span className="block text-sm font-medium text-foreground">Allow trial retries</span>
                  <span className="block text-xs leading-snug text-muted-foreground">
                    Let eligible users start a trial again up to the count above.
                  </span>
                </span>
              </label>
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                formNoValidate
                size="sm"
                className="min-h-9 gap-1.5 rounded-md px-3.5 shadow-sm"
                onClick={() => {
                  allowRealSubmitRef.current = true;
                }}
              >
                <Globe className="h-3.5 w-3.5" aria-hidden />
                Save general
                <Check className="h-3.5 w-3.5 opacity-90" aria-hidden />
              </Button>
            </div>
          </div>
        </section>

        <section
          id="settings-panel-announcement"
          role="tabpanel"
          aria-labelledby="settings-tab-announcement"
          className={cn(
            "overflow-hidden rounded-xl border border-border bg-card shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.04]",
            tab !== "announcement" && "hidden",
          )}
        >
          <header className="border-b border-border/70 bg-gradient-to-b from-muted/25 to-transparent px-4 py-4 sm:px-5 sm:py-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 shadow-inner"
                aria-hidden
              >
                <Megaphone className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="text-lg font-semibold tracking-tight text-foreground">User announcement</h3>
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Write one global message shown in the client UI.
                </p>
              </div>
            </div>
          </header>
          <div className="space-y-3 px-4 py-4 sm:px-5 sm:py-6">
            <div className="space-y-2">
              <Label htmlFor="global_msg" className="text-[13px]">
                Global announcement
              </Label>
              <p className="text-xs leading-snug text-muted-foreground">
                Stored in the billing settings announcement field.
              </p>
              <div className={controlShellClass}>
                <Textarea
                  id="global_msg"
                  name="global_msg"
                  rows={6}
                  defaultValue={settings.announcement}
                  className="min-h-[10rem] resize-y rounded-lg border-0 bg-transparent shadow-none focus-visible:ring-0"
                  placeholder="Maintenance windows, support links, or policy reminders…"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                formNoValidate
                size="sm"
                className="min-h-9 gap-1.5 rounded-md px-3.5 shadow-sm"
                onClick={() => {
                  allowRealSubmitRef.current = true;
                }}
              >
                <Megaphone className="h-3.5 w-3.5" aria-hidden />
                Save announcement
                <Check className="h-3.5 w-3.5 opacity-90" aria-hidden />
              </Button>
            </div>
          </div>
        </section>

        <section
          id="settings-panel-billing"
          role="tabpanel"
          aria-labelledby="settings-tab-billing"
          className={cn(
            "overflow-hidden rounded-xl border border-border bg-card shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.04]",
            tab !== "billing" && "hidden",
          )}
        >
          <header className="border-b border-border/70 bg-gradient-to-b from-muted/25 to-transparent px-5 py-5 sm:px-6 sm:py-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 shadow-inner"
                aria-hidden
              >
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="text-lg font-semibold tracking-tight text-foreground">Billing configuration</h3>
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Set add-credit limits for manager, reseller, and dealer.
                </p>
              </div>
            </div>
          </header>
          <div className="space-y-6 px-5 py-6 sm:px-6 sm:py-8">
            <div className={sectionKickerClass}>
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" aria-hidden />
              Hierarchy credit minimums
            </div>
            <p className="-mt-2 text-xs leading-relaxed text-muted-foreground">
              Whole numbers from <span className="font-medium text-foreground/90">1</span> to{" "}
              <span className="font-medium text-foreground/90">{HIERARCHY_ADD_CREDITS_MAX}</span>. Global max applies to all
              add actions. Minimums must be less than or equal to the max.
            </p>
            <div className="grid gap-6 sm:max-w-4xl sm:grid-cols-2 xl:grid-cols-4 sm:gap-8">
              <div className="space-y-2.5">
                <Label htmlFor="hierarchy_add_credit_max" className="text-[13px]">
                  Global max add credit
                </Label>
                <p className="text-xs text-muted-foreground">Maximum base amount per add action.</p>
                <div className={controlShellClass}>
                  <Input
                    id="hierarchy_add_credit_max"
                    name="hierarchy_add_credit_max"
                    type="number"
                    min={1}
                    max={HIERARCHY_ADD_CREDITS_MAX}
                    step={1}
                    inputMode="numeric"
                    required
                    defaultValue={settings.hierarchyAddCreditMax}
                    className="max-w-full border-0 bg-transparent font-mono text-base tabular-nums shadow-none focus-visible:ring-0 sm:max-w-[11rem]"
                  />
                </div>
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="limit_manager_credit" className="text-[13px]">
                  Manager min add credit
                </Label>
                <p className="text-xs text-muted-foreground">Minimum base amount for manager adds.</p>
                <div className={controlShellClass}>
                  <Input
                    id="limit_manager_credit"
                    name="limit_manager_credit"
                    type="number"
                    min={1}
                    max={Number.parseInt(settings.hierarchyAddCreditMax, 10) || HIERARCHY_ADD_CREDITS_MAX}
                    step={1}
                    inputMode="numeric"
                    required
                    defaultValue={settings.limitManagerCredit}
                    className="max-w-full border-0 bg-transparent font-mono text-base tabular-nums shadow-none focus-visible:ring-0 sm:max-w-[11rem]"
                  />
                </div>
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="limit_reseller_credit" className="text-[13px]">
                  Reseller min add credit
                </Label>
                <p className="text-xs text-muted-foreground">Minimum base amount for reseller adds.</p>
                <div className={controlShellClass}>
                  <Input
                    id="limit_reseller_credit"
                    name="limit_reseller_credit"
                    type="number"
                    min={1}
                    max={Number.parseInt(settings.hierarchyAddCreditMax, 10) || HIERARCHY_ADD_CREDITS_MAX}
                    step={1}
                    inputMode="numeric"
                    required
                    defaultValue={settings.limitResellerCredit}
                    className="max-w-full border-0 bg-transparent font-mono text-base tabular-nums shadow-none focus-visible:ring-0 sm:max-w-[11rem]"
                  />
                </div>
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="limit_dealer_credit" className="text-[13px]">
                  Dealer min add credit
                </Label>
                <p className="text-xs text-muted-foreground">Minimum base amount for dealer adds.</p>
                <div className={controlShellClass}>
                  <Input
                    id="limit_dealer_credit"
                    name="limit_dealer_credit"
                    type="number"
                    min={1}
                    max={Number.parseInt(settings.hierarchyAddCreditMax, 10) || HIERARCHY_ADD_CREDITS_MAX}
                    step={1}
                    inputMode="numeric"
                    required
                    defaultValue={settings.limitDealerCredit}
                    className="max-w-full border-0 bg-transparent font-mono text-base tabular-nums shadow-none focus-visible:ring-0 sm:max-w-[11rem]"
                  />
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/10 p-4 sm:p-5">
              <h4 className="text-sm font-semibold text-foreground">Promo bonus tiers</h4>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                Configure Promo 1 (by requested credit amount) and Promo 2 (by active client count). Both combine when adding credits to managers, resellers, or dealers.
              </p>
              <Link
                href="/admin/bonus-rules"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline decoration-primary/40 underline-offset-2 transition hover:decoration-primary"
              >
                Go to bonus rules
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                formNoValidate
                size="sm"
                className="min-h-9 gap-1.5 rounded-md px-3.5 shadow-sm"
                onClick={() => {
                  allowRealSubmitRef.current = true;
                }}
              >
                <DollarSign className="h-3.5 w-3.5" aria-hidden />
                Save billing
                <Check className="h-3.5 w-3.5 opacity-90" aria-hidden />
              </Button>
            </div>
          </div>
        </section>

        <section
          id="settings-panel-notifications"
          role="tabpanel"
          aria-labelledby="settings-tab-notifications"
          className={cn(
            "rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6",
            tab !== "notifications" && "hidden",
          )}
        >
          <header className="mb-5 flex items-start gap-3 border-b border-border/80 pb-4">
            <Bell className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
            <div>
              <h3 className="text-base font-semibold text-foreground">Notification preferences</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Stored in the billing <code className="rounded bg-muted px-1 py-0.5 text-xs">configs</code> table. Use{" "}
                <span className="font-medium text-foreground">Save changes</span> to persist (same action as other tabs).
              </p>
            </div>
          </header>
          <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
            When off, the admin header ticket badge, dashboard KPIs, and user summary tiles skip the related counts (fewer
            queries). Email or external jobs are not sent from this app yet.
          </p>
          <div className="divide-y divide-border/80 rounded-lg border border-border/60 bg-muted/10 px-2 sm:px-3">
            <NotificationSwitchRow
              name="notify_expiring_subscriptions"
              title="Expiring subscriptions alert"
              description="Email or digest before renewal (when wired to your notifier)."
              defaultChecked={settings.notifyExpiringSubscriptions}
            />
            <NotificationSwitchRow
              name="notify_low_credit"
              title="Low credit balance alert"
              description="Warn when hierarchy credits fall below your thresholds."
              defaultChecked={settings.notifyLowCredit}
            />
            <NotificationSwitchRow
              name="notify_new_tickets"
              title="New ticket notifications"
              description="Aligns with ticket activity in the admin header when integrated."
              defaultChecked={settings.notifyNewTickets}
            />
            <NotificationSwitchRow
              name="notify_device_offline"
              title="Device offline alerts"
              description="Requires Stalker or device telemetry integration."
              defaultChecked={settings.notifyDeviceOffline}
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              type="submit"
              formNoValidate
              size="sm"
              className="min-h-9 gap-1.5 rounded-md px-3.5 shadow-sm"
              onClick={() => {
                allowRealSubmitRef.current = true;
              }}
            >
              <Bell className="h-3.5 w-3.5" aria-hidden />
              Save notifications
              <Check className="h-3.5 w-3.5 opacity-90" aria-hidden />
            </Button>
          </div>
        </section>

        <section
          id="settings-panel-security"
          role="tabpanel"
          aria-labelledby="settings-tab-security"
          className={cn("rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6", tab !== "security" && "hidden")}
        >
          <header className="mb-5 flex items-start gap-3 border-b border-border/80 pb-4">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 shadow-inner"
              aria-hidden
            >
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 space-y-1">
              <h3 className="text-base font-semibold text-foreground">Security</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Change your admin password directly here. After a successful update, you will be signed out and asked to log in again.
              </p>
            </div>
          </header>

          <div className="space-y-4 rounded-xl border border-border/70 bg-muted/15 p-4 sm:p-5">
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Change password</p>
              <input type="hidden" name="return_to" value="settings" />
              <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
                <Label htmlFor="settings-old-password">Current password</Label>
                <Input
                  id="settings-old-password"
                  name="old_password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Type your current password"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
                <Label htmlFor="settings-new-password">New password</Label>
                <Input
                  id="settings-new-password"
                  name="new_password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="4–12 characters"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
                <Label htmlFor="settings-new-password-confirm">Confirm new password</Label>
                <Input
                  id="settings-new-password-confirm"
                  name="new_confirm_passsword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Retype your new password"
                />
              </div>
              <div className="pt-1">
                <Button
                  type="submit"
                  formAction={changePasswordAction}
                  formNoValidate
                  className="min-h-10 gap-2 rounded-lg bg-primary px-4 font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                  onClick={() => {
                    allowRealSubmitRef.current = true;
                  }}
                >
                  <KeyRound className="h-4 w-4" aria-hidden />
                  Change password
                  <ArrowUpRight className="h-4 w-4 opacity-90" aria-hidden />
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section
          id="settings-panel-appearance"
          role="tabpanel"
          aria-labelledby="settings-tab-appearance"
          className={cn(
            "rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6",
            tab !== "appearance" && "hidden",
          )}
        >
          <header className="mb-6 flex items-start gap-3 border-b border-border/80 pb-4">
            <Palette className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
            <div>
              <h3 className="text-base font-semibold text-foreground">Appearance</h3>
              <p className="text-sm text-muted-foreground">Customize the look and feel (theme matches temp-figma tokens).</p>
            </div>
          </header>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Theme</p>
              <p className="mt-1 text-sm text-foreground">Light / dark</p>
            </div>
            <ThemeToggle />
          </div>
        </section>

      </form>
      {confirmOpen ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card/95 p-5 shadow-2xl ring-1 ring-black/5 dark:ring-white/10">
            <h3 className="text-base font-semibold tracking-tight text-foreground">Confirm settings save</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              This will save values from all settings tabs, not just the currently visible one.
            </p>
            <div className="mt-4 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              Review General values (title, email, PIN) before saving from another tab.
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmOpen(false)}
                className="h-9 gap-1.5"
              >
                <X className="h-4 w-4" aria-hidden />
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setConfirmOpen(false);
                  const form = formRef.current;
                  if (!form) return;
                  if (!form.checkValidity()) {
                    jumpToInvalidField();
                    return;
                  }
                  allowRealSubmitRef.current = true;
                  requestAnimationFrame(() => formRef.current?.requestSubmit());
                }}
                className="h-9 gap-1.5"
              >
                <Check className="h-4 w-4" aria-hidden />
                Save all tabs
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {ticketsHealthOpen && ticketsHealth ? (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]" onClick={() => setTicketsHealthOpen(false)}>
          <div
            className="w-full max-w-2xl rounded-2xl border border-border/70 bg-card/95 p-5 shadow-2xl ring-1 ring-black/5 dark:ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold tracking-tight text-foreground">Tickets DB health details</h3>
            <p className="mt-1 text-sm text-muted-foreground">Quick diagnostics for Billing tickets tables and Stalker category/channel metadata.</p>

            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Tickets rows</p>
                <p className="font-semibold text-foreground">{ticketsHealth.billing.ticketRows}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Comments rows</p>
                <p className="font-semibold text-foreground">{ticketsHealth.billing.commentRows}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Orphan comments</p>
                <p className={cn("font-semibold", ticketsHealth.billing.orphanComments > 0 ? "text-amber-300" : "text-foreground")}>{ticketsHealth.billing.orphanComments}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Invalid status / priority</p>
                <p className={cn("font-semibold", (ticketsHealth.billing.badStatusRows + ticketsHealth.billing.badPriorityRows) > 0 ? "text-amber-300" : "text-foreground")}>
                  {ticketsHealth.billing.badStatusRows} / {ticketsHealth.billing.badPriorityRows}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-border/60 bg-muted/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">SQL checks</p>
              <pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs text-foreground">{ticketHealthSqlChecks}</pre>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9 gap-1.5"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(ticketHealthSqlChecks);
                    setChecksCopied(true);
                    window.setTimeout(() => setChecksCopied(false), 1200);
                  } catch {}
                }}
              >
                <Copy className="h-4 w-4" aria-hidden />
                {checksCopied ? "Copied" : "Copy checks"}
              </Button>
              <Button type="button" onClick={() => setTicketsHealthOpen(false)} className="h-9 gap-1.5">
                <Check className="h-4 w-4" aria-hidden />
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

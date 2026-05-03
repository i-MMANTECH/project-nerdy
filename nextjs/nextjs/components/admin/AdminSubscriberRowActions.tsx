"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowUpRight, Eye, HandCoins, Mail, MoreVertical, Pencil, ReceiptText, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  bulkDeleteAccountsAction,
  bulkRenewAccountsAction,
  bulkSendAccountsMessageAction,
  getAccountRenewRecoveryAvailabilityAction,
  resetAccountDeviceBindingsAction,
  recoverAccountCreditsAction,
} from "@/actions/forms";
import { toastBulkRenewSummary } from "@/lib/bulkRenewResultToast";
import { BulkRenewValiditySelect } from "@/components/admin/BulkRenewValiditySelect";
import { AdminSendMessageModal } from "@/components/admin/AdminSendMessageModal";
import { FloatingMenuPortal } from "@/components/ui/FloatingMenuPortal";
import { AdminAddUserModal } from "@/components/admin/AdminAddUserModal";

export function AdminSubscriberRowActions({
  account,
  resetReturnPath,
  subscriptionExpired,
  validityOptions,
  openEditOnMount = false,
  editModalData,
  onViewDetail,
  onViewTransactions,
}: {
  account: string;
  resetReturnPath: string;
  subscriptionExpired: boolean;
  validityOptions: Array<{ value: string; label: string }>;
  openEditOnMount?: boolean;
  editModalData?: {
    resellers: Array<{ username: string; name: string }>;
    tariffs: Array<{ id: number; name: string }>;
    customPlanId: number | null;
    addonPackages: Array<{ package_id: number; name: string }>;
  };
  onViewDetail?: () => void;
  onViewTransactions?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(openEditOnMount);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editData, setEditData] = useState<{
    name: string;
    password: string;
    mac: string;
    phone: string;
    comments: string;
    statusCode: number;
    reseller: string;
    dealer: string;
    tariffPlanId: number;
    subscribedPackageIds: number[];
    parentPin: string;
  } | null>(null);
  const [renewOpen, setRenewOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageBody, setMessageBody] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [recoverOpen, setRecoverOpen] = useState(false);
  const [recoverCredits, setRecoverCredits] = useState("1");
  const [validity, setValidity] = useState("1");
  const [availability, setAvailability] = useState<{
    expiresAt: string | null;
    recoverableCredits: number | null;
    debitUsername: string | null;
    debitCredits: number | null;
  } | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [renewPending, startRenewTransition] = useTransition();
  const [recoverPending, startRecoverTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();
  const [resetPending, startResetTransition] = useTransition();
  const [messagePending, startMessageTransition] = useTransition();
  const anchorRef = useRef<HTMLDivElement>(null);
  const recoverCreditsInt = Number.parseInt(recoverCredits, 10);
  const recoverCurrent = availability?.recoverableCredits ?? null;
  const recoverAfter =
    recoverCurrent != null && Number.isFinite(recoverCreditsInt) ? Math.max(0, recoverCurrent - Math.max(0, recoverCreditsInt)) : null;
  const recoverCurrentExpiry = availability?.expiresAt ? new Date(String(availability.expiresAt).replace(" ", "T")) : null;
  const recoverAfterExpiry =
    recoverCurrentExpiry && Number.isFinite(recoverCreditsInt) && recoverCreditsInt > 0
      ? new Date(
          recoverCurrentExpiry.getFullYear(),
          recoverCurrentExpiry.getMonth() - recoverCreditsInt,
          recoverCurrentExpiry.getDate(),
          recoverCurrentExpiry.getHours(),
          recoverCurrentExpiry.getMinutes(),
          recoverCurrentExpiry.getSeconds(),
        )
      : null;
  const renewMonths = Number.parseInt(validity, 10);
  const selectedValidity = validityOptions.find((v) => v.value === validity);
  const chargedFromLabel = (() => {
    if (!selectedValidity?.label) return null;
    const m = selectedValidity.label.match(/(\d+)\s*credit/i);
    return m ? Number.parseInt(m[1] ?? "", 10) : null;
  })();
  const renewChargedCredits =
    validity === "FREE_TRIAL" ? 0 : chargedFromLabel != null && Number.isFinite(chargedFromLabel) ? chargedFromLabel : renewMonths;
  const renewCurrentExpiry = availability?.expiresAt ? new Date(String(availability.expiresAt).replace(" ", "T")) : null;
  const renewAfterExpiry =
    renewCurrentExpiry && Number.isFinite(renewMonths) && renewMonths > 0
      ? new Date(renewCurrentExpiry.getFullYear(), renewCurrentExpiry.getMonth() + renewMonths, renewCurrentExpiry.getDate(), renewCurrentExpiry.getHours(), renewCurrentExpiry.getMinutes(), renewCurrentExpiry.getSeconds())
      : null;
  const renewCurrentAvailable = availability?.debitCredits ?? null;
  const renewAfterAvailable =
    renewCurrentAvailable != null && Number.isFinite(renewChargedCredits) && renewChargedCredits >= 0
      ? renewCurrentAvailable - renewChargedCredits
      : null;

  useEffect(() => {
    if (!openEditOnMount) return;
    void openEditModal();
    // only on initial mount / prop hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openEditOnMount]);

  async function openEditModal() {
    setEditError(null);
    setEditLoading(true);
    setEditOpen(true);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(account)}/details`, { cache: "no-store" });
      if (!res.ok) {
        setEditError("Could not load user details.");
        return;
      }
      const json = (await res.json()) as {
        ok?: boolean;
        user?: {
          name?: string;
          password?: string;
          mac?: string;
          phone?: string;
          comments?: string;
          statusCode?: number;
          reseller?: string;
          dealer?: string;
          tariffPlanId?: number;
          subscribedPackageIds?: number[];
          parentPin?: string;
        };
      };
      if (!json?.ok || !json.user) {
        setEditError("Could not load user details.");
        return;
      }
      setEditData({
        name: json.user.name ?? "",
        password: json.user.password ?? "",
        mac: json.user.mac ?? "",
        phone: json.user.phone ?? "",
        comments: json.user.comments ?? "",
        statusCode: Number(json.user.statusCode ?? 0),
        reseller: json.user.reseller ?? "",
        dealer: json.user.dealer ?? "",
        tariffPlanId: Number(json.user.tariffPlanId ?? 0),
        subscribedPackageIds: (json.user.subscribedPackageIds ?? []).map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0),
        parentPin: /^\d{4}$/.test(String(json.user.parentPin ?? "")) ? String(json.user.parentPin) : "9090",
      });
    } catch {
      setEditError("Could not load user details.");
    } finally {
      setEditLoading(false);
    }
  }

  function runRenew() {
    startRenewTransition(async () => {
      const res = await bulkRenewAccountsAction([account], validity);
      if (!res.ok) {
        toast.error(res.error === "no_accounts" ? "Account is required." : res.error);
        return;
      }
      if (res.results.length === 1) {
        const row = res.results[0];
        if (!row?.ok) {
          toast.error(row?.message || "Renew failed.");
          return;
        }
        setRenewOpen(false);
        toast.success("Account renewed successfully.");
        return;
      }
      setRenewOpen(false);
      toastBulkRenewSummary(res.results);
    });
  }

  function runSendMessage() {
    const message = messageBody.trim();
    if (!message) {
      toast.warning("Message is required.");
      return;
    }
    startMessageTransition(async () => {
      const res = await bulkSendAccountsMessageAction({ accounts: [account], message, priority: 2 });
      if (!res.ok) {
        if (res.error === "empty") toast.error("Message is required.");
        else if (res.error === "no_recipients") toast.error("No Stalker user found for this account.");
        else if (res.error === "events_table") toast.error("Stalker `events` table is missing.");
        else toast.error("Failed to queue message.");
        return;
      }
      setMessageOpen(false);
      setMessageBody("");
      if (res.unresolvedAccounts.length) {
        toast.warning("Message was not sent because this account is not mapped to a Stalker user.");
      } else {
        toast.success("Message queued successfully.");
      }
    });
  }

  async function loadAvailability() {
    setAvailabilityLoading(true);
    try {
      const res = await getAccountRenewRecoveryAvailabilityAction(account);
      if (!res.ok) return;
      setAvailability({
        expiresAt: res.expiresAt,
        recoverableCredits: res.recoverableCredits,
        debitUsername: res.debitUsername,
        debitCredits: res.debitCredits,
      });
    } finally {
      setAvailabilityLoading(false);
    }
  }

  function runDelete() {
    startDeleteTransition(async () => {
      const res = await bulkDeleteAccountsAction([account]);
      if (!res.ok) {
        toast.error(res.error === "no_accounts" ? "Account is required." : "Delete failed.");
        return;
      }
      const row = res.results[0];
      if (!row?.ok) {
        toast.error(row?.message || "Delete failed.");
        return;
      }
      setDeleteOpen(false);
      toast.success("User deleted successfully.");
      window.location.href = resetReturnPath;
    });
  }

  function runRecover() {
    const credits = Number.parseInt(recoverCredits, 10);
    if (!Number.isFinite(credits) || credits < 1 || credits > 2000) {
      toast.warning("Enter credits between 1 and 2000.");
      return;
    }
    startRecoverTransition(async () => {
      const res = await recoverAccountCreditsAction(account, credits);
      if (!res.ok) {
        if (res.error === "insufficient_recoverable") {
          toast.error(`Not enough recoverable credits. Available ${res.balance ?? 0}, required ${res.required ?? credits}.`);
          return;
        }
        if (res.error === "no_summarize") {
          toast.error("Credit summary is missing for this account.");
          return;
        }
        if (res.error === "no_stalker_user") {
          toast.error("No matching Stalker user for this account.");
          return;
        }
        toast.error("Recovery failed. Please try again.");
        return;
      }
      setRecoverOpen(false);
      toast.success("Credits recovered successfully.");
    });
  }

  function runResetDevice() {
    startResetTransition(async () => {
      const res = await resetAccountDeviceBindingsAction(account);
      if (!res.ok) {
        if (res.error === "reset_no_account") toast.error("Account not found.");
        else if (res.error === "reset_no_stalker") toast.error("Stalker DB is not configured.");
        else if (res.error === "reset_no_row") toast.error("No device binding rows were found to reset.");
        else toast.error("Reset failed.");
        return;
      }
      setResetOpen(false);
      toast.success("Device bindings reset successfully.");
      window.location.href = resetReturnPath;
    });
  }

  return (
    <>
      <div ref={anchorRef} className="inline-flex justify-center">
        <button
          type="button"
          className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-border/60 bg-muted/30 p-1.5 text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={`Actions for ${account}`}
          onClick={() => setOpen((o) => !o)}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        <FloatingMenuPortal open={open} onOpenChange={setOpen} anchorRef={anchorRef}>
          <div onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted/50"
              onClick={() => {
                setOpen(false);
                void openEditModal();
              }}
            >
              <Pencil className="h-4 w-4 shrink-0 opacity-70" />
              Edit
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted/50"
              onClick={() => {
                setOpen(false);
                onViewDetail?.();
              }}
            >
              <Eye className="h-4 w-4 shrink-0 opacity-70" />
              View detail
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted/50"
              onClick={() => {
                setOpen(false);
                onViewTransactions?.();
              }}
            >
              <ReceiptText className="h-4 w-4 shrink-0 opacity-70" />
              Transactions
            </button>
            <div className="border-t border-border/50" />
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted/50"
              onClick={() => {
                setOpen(false);
                setRenewOpen(true);
                void loadAvailability();
              }}
            >
              <HandCoins className="h-4 w-4 shrink-0 opacity-70" />
              Renewal
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted/50"
              onClick={() => {
                setOpen(false);
                setRecoverOpen(true);
                void loadAvailability();
              }}
            >
              <RotateCcw className="h-4 w-4 shrink-0 opacity-70" />
              Recovery
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted/50"
              onClick={() => {
                setOpen(false);
                setMessageOpen(true);
              }}
            >
              <Mail className="h-4 w-4 shrink-0 opacity-70" />
              Send message
            </button>
            <div className="border-t border-border/50">
              <button
                type="button"
                role="menuitem"
                className="flex h-9 w-full items-center gap-2 px-3 text-left text-sm font-medium text-foreground transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                onClick={() => {
                  setOpen(false);
                  setResetOpen(true);
                }}
              >
                <RotateCcw className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                Reset device
              </button>
            </div>
            <div className="border-t border-border/50">
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                onClick={() => {
                  setOpen(false);
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                Delete
              </button>
            </div>
          </div>
        </FloatingMenuPortal>
      </div>

      {renewOpen ? (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[3px]"
          role="dialog"
          aria-modal="true"
          onClick={() => setRenewOpen(false)}
        >
          <div
            className="w-full max-w-xl overflow-visible rounded-2xl border border-border/70 bg-card/95 shadow-2xl ring-1 ring-black/[0.05] dark:ring-white/[0.07]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-border/50 px-6 py-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground/90">Renewal</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Renew account</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Account: <span className="font-semibold text-foreground">{account}</span>
              </p>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/45 bg-background/35 px-4 py-3 backdrop-blur-sm">
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Current available (debit wallet)</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {availabilityLoading
                      ? "Loading..."
                      : renewCurrentAvailable != null
                        ? new Intl.NumberFormat("en-US").format(renewCurrentAvailable)
                        : "-"}
                  </p>
                  {availability?.debitUsername ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">Owner: {availability.debitUsername}</p>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.08] px-4 py-3 backdrop-blur-sm">
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">After available</p>
                  <p className={`mt-1 text-sm font-semibold ${renewAfterAvailable != null && renewAfterAvailable < 0 ? "text-destructive" : "text-foreground"}`}>
                    {availabilityLoading
                      ? "Loading..."
                      : renewAfterAvailable != null
                        ? new Intl.NumberFormat("en-US").format(renewAfterAvailable)
                        : "-"}
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-border/45 bg-background/30 px-3.5 py-3 backdrop-blur-sm">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-border/40 bg-background/40 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Charged credits</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {Number.isFinite(renewChargedCredits) ? new Intl.NumberFormat("en-US").format(renewChargedCredits) : "-"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/40 bg-background/40 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Current expiry</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {availabilityLoading ? "Loading..." : renewCurrentExpiry ? renewCurrentExpiry.toLocaleString() : "-"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/40 bg-background/40 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">After renew</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {availabilityLoading ? "Loading..." : renewAfterExpiry ? renewAfterExpiry.toLocaleString() : "-"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-border/45 bg-background/30 p-3.5 backdrop-blur-sm">
                <label id={`renew-validity-${account}`} className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Select validity
                </label>
                <BulkRenewValiditySelect
                  value={validity}
                  onValueChange={setValidity}
                  options={validityOptions}
                  labelledBy={`renew-validity-${account}`}
                  triggerClassName="w-full"
                />
              </div>
              <p className="rounded-xl border border-border/35 bg-background/25 px-3.5 py-2 text-xs text-muted-foreground">
                Renewal applies immediately based on the selected period.
              </p>
            </div>
            <div className="flex items-center justify-end border-t border-border/50 px-6 py-4">
              <button
                type="button"
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:translate-y-[-1px] hover:brightness-110 disabled:opacity-50"
                onClick={runRenew}
                disabled={renewPending}
              >
                {renewPending ? "Working…" : "Submit"}
                {!renewPending ? <ArrowUpRight className="h-4 w-4" aria-hidden="true" /> : null}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {recoverOpen ? (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[3px]"
          role="dialog"
          aria-modal="true"
          onClick={() => setRecoverOpen(false)}
        >
          <div
            className="w-full max-w-xl overflow-visible rounded-2xl border border-border/70 bg-card/95 shadow-2xl ring-1 ring-black/[0.05] dark:ring-white/[0.07]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-border/50 px-6 py-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground/90">Recovery</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Recover credits</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Account: <span className="font-semibold text-foreground">{account}</span>
              </p>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div className="rounded-2xl border border-border/45 bg-background/30 p-3.5 backdrop-blur-sm">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <label htmlFor={`recover-credits-${account}`} className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Credits to recover
                  </label>
                  <span className="rounded-full border border-border/60 bg-background/70 px-2.5 py-0.5 text-[11px] text-muted-foreground">Range: 1 - 2000</span>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/70 p-2">
                  <input
                    id={`recover-credits-${account}`}
                    type="number"
                    min={1}
                    max={2000}
                    step={1}
                    value={recoverCredits}
                    onChange={(e) => setRecoverCredits(e.target.value)}
                    className="h-10 w-full rounded-md border border-border/70 bg-background px-3 text-base font-semibold text-foreground outline-none transition [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus-visible:border-cyan-500/60 focus-visible:ring-[3px] focus-visible:ring-cyan-500/20"
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Enter how many credits should be recovered from this account.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/45 bg-background/35 px-4 py-3 backdrop-blur-sm">
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Current available (recoverable)</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {availabilityLoading
                      ? "Loading..."
                      : recoverCurrent != null
                        ? new Intl.NumberFormat("en-US").format(recoverCurrent)
                        : "-"}
                  </p>
                </div>
                <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.08] px-4 py-3 backdrop-blur-sm">
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">After recover (preview)</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {availabilityLoading
                      ? "Loading..."
                      : recoverAfter != null
                        ? new Intl.NumberFormat("en-US").format(recoverAfter)
                        : "-"}
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-border/45 bg-background/30 px-3.5 py-3 backdrop-blur-sm">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/40 bg-background/40 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Current expiry</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {availabilityLoading ? "Loading..." : recoverCurrentExpiry ? recoverCurrentExpiry.toLocaleString() : "-"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/40 bg-background/40 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">After recover (preview)</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {availabilityLoading ? "Loading..." : recoverAfterExpiry ? recoverAfterExpiry.toLocaleString() : "-"}
                    </p>
                  </div>
                </div>
              </div>
              <p className="rounded-xl border border-border/35 bg-background/25 px-3.5 py-2 text-xs text-muted-foreground">
                Recovery converts eligible months back into credits.
              </p>
            </div>
            <div className="flex items-center justify-end border-t border-border/50 px-6 py-4">
              <button
                type="button"
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:translate-y-[-1px] hover:brightness-110 disabled:opacity-50"
                onClick={runRecover}
                disabled={recoverPending}
              >
                {recoverPending ? "Working..." : "Submit"}
                {!recoverPending ? <ArrowUpRight className="h-4 w-4" aria-hidden="true" /> : null}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {resetOpen ? (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          onClick={() => setResetOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border/55 bg-card/95 p-0 shadow-2xl ring-1 ring-black/[0.06] backdrop-blur-sm dark:ring-white/[0.08]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Reset</p>
              <p className="mt-1 text-lg font-semibold tracking-tight text-foreground">Reset device bindings?</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Clear Stalker device bindings for account <span className="font-semibold text-foreground">{account}</span> so it can be linked again.
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border/50 bg-background/20 px-5 py-3">
              <button
                type="button"
                className="h-auto px-0 text-sm font-medium text-muted-foreground underline decoration-muted-foreground/40 underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground/40"
                onClick={() => setResetOpen(false)}
                disabled={resetPending}
              >
                Close
              </button>
              <button
                type="button"
                className="inline-flex h-auto items-center gap-1 px-0 text-sm font-semibold text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary disabled:opacity-50"
                onClick={runResetDevice}
                disabled={resetPending}
              >
                {resetPending ? "Working..." : "Reset device"}
                {!resetPending ? <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden /> : null}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {deleteOpen ? (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          onClick={() => setDeleteOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border/55 bg-card/95 p-0 shadow-2xl ring-1 ring-black/[0.06] backdrop-blur-sm dark:ring-white/[0.08]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Delete</p>
              <p className="mt-1 text-lg font-semibold tracking-tight text-foreground">Delete user account?</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {subscriptionExpired
                  ? "Permanently delete this user account (billing + Stalker)? This cannot be undone."
                  : "This account is still active. Do you really want to delete this user account?"}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border/50 bg-background/20 px-5 py-3">
              <button
                type="button"
                className="h-auto px-0 text-sm font-medium text-muted-foreground underline decoration-muted-foreground/40 underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground/40"
                onClick={() => setDeleteOpen(false)}
                disabled={deletePending}
              >
                Close
              </button>
              <button
                type="button"
                className="inline-flex h-auto items-center gap-1 px-0 text-sm font-semibold text-destructive underline decoration-destructive/40 underline-offset-4 transition-colors hover:decoration-destructive disabled:opacity-50"
                onClick={runDelete}
                disabled={deletePending}
              >
                {deletePending ? "Working..." : "Delete account"}
                {!deletePending ? <Trash2 className="h-4 w-4 shrink-0" aria-hidden /> : null}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <AdminSendMessageModal
        open={messageOpen}
        title="Send Message"
        description={`Send a message to ${account} via Stalker server events.`}
        recipients={[account]}
        message={messageBody}
        maxLength={1000}
        pending={messagePending}
        submitLabel="Send Message"
        onMessageChange={setMessageBody}
        onClose={() => setMessageOpen(false)}
        onSubmit={runSendMessage}
      />

      {editOpen && editLoading ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45">
          <p className="rounded-md border border-border/60 bg-card/95 px-3 py-2 text-sm text-muted-foreground">Loading user details...</p>
        </div>
      ) : null}
      {editOpen && editError ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45" onClick={() => setEditOpen(false)}>
          <div className="rounded-md border border-border/60 bg-card/95 px-4 py-3 text-sm text-destructive" onClick={(e) => e.stopPropagation()}>
            {editError}
          </div>
        </div>
      ) : null}
      {editOpen && editData ? (
        <AdminAddUserModal
          open
          onClose={() => setEditOpen(false)}
          mode="edit"
          returnTo={resetReturnPath}
          resellers={editModalData?.resellers ?? []}
          tariffs={editModalData?.tariffs ?? []}
          validityOptions={validityOptions}
          customPlanId={editModalData?.customPlanId ?? null}
          addonPackages={editModalData?.addonPackages ?? []}
          initialValues={{
            account,
            name: editData.name,
            password: editData.password,
            mac: editData.mac,
            phone: editData.phone,
            status: editData.statusCode,
            reseller: editData.reseller,
            dealer: editData.dealer,
            packageId: editData.tariffPlanId,
            subscribedPackageIds: editData.subscribedPackageIds,
            parentPin: editData.parentPin,
            note: editData.comments,
          }}
        />
      ) : null}
    </>
  );
}

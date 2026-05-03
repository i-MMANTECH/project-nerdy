"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode, Ref } from "react";
import { ArrowRight, BadgeDollarSign, CircleUserRound, FileText, KeyRound, Landmark, ShieldCheck, UserRound, Wallet, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PasswordInputWithToggle } from "@/components/forms/PasswordInputWithToggle";
import { SearchableFormSelect } from "@/components/forms/SearchableFormSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";
import type { PromoTier } from "@/lib/promoBonus";
import { computePromoBonusesForAdd } from "@/lib/promoBonus";
import {
  HierarchyAddCreditPreviewDetail,
  HierarchyRecoverCreditPreviewDetail,
} from "@/components/portal/HierarchyCreditPreviewBlocks";

type StaffType = "MANAGER" | "RESELLER" | "DEALER";

function editPath(rowType: StaffType, username: string) {
  const encoded = encodeURIComponent(username);
  if (rowType === "MANAGER") return `/admin/managers/${encoded}`;
  if (rowType === "RESELLER") return `/admin/resellers/${encoded}`;
  return `/admin/dealers/${encoded}`;
}

function roleLabel(rowType: StaffType) {
  if (rowType === "MANAGER") return "Manager";
  if (rowType === "RESELLER") return "Reseller";
  return "Dealer";
}

type StaffEditorResponse = {
  type: StaffType;
  username: string;
  name: string;
  password: string;
  status: string;
  comments: string;
  credits: number;
  hierarchyAddMin?: number;
  hierarchyAddMax?: number;
  manager?: string;
  username_owner?: string;
  tickets_manager?: string;
  managerOptions?: { value: string; label: string }[];
  resellerOptions?: { value: string; label: string }[];
  promoP1?: PromoTier[];
  promoP2?: PromoTier[];
  activeClientsForPromo2?: number;
};

type StaffEditorCreditsErrorResponse = {
  ok?: boolean;
  error?: string;
  balance?: number;
  required?: number;
};

function formatInt(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.max(0, Math.floor(n)));
}

function creditsFailureMessage(input: {
  operation: "ADD" | "RECOVER";
  staffType: StaffType;
  requested: number;
  error?: StaffEditorCreditsErrorResponse;
}) {
  const code = input.error?.error ?? "credits_error";
  const required = Number(input.error?.required);
  const balance = Number(input.error?.balance);
  const hasNums = Number.isFinite(required) && Number.isFinite(balance);
  if (code === "insufficient_credits") {
    if (input.operation === "ADD") {
      const sourceLabel = input.staffType === "MANAGER" ? "admin wallet" : input.staffType === "RESELLER" ? "manager wallet" : "reseller wallet";
      if (hasNums) {
        const promoHint = required > input.requested ? " (includes promo bonus on add)" : "";
        return `Not enough ${sourceLabel} balance. Need ${formatInt(required)}, available ${formatInt(balance)}${promoHint}.`;
      }
      return `Not enough ${sourceLabel} balance to add credits.`;
    }
    if (hasNums) {
      return `Insufficient target balance for recover. Need ${formatInt(required)}, available ${formatInt(balance)}.`;
    }
    return "Insufficient target balance for recover.";
  }
  if (code === "invalid") {
    return "Amount is outside the allowed range for this role/settings.";
  }
  if (code === "no_owner") {
    return "This staff account has no valid parent owner configured.";
  }
  if (code === "no_target") {
    return "Target user was not found or role no longer matches.";
  }
  if (code === "db") {
    return "Database error while applying credits. Try again.";
  }
  return "Could not update credits.";
}

export function AdminStaffEditModalTrigger({
  rowType,
  username,
  label,
  className,
  onOpen,
  initialView = "profile",
  initialCreditsMode = "both",
  triggerRef,
}: {
  rowType: StaffType;
  username: string;
  label: ReactNode;
  className?: string;
  onOpen?: () => void;
  initialView?: "profile" | "credits";
  initialCreditsMode?: "both" | "add" | "recover";
  triggerRef?: Ref<HTMLButtonElement>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingCredits, setSavingCredits] = useState<"" | "ADD" | "RECOVER">("");
  const [data, setData] = useState<StaffEditorResponse | null>(null);
  const [addAmount, setAddAmount] = useState(10);
  const [recoverAmount, setRecoverAmount] = useState(10);
  const [recoverDebitPreview, setRecoverDebitPreview] = useState<number | null>(null);
  const [recoverMatchedGrant, setRecoverMatchedGrant] = useState(false);

  const billingRole = useMemo(() => (rowType === "MANAGER" ? "MNGR" : rowType === "RESELLER" ? "SRSLR" : "RSLR"), [rowType]);

  const addPromoBreakdown = useMemo(() => {
    if (!data?.promoP1 || !data.promoP2) return null;
    return computePromoBonusesForAdd(addAmount, data.activeClientsForPromo2 ?? 0, data.promoP1, data.promoP2);
  }, [data, addAmount]);

  const projectedAddTotal =
    addPromoBreakdown != null ? addAmount + addPromoBreakdown.bonus1 + addPromoBreakdown.bonus2 : null;
  const addMax = Math.max(1, Math.min(5000, Number(data?.hierarchyAddMax ?? 5000)));
  const addMin = Math.max(1, Math.min(addMax, Number(data?.hierarchyAddMin ?? 1)));

  useEffect(() => {
    if (!open || !data) return;
    const ac = new AbortController();
    const t = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/billing/credit-preview?mode=recover&username=${encodeURIComponent(username)}&principal=${recoverAmount}&role=${billingRole}`,
            { signal: ac.signal, credentials: "same-origin" },
          );
          if (!res.ok) {
            setRecoverDebitPreview(null);
            setRecoverMatchedGrant(false);
            return;
          }
          const j = (await res.json()) as { debitTotal: number; matchedGrantTxId: number | null };
          setRecoverDebitPreview(j.debitTotal);
          setRecoverMatchedGrant(j.matchedGrantTxId != null);
        } catch {
          if (!ac.signal.aborted) {
            setRecoverDebitPreview(null);
            setRecoverMatchedGrant(false);
          }
        }
      })();
    }, 200);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [open, recoverAmount, username, billingRole, data]);

  async function loadEditorData() {
    const res = await fetch(`/api/admin/staff-editor?type=${encodeURIComponent(rowType)}&username=${encodeURIComponent(username)}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("load_failed");
    return (await res.json()) as StaffEditorResponse;
  }

  useEffect(() => {
    if (!open) {
      setRecoverDebitPreview(null);
      setRecoverMatchedGrant(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const json = await loadEditorData();
        if (!cancelled) {
          const maxOnOpen =
            Math.max(1, Math.min(5000, Number(json.hierarchyAddMax ?? 5000)));
          const minOnOpen = Math.max(1, Math.min(maxOnOpen, Number(json.hierarchyAddMin ?? 1)));
          setData(json);
          setAddAmount(Math.max(minOnOpen, Math.min(10, maxOnOpen)));
          setRecoverAmount(10);
        }
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    document.body.style.overflow = "";
    return () => {
      cancelled = true;
    };
  }, [open, rowType, username]);

  async function submitProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!data) return;
    const formData = new FormData(e.currentTarget);
    setSavingProfile(true);
    try {
      const payload: Record<string, string> = {
        mode: "profile",
        type: data.type,
        username: data.username,
        name: String(formData.get("name") ?? ""),
        password: String(formData.get("password") ?? ""),
        status: String(formData.get("status") ?? "INACTIVE"),
        comments: String(formData.get("comments") ?? ""),
      };
      if (data.type === "RESELLER") payload.manager = String(formData.get("manager") ?? "");
      if (data.type === "DEALER") {
        payload.username_owner = String(formData.get("username_owner") ?? "");
        payload.tickets_manager = String(formData.get("tickets_manager") ?? "No");
      }
      const res = await fetch("/api/admin/staff-editor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("save_failed");
      const refreshed = await loadEditorData();
      setData(refreshed);
      router.refresh();
      toast.success("Profile updated successfully.");
    } catch {
      toast.error("Could not save profile changes.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function submitCredits(e: React.FormEvent<HTMLFormElement>, operation: "ADD" | "RECOVER") {
    e.preventDefault();
    if (!data) return;
    const formData = new FormData(e.currentTarget);
    setSavingCredits(operation);
    try {
      const requestedCredits = Number.parseInt(String(formData.get("credits") ?? ""), 10);
      const res = await fetch("/api/admin/staff-editor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "credits",
          type: data.type,
          username: data.username,
          operation,
          credits: requestedCredits,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as StaffEditorCreditsErrorResponse | null;
        throw new Error(creditsFailureMessage({ operation, staffType: data.type, requested: requestedCredits, error: body ?? undefined }));
      }
      const refreshed = await loadEditorData();
      setData(refreshed);
      setAddAmount(10);
      setRecoverAmount(10);
      router.refresh();
      toast.success(operation === "ADD" ? "Credits added." : "Credits recovered.");
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : "Could not update credits.";
      toast.error(msg);
    } finally {
      setSavingCredits("");
    }
  }

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={className}
        onClick={() => {
          onOpen?.();
          setOpen(true);
        }}
      >
        {label}
      </button>
      {open ? (
        <div className="fixed inset-0 z-[340] flex items-center justify-center p-3 sm:p-5" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-[2px] transition-opacity"
            aria-label="Close editor"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Edit ${roleLabel(rowType)} ${username}`}
            className={cn(
              "relative z-10 overflow-hidden rounded-2xl border border-border/70 bg-card text-left shadow-2xl ring-1 ring-black/10 dark:ring-white/10",
              initialView === "credits" ? "w-[min(96vw,1060px)]" : "w-[min(96vw,1360px)]",
            )}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/[0.16] px-3 py-3 sm:px-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold tracking-tight text-foreground">
                  {initialView === "credits" ? "Credits" : `${roleLabel(rowType)} editor`}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <div className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-md border border-border/70 bg-background/80 px-2 py-0.5 text-xs text-muted-foreground">
                    <UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate font-mono">{initialView === "credits" ? `${roleLabel(rowType)}: ${username}` : username}</span>
                  </div>
                  {loading ? (
                    <span className="text-xs text-muted-foreground">Loading…</span>
                  ) : data ? (
                    <div
                      className="inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-md border border-emerald-500/25 bg-emerald-500/[0.08] px-2.5 py-1"
                      title="Wallet credits in billing"
                    >
                      <Wallet className="h-3.5 w-3.5 shrink-0 text-emerald-600/90 dark:text-emerald-400/85" aria-hidden />
                      <span className="text-xs font-medium text-muted-foreground">Balance</span>
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {new Intl.NumberFormat("en-US").format(data.credits)}
                      </span>
                    </div>
                  ) : null}
                </div>
                <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                  {initialView === "credits" ? (
                    initialCreditsMode === "add"
                      ? "Add credits below."
                      : initialCreditsMode === "recover"
                        ? "Recover credits below."
                        : "Add or recover below — each action submits independently."
                  ) : (
                    <>
                      <ShieldCheck className="mr-1 inline h-3.5 w-3.5 shrink-0 text-emerald-500/80 align-text-bottom" aria-hidden />
                      Secure edit session with inline save feedback.
                    </>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors",
                  "hover:bg-muted/40 hover:text-foreground",
                )}
                aria-label="Close editor"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className={cn("overflow-auto p-3 pb-4 sm:p-4 sm:pb-5", initialView === "credits" ? "max-h-[min(80vh,680px)]" : "max-h-[min(82vh,760px)]")}>
              {loading ? (
                <div className="rounded-xl border border-border/60 bg-background/40 p-6 text-sm text-muted-foreground">Loading editor...</div>
              ) : !data ? (
                <div className="rounded-xl border border-border/60 bg-background/40 p-6 text-sm text-destructive">Could not load editor data.</div>
              ) : (
                <div
                  className={cn(
                    "grid gap-6",
                    initialView === "credits"
                      ? "grid-cols-1"
                      : "xl:grid-cols-[minmax(0,0.85fr)_minmax(500px,1.15fr)]",
                  )}
                >
                  {initialView === "profile" ? (
                    <form onSubmit={submitProfile} className="space-y-4">
                    <input type="hidden" name="_intent" value="edit" />
                    <input type="hidden" name="username" value={data.username} />
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-0.5">
                        <Label htmlFor={`editor-name-${data.username}`} className="inline-flex items-center gap-1.5">
                          <UserRound className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                          Display name
                        </Label>
                        <Input id={`editor-name-${data.username}`} name="name" defaultValue={data.name} required />
                      </div>
                      <div className="space-y-0.5">
                        <Label htmlFor={`editor-username-${data.username}`} className="inline-flex items-center gap-1.5">
                          <CircleUserRound className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                          Username
                        </Label>
                        <Input id={`editor-username-${data.username}`} readOnly value={data.username} className="font-mono text-muted-foreground" />
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-0.5">
                        <Label htmlFor={`editor-password-${data.username}`} className="inline-flex items-center gap-1.5">
                          <KeyRound className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                          Password
                        </Label>
                        <PasswordInputWithToggle id={`editor-password-${data.username}`} name="password" defaultValue={data.password} required />
                      </div>
                      {data.type === "RESELLER" ? (
                        <div className="space-y-0.5">
                          <Label htmlFor={`editor-manager-${data.username}`} className="inline-flex items-center gap-1.5">
                            <Landmark className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                            Manager
                          </Label>
                          <SearchableFormSelect
                            id={`editor-manager-${data.username}`}
                            name="manager"
                            defaultValue={data.manager ?? ""}
                            searchPlaceholder="Search manager..."
                            options={data.managerOptions ?? []}
                          />
                        </div>
                      ) : data.type === "DEALER" ? (
                        <div className="space-y-0.5">
                          <Label htmlFor={`editor-reseller-${data.username}`} className="inline-flex items-center gap-1.5">
                            <Landmark className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                            Parent reseller
                          </Label>
                          <SearchableFormSelect
                            id={`editor-reseller-${data.username}`}
                            name="username_owner"
                            defaultValue={data.username_owner ?? ""}
                            searchPlaceholder="Search reseller..."
                            options={data.resellerOptions ?? []}
                          />
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <Label htmlFor={`editor-status-${data.username}`} className="inline-flex items-center gap-1.5">
                            <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                            Status
                          </Label>
                          <div id={`editor-status-${data.username}`} className="flex h-10 items-center gap-3">
                            <label className="inline-flex cursor-pointer items-center">
                              <input type="checkbox" name="status" value="ACTIVE" defaultChecked={data.status !== "S"} className="peer sr-only" />
                              <span className="relative h-7 w-12 rounded-full bg-muted/70 after:absolute after:left-0.5 after:top-0.5 after:h-6 after:w-6 after:rounded-full after:bg-white after:transition-transform after:content-[''] peer-checked:bg-emerald-500/85 peer-checked:after:translate-x-5" />
                            </label>
                            <span className="text-sm font-medium text-foreground">Active / Suspended</span>
                          </div>
                          <input type="hidden" name="status" value="INACTIVE" />
                        </div>
                      )}
                    </div>
                    {data.type !== "MANAGER" ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-0.5">
                          <Label htmlFor={`editor-status2-${data.username}`} className="inline-flex items-center gap-1.5">
                            <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                            Status
                          </Label>
                          <div id={`editor-status2-${data.username}`} className="flex h-10 items-center gap-3">
                            <label className="inline-flex cursor-pointer items-center">
                              <input type="checkbox" name="status" value="ACTIVE" defaultChecked={data.status === "ACTIVE" || data.status === "A"} className="peer sr-only" />
                              <span className="relative h-7 w-12 rounded-full bg-muted/70 after:absolute after:left-0.5 after:top-0.5 after:h-6 after:w-6 after:rounded-full after:bg-white after:transition-transform after:content-[''] peer-checked:bg-emerald-500/85 peer-checked:after:translate-x-5" />
                            </label>
                            <span className="text-sm font-medium text-foreground">Active / Suspended</span>
                          </div>
                          <input type="hidden" name="status" value="INACTIVE" />
                        </div>
                        {data.type === "DEALER" ? (
                          <div className="space-y-0.5">
                            <Label htmlFor={`editor-tickets-${data.username}`}>Tickets in portal</Label>
                            <div id={`editor-tickets-${data.username}`} className="flex h-10 items-center gap-3">
                              <label className="inline-flex cursor-pointer items-center">
                                <input type="checkbox" name="tickets_manager" value="Yes" defaultChecked={data.tickets_manager === "Yes"} className="peer sr-only" />
                                <span className="relative h-7 w-12 rounded-full bg-muted/70 after:absolute after:left-0.5 after:top-0.5 after:h-6 after:w-6 after:rounded-full after:bg-white after:transition-transform after:content-[''] peer-checked:bg-emerald-500/85 peer-checked:after:translate-x-5" />
                              </label>
                              <span className="text-sm font-medium text-foreground">On / Off</span>
                            </div>
                            <input type="hidden" name="tickets_manager" value="No" />
                          </div>
                        ) : (
                          <div />
                        )}
                      </div>
                    ) : null}
                    <div className="space-y-0.5">
                      <Label htmlFor={`editor-comments-${data.username}`} className="inline-flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                        Internal notes
                      </Label>
                      <textarea
                        id={`editor-comments-${data.username}`}
                        name="comments"
                        rows={4}
                        defaultValue={data.comments}
                        className="flex min-h-[100px] w-full rounded-md border border-input bg-input-background px-3 py-2 text-sm text-foreground"
                      />
                    </div>
                    <div className="flex justify-end border-t border-border/60 pt-3">
                      <Button type="submit" disabled={savingProfile} variant="ghost" size="sm" className="h-auto px-0 text-[11px] font-semibold uppercase tracking-wide text-primary underline decoration-primary/40 underline-offset-2 hover:bg-transparent hover:decoration-primary disabled:opacity-60">
                        Save changes
                      </Button>
                    </div>
                    </form>
                  ) : null}

                  <div
                    className={cn(
                      "space-y-3",
                      initialView === "credits" ? "mx-auto w-full max-w-[min(100%,960px)]" : "",
                    )}
                  >
                    {initialView !== "credits" ? (
                      <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <Wallet className="h-3.5 w-3.5" aria-hidden />
                        Credit balance
                      </h3>
                    ) : null}
                    <div className="space-y-4 rounded-xl border border-border/60 bg-background/30 p-4">
                      <div
                        className={cn(
                          "grid grid-cols-1 gap-6",
                          initialCreditsMode === "both" ? "lg:grid-cols-2 lg:gap-0" : "",
                        )}
                      >
                        {initialCreditsMode !== "recover" ? (
                          <div className={cn("space-y-3", initialCreditsMode === "both" ? "lg:pr-5" : "")}>
                          <form onSubmit={(e) => void submitCredits(e, "ADD")} className="space-y-3">
                            <Label htmlFor={`editor-credits-add-${data.username}`} className="inline-flex items-center gap-1.5">
                              <BadgeDollarSign className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                              Amount to add
                            </Label>
                            <Input
                              id={`editor-credits-add-${data.username}`}
                              type="number"
                              name="credits"
                              min={addMin}
                              max={addMax}
                              value={addAmount}
                              onChange={(e) =>
                                setAddAmount(
                                  Math.max(addMin, Math.min(addMax, Number.parseInt(e.target.value || String(addMin), 10) || addMin)),
                                )
                              }
                              required
                            />
                            {data.promoP1 != null && data.promoP2 != null ? (
                              <HierarchyAddCreditPreviewDetail
                                principal={addAmount}
                                currentBalance={data.credits}
                                p1={data.promoP1}
                                p2={data.promoP2}
                                activeClients={data.activeClientsForPromo2 ?? 0}
                                hideFooterProjected
                              />
                            ) : null}
                            <div className="rounded-md border border-emerald-400/35 bg-emerald-500/10 px-3 py-2.5">
                              <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-200/90">
                                Projected after add
                                <ArrowRight className="h-3 w-3" aria-hidden />
                              </p>
                              <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-300">
                                {new Intl.NumberFormat("en-US").format(
                                  data.credits + (projectedAddTotal != null ? projectedAddTotal : addAmount),
                                )}
                              </p>
                            </div>
                            <Button
                              type="submit"
                              disabled={savingCredits === "ADD"}
                              variant="ghost"
                              size="sm"
                              className="h-auto px-0 text-[11px] font-semibold uppercase tracking-wide text-primary underline decoration-primary/40 underline-offset-2 hover:bg-transparent hover:decoration-primary disabled:opacity-60"
                            >
                              Apply add credits
                            </Button>
                          </form>
                          </div>
                        ) : null}

                        {initialCreditsMode !== "add" ? (
                          <div
                            className={cn(
                              "space-y-3",
                              initialCreditsMode === "both"
                                ? "border-t border-border/50 pt-6 lg:border-t-0 lg:border-l lg:border-border/50 lg:pt-0 lg:pl-5"
                                : "",
                            )}
                          >
                          <form onSubmit={(e) => void submitCredits(e, "RECOVER")} className="space-y-3">
                            <Label htmlFor={`editor-credits-recover-${data.username}`} className="inline-flex items-center gap-1.5">
                              <BadgeDollarSign className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                              Amount to recover
                            </Label>
                            <Input
                              id={`editor-credits-recover-${data.username}`}
                              type="number"
                              name="credits"
                              min={1}
                              max={2000}
                              value={recoverAmount}
                              onChange={(e) => setRecoverAmount(Math.max(1, Math.min(2000, Number.parseInt(e.target.value || "1", 10) || 1)))}
                              required
                            />
                            <HierarchyRecoverCreditPreviewDetail
                              currentBalance={data.credits}
                              principal={recoverAmount}
                              debitTotal={recoverDebitPreview ?? recoverAmount}
                              matchedGrant={recoverMatchedGrant}
                              hideFooterProjected
                            />
                            <div className="rounded-md border border-amber-400/35 bg-amber-500/10 px-3 py-2.5">
                              <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">
                                Projected after recover
                                <ArrowRight className="h-3 w-3" aria-hidden />
                              </p>
                              <p className="mt-1 text-lg font-semibold tabular-nums text-amber-300">
                                {new Intl.NumberFormat("en-US").format(
                                  Math.max(0, data.credits - (recoverDebitPreview ?? recoverAmount)),
                                )}
                              </p>
                            </div>
                            <Button
                              type="submit"
                              disabled={savingCredits === "RECOVER"}
                              variant="ghost"
                              size="sm"
                              className="h-auto px-0 text-[11px] font-semibold uppercase tracking-wide text-primary underline decoration-primary/40 underline-offset-2 hover:bg-transparent hover:decoration-primary disabled:opacity-60"
                            >
                              Apply recover credits
                            </Button>
                          </form>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeDollarSign, Eye, KeyRound, MoreVertical, Pencil, ReceiptText, RefreshCcw, Store, Trash2, Users, X } from "lucide-react";
import { resetStaffPasswordAction } from "@/actions/forms";
import { AdminDeleteResellerForm } from "@/components/admin/AdminDeleteResellerForm";
import { EndUserTransactionsTable } from "@/components/admin/EndUserTransactionsTable";
import { PasswordInputWithToggle } from "@/components/forms/PasswordInputWithToggle";
import { Button } from "@/components/ui/button";
import { FloatingMenuPortal } from "@/components/ui/FloatingMenuPortal";
import { AdminStaffEditModalTrigger } from "@/components/admin/AdminStaffEditModalTrigger";
import { AdminListModalTrigger } from "@/components/admin/AdminListModalTrigger";
import { AdminUsersListModalTrigger } from "@/components/admin/AdminUsersListModalTrigger";
import { cn } from "@/lib/cn";
import type { AdminTransactionRow } from "@/lib/repos/billing";

export function AdminResellerRowActions({
  username,
  displayName,
  canDelete,
  redirectPath,
  status,
  managerLogin,
  credits,
  dealerCount,
  activeUsers,
  expiredUsers,
  totalUsers,
  stateCurrentLogin,
  initialCreditsModal,
  transactions,
  viewDealersStaffHref,
}: {
  username: string;
  displayName: string;
  canDelete: boolean;
  redirectPath: string;
  status: string;
  managerLogin: string;
  credits: number;
  dealerCount: number;
  activeUsers: number;
  expiredUsers: number;
  totalUsers: number;
  stateCurrentLogin: string;
  initialCreditsModal?: string;
  transactions: AdminTransactionRow[];
  /** When set (e.g. on /admin/managers), opens dealer drill-down in the staff list instead of the standalone dealers page. */
  viewDealersStaffHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [transactionsOpen, setTransactionsOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const editTriggerRef = useRef<HTMLButtonElement | null>(null);
  const addCreditsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const recoverCreditsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const usersTriggerRef = useRef<HTMLButtonElement | null>(null);
  const dealersTriggerRef = useRef<HTMLButtonElement | null>(null);

  const loginLabel = stateCurrentLogin
    ? new Date(stateCurrentLogin.replace(" ", "T")).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "No login recorded";

  useEffect(() => {
    if (!initialCreditsModal) return;
    const id = window.setTimeout(
      () => (initialCreditsModal === "recover" ? recoverCreditsTriggerRef.current : addCreditsTriggerRef.current)?.click(),
      0,
    );
    return () => window.clearTimeout(id);
  }, [initialCreditsModal]);

  return (
    <div className="relative flex justify-center">
      <div ref={anchorRef} className="inline-flex">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 w-9 shrink-0 p-0 text-muted-foreground hover:text-foreground"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={`Actions for ${displayName || username}`}
          onClick={() => setOpen((o) => !o)}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </div>
      <FloatingMenuPortal open={open} onOpenChange={setOpen} anchorRef={anchorRef} menuClassName="min-w-56 w-56">
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-foreground hover:bg-muted/60"
          onClick={() => {
            setOpen(false);
            window.setTimeout(() => setDetailsOpen(true), 0);
          }}
        >
          <Eye className="h-4 w-4 shrink-0 opacity-70" />
          View details
        </button>
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-foreground hover:bg-muted/60"
          onClick={() => {
            setOpen(false);
            window.setTimeout(() => editTriggerRef.current?.click(), 0);
          }}
        >
          <Pencil className="h-4 w-4 shrink-0 opacity-70" />
          Edit
        </button>
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-foreground hover:bg-muted/60"
          onClick={() => {
            setOpen(false);
            window.setTimeout(() => addCreditsTriggerRef.current?.click(), 0);
          }}
        >
          <BadgeDollarSign className="h-4 w-4 shrink-0 opacity-70" />
          Add credits
        </button>
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-foreground hover:bg-muted/60"
          onClick={() => {
            setOpen(false);
            window.setTimeout(() => recoverCreditsTriggerRef.current?.click(), 0);
          }}
        >
          <RefreshCcw className="h-4 w-4 shrink-0 opacity-70" />
          Recover credits
        </button>
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-foreground hover:bg-muted/60"
          onClick={() => {
            setOpen(false);
            window.setTimeout(() => setTransactionsOpen(true), 0);
          }}
        >
          <ReceiptText className="h-4 w-4 shrink-0 opacity-70" />
          Transactions
        </button>
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-foreground hover:bg-muted/60"
          onClick={() => {
            setOpen(false);
            window.setTimeout(() => usersTriggerRef.current?.click(), 0);
          }}
        >
          <Users className="h-4 w-4 shrink-0 opacity-70" />
          View users
        </button>
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-foreground hover:bg-muted/60"
          onClick={() => {
            setOpen(false);
            window.setTimeout(() => setPasswordOpen(true), 0);
          }}
        >
          <KeyRound className="h-4 w-4 shrink-0 opacity-70" />
          Reset password
        </button>
        {viewDealersStaffHref ? (
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-foreground hover:bg-muted/60"
            onClick={() => {
              setOpen(false);
              window.setTimeout(() => dealersTriggerRef.current?.click(), 0);
            }}
          >
            <Store className="h-4 w-4 shrink-0 opacity-70" />
            View dealers
          </button>
        ) : null}
        <div className="border-t border-border/60" onClick={(e) => e.stopPropagation()}>
          {canDelete ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              onClick={() => {
                setOpen(false);
                window.setTimeout(() => setDeleteConfirmOpen(true), 0);
              }}
            >
              <Trash2 className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              Delete reseller
            </button>
          ) : (
            <AdminDeleteResellerForm
              username={username}
              canDelete={false}
              redirectPath={redirectPath}
              buttonLabel="Delete reseller"
              menuItem
            />
          )}
        </div>
      </FloatingMenuPortal>
      {deleteConfirmOpen ? (
        <AdminDeleteResellerForm
          key={`delete-reseller-${username}`}
          username={username}
          canDelete
          redirectPath={redirectPath}
          buttonLabel="Delete reseller"
          defaultConfirmOpen
          positionAnchorRef={anchorRef}
          onPanelOpenChange={(o) => {
            if (!o) setDeleteConfirmOpen(false);
          }}
        />
      ) : null}
      {detailsOpen ? (
        <div className="fixed inset-0 z-[320] flex items-start justify-center overflow-y-auto p-4 pt-6 sm:items-center" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
            aria-label="Close details"
            onClick={() => setDetailsOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-xl max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-2xl border border-border/80 bg-card p-5 shadow-xl ring-1 ring-black/5 dark:ring-white/10"
          >
            <div className="mb-4 flex items-start justify-between gap-3 border-b border-border/60 pb-3">
              <div className="min-w-0 space-y-2">
                <h3 className="text-lg font-semibold text-foreground">Reseller Details</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Name</p>
                  <p className="truncate text-right font-medium text-foreground">{displayName || "—"}</p>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Username</p>
                  <p className="truncate text-right font-mono text-primary">{username}</p>
                </div>
              </div>
              <span
                className={cn(
                  "inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                  status === "A"
                    ? "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-200"
                    : "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-400/25 dark:bg-slate-400/10 dark:text-slate-200",
                )}
              >
                {status === "A" ? "Active" : "Suspended"}
              </span>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Role</p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">Reseller</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Manager</p>
                <p className="mt-0.5 truncate text-sm font-medium text-foreground">{managerLogin || "—"}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Credits</p>
                <p className="mt-1 font-semibold tabular-nums text-foreground">{new Intl.NumberFormat("en-US").format(credits)}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Login</p>
                <p className="mt-1 truncate text-sm font-medium text-foreground">{loginLabel}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Dealers</p>
                <p className="mt-1 font-semibold tabular-nums text-foreground">{dealerCount}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total users</p>
                <p className="mt-1 font-semibold tabular-nums text-foreground">{totalUsers}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Active users</p>
                <p className="mt-1 font-semibold tabular-nums text-emerald-300">{activeUsers}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Expired users</p>
                <p className="mt-1 font-semibold tabular-nums text-amber-300">{expiredUsers}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {passwordOpen ? (
        <div className="fixed inset-0 z-[320] flex items-start justify-center overflow-y-auto p-4 pt-6 sm:items-center" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
            aria-label="Close reset password"
            onClick={() => setPasswordOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-md max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-2xl border border-border/80 bg-card p-5 shadow-xl ring-1 ring-black/5 dark:ring-white/10"
          >
            <h3 className="text-lg font-semibold text-foreground">Reset password</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Set a new password for <span className="font-mono text-foreground">{username}</span>.
            </p>
            <form action={resetStaffPasswordAction} className="mt-4 space-y-3">
              <input type="hidden" name="username" value={username} />
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">New password</label>
                <PasswordInputWithToggle id={`reseller-reset-password-${username}`} name="password" required autoComplete="new-password" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Confirm password</label>
                <PasswordInputWithToggle
                  id={`reseller-reset-password-confirm-${username}`}
                  name="password_confirm"
                  required
                  autoComplete="new-password"
                />
              </div>
              <p className="text-xs text-muted-foreground">Use 4 to 12 characters.</p>
              <div className="flex justify-end border-t border-border/60 pt-3">
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  className="h-auto px-0 text-[11px] font-semibold uppercase tracking-wide text-primary underline decoration-primary/40 underline-offset-2 hover:bg-transparent hover:decoration-primary"
                >
                  Save password
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {transactionsOpen ? (
        <div className="fixed inset-0 z-[320] flex items-start justify-center overflow-y-auto p-2 pt-4 sm:items-center sm:p-3" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
            aria-label="Close transactions"
            onClick={() => setTransactionsOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-[min(96vw,1400px)] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-border/80 bg-card p-2.5 shadow-xl ring-1 ring-black/5 dark:ring-white/10 sm:max-h-[calc(100dvh-2.5rem)] sm:p-3"
          >
            <div className="mb-1.5 flex items-start justify-between gap-2 border-b border-border/60 pb-2">
              <div>
                <h3 className="text-base font-semibold leading-tight text-foreground">Transactions</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  User: <span className="font-mono font-semibold text-foreground">{username}</span>
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 shrink-0 p-0" onClick={() => setTransactionsOpen(false)} aria-label="Close">
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            <EndUserTransactionsTable rows={transactions} />
          </div>
        </div>
      ) : null}
      <AdminStaffEditModalTrigger
        rowType="RESELLER"
        username={username}
        triggerRef={editTriggerRef}
        className="sr-only"
        label="Edit"
      />
      <AdminStaffEditModalTrigger
        rowType="RESELLER"
        username={username}
        triggerRef={addCreditsTriggerRef}
        initialView="credits"
        initialCreditsMode="add"
        className="sr-only"
        label="Add credits"
      />
      <AdminStaffEditModalTrigger
        rowType="RESELLER"
        username={username}
        triggerRef={recoverCreditsTriggerRef}
        initialView="credits"
        initialCreditsMode="recover"
        className="sr-only"
        label="Recover credits"
      />
      <AdminUsersListModalTrigger
        rowType="RESELLER"
        username={username}
        displayName={displayName || username}
        status=""
        triggerRef={usersTriggerRef}
        className="sr-only"
        label="View users"
      />
      <AdminListModalTrigger
        rowType="RESELLER"
        username={username}
        triggerRef={dealersTriggerRef}
        className="sr-only"
        label="View dealers"
      />
    </div>
  );
}

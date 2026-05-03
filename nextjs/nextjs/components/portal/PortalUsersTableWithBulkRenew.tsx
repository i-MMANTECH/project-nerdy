"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { bulkRenewPortalAccountsAction } from "@/actions/forms";
import { toastBulkRenewSummary } from "@/lib/bulkRenewResultToast";
import { PortalSubscriberRowActions } from "@/components/portal/PortalSubscriberRowActions";
import { isBillingAccountExpired } from "@/lib/billingAccountExpiry";
import type { AccountListRow } from "@/lib/repos/billing";
import { cn } from "@/lib/cn";
import { dataTableStickyTh } from "@/lib/ui/dataTableSticky";
import { BulkRenewValiditySelect } from "@/components/admin/BulkRenewValiditySelect";

export type PortalUsersBulkVariant = "manager" | "reseller" | "dealer";

type ValidityOption = { value: string; label: string };

export type PortalUsersSortColumn =
  | "account"
  | "mac"
  | "full_name"
  | "reseller"
  | "dealer"
  | "status"
  | "expires"
  | "created";

type Props = {
  variant: PortalUsersBulkVariant;
  resellerStatusQuickActions?: boolean;
  rows: AccountListRow[];
  validityOptions: ValidityOption[];
  sort: string;
  dir: "asc" | "desc";
  sortUrls: Record<PortalUsersSortColumn, string>;
  /** Owner column: `dealer` sort by default; `reseller` when list is scoped to a single dealer (see `OperatorSubscribersPage`). */
  ownerSortUrl: string;
  ownerSortColumn: "dealer" | "reseller";
  listReturnPath: string;
  portalBase: "/manager" | "/reseller" | "/dealer";
};

const ACCOUNT_OFF = 1;
/** Avoid oversized URLs when many rows are checked (billing login per param). */
const MAX_ACCOUNTS_IN_MESSAGE_URL = 100;

function sortMark(col: string, sort: string, dir: "asc" | "desc") {
  return sort === col ? (dir === "asc" ? "↑" : "↓") : "";
}

function ownerLabel(r: AccountListRow) {
  return r.dealer?.trim() || r.reseller?.trim() || r.manager?.trim() || "—";
}

function subscriptionPill(r: AccountListRow) {
  if (r.status === ACCOUNT_OFF) {
    return { label: "Inactive", className: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/25" };
  }
  if (isBillingAccountExpired(r.expires)) {
    return { label: "Expired", className: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/25" };
  }
  if (r.expires) {
    const exp = new Date(String(r.expires).replace(" ", "T"));
    if (!Number.isNaN(exp.getTime()) && exp.getTime() > Date.now() && exp.getTime() - Date.now() <= 7 * 24 * 60 * 60 * 1000) {
      return { label: "Expiring soon", className: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30" };
    }
  }
  return { label: "Active", className: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25" };
}

function devicePill(r: AccountListRow) {
  if (r.receiverOnline === true) {
    return { label: "Online", className: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25" };
  }
  if (r.receiverOnline === false) {
    return { label: "Offline", className: "bg-muted text-muted-foreground ring-1 ring-border/60" };
  }
  return { label: "—", className: "bg-muted/40 text-muted-foreground ring-1 ring-border/40" };
}

/** Portal subscriber grid — same columns and chrome as `AdminSubscribersTable` (Root). */
export function PortalUsersTableWithBulkRenew({
  variant,
  resellerStatusQuickActions = false,
  rows,
  validityOptions,
  sort,
  dir,
  sortUrls,
  ownerSortUrl,
  ownerSortColumn,
  listReturnPath,
  portalBase,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [renewOpen, setRenewOpen] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [validity, setValidity] = useState("1");
  const [results, setResults] = useState<{ account: string; ok: boolean; message: string }[]>([]);
  const [pending, startTransition] = useTransition();

  const allAccounts = useMemo(() => rows.map((r) => r.account), [rows]);
  const allSelected = allAccounts.length > 0 && allAccounts.every((a) => selected.has(a));

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(allAccounts) : new Set());
  }

  function toggleOne(account: string, checked: boolean) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (checked) n.add(account);
      else n.delete(account);
      return n;
    });
  }

  function openRenewModal() {
    if (selected.size === 0) {
      toast.warning("Select accounts for renew");
      return;
    }
    setRenewOpen(true);
  }

  function runBulkRenew() {
    const ids = Array.from(selected);
    startTransition(async () => {
      const res = await bulkRenewPortalAccountsAction(ids, validity);
      if (!res.ok) {
        const msg =
          res.error === "no_accounts"
            ? "Select at least one account."
            : res.error === "no_validity"
              ? "Choose a validity option."
              : res.error === "forbidden"
                ? "Not allowed."
                : res.error;
        toast.error(msg);
        return;
      }
      setResults(res.results);
      setRenewOpen(false);
      setResultsOpen(true);
      setSelected(new Set());
      toastBulkRenewSummary(res.results);
    });
  }

  const editHref = (account: string) =>
    `${portalBase}/users/${encodeURIComponent(account)}?list=${encodeURIComponent(listReturnPath)}`;

  const showResellerStb = variant === "reseller" && resellerStatusQuickActions;

  const messageSelectedHref = useMemo(() => {
    if (!selected.size) return `${portalBase}/message`;
    const p = new URLSearchParams();
    let n = 0;
    for (const a of selected) {
      if (n >= MAX_ACCOUNTS_IN_MESSAGE_URL) break;
      p.append("accounts", a);
      n++;
    }
    return `${portalBase}/message?${p.toString()}`;
  }, [portalBase, selected]);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2.5 rounded-xl border border-border/60 bg-muted/20 px-3.5 py-2.5 text-sm">
        <span className="text-muted-foreground">
          Selected: <span className="font-semibold text-foreground">{selected.size}</span>
        </span>
        <button
          type="button"
          onClick={openRenewModal}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
          disabled={pending}
        >
          Bulk renew…
        </button>
        <Link
          href={messageSelectedHref}
          onClick={(e) => {
            if (!selected.size) {
              e.preventDefault();
              toast.warning("Select at least one user");
              return;
            }
            if (selected.size > MAX_ACCOUNTS_IN_MESSAGE_URL) {
              toast.info(
                `Only the first ${MAX_ACCOUNTS_IN_MESSAGE_URL} selected accounts were added to the link (URL size limit).`,
              );
            }
          }}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 py-1.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted/70 dark:hover:bg-muted/50",
            !selected.size && "opacity-50",
          )}
          aria-disabled={!selected.size}
        >
          <Mail className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
          Message selected…
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card/80 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
        <div className="app-data-table-scroll thin-scrollbar">
          <table className="min-w-[1040px] w-full border-collapse text-left text-sm">
            <thead>
              <tr>
                <th className={cn(dataTableStickyTh("py-2"), "w-10")}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => toggleAll(e.target.checked)}
                    aria-label="Select all on this page"
                    className="rounded border-input"
                  />
                </th>
                <th className={dataTableStickyTh("py-2")}>
                  <Link href={sortUrls.account} className="text-foreground hover:text-primary">
                    Account {sortMark("account", sort, dir)}
                  </Link>
                </th>
                <th className={dataTableStickyTh("py-2")}>
                  <Link href={sortUrls.full_name} className="text-foreground hover:text-primary">
                    User {sortMark("full_name", sort, dir)}
                  </Link>
                </th>
                <th className={dataTableStickyTh("py-2")}>
                  <Link href={ownerSortUrl} className="text-foreground hover:text-primary">
                    Owner {sortMark(ownerSortColumn, sort, dir)}
                  </Link>
                </th>
                <th className={cn(dataTableStickyTh("py-2"), "font-medium")}>Package</th>
                <th className={dataTableStickyTh("py-2")}>
                  <Link href={sortUrls.mac} className="text-foreground hover:text-primary">
                    MAC {sortMark("mac", sort, dir)}
                  </Link>
                </th>
                <th className={cn(dataTableStickyTh("py-2"), "text-center")}>
                  <Link href={sortUrls.status} className="text-foreground hover:text-primary">
                    Status {sortMark("status", sort, dir)}
                  </Link>
                </th>
                <th className={cn(dataTableStickyTh("py-2"), "text-center")}>
                  <Link href={sortUrls.expires} className="text-foreground hover:text-primary">
                    Expiry {sortMark("expires", sort, dir)}
                  </Link>
                </th>
                <th className={cn(dataTableStickyTh("py-2"), "text-center font-medium")}>Device</th>
                <th className={cn(dataTableStickyTh("py-2"), "text-center font-medium")}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
                    <p className="text-sm font-medium text-foreground">No users match your filters</p>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      Try clearing the search box, widening filters, or changing page size.
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const sub = subscriptionPill(r);
                  const dev = devicePill(r);
                  const subscriptionExpired = isBillingAccountExpired(r.expires);
                  const expired = subscriptionExpired;
                  return (
                    <tr
                      key={r.account}
                      className={cn(
                        "transition-colors hover:bg-primary/5 dark:hover:bg-muted/25",
                        selected.has(r.account) && "bg-primary/[0.08] dark:bg-primary/15",
                      )}
                    >
                      <td className="px-3 py-2 align-middle">
                        <input
                          type="checkbox"
                          checked={selected.has(r.account)}
                          onChange={(e) => toggleOne(r.account, e.target.checked)}
                          aria-label={`Select ${r.account}`}
                          className="rounded border-input"
                        />
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <Link
                          href={editHref(r.account)}
                          className="font-mono text-xs font-semibold text-primary underline decoration-primary/40 underline-offset-2 hover:text-primary"
                        >
                          {r.account}
                        </Link>
                      </td>
                      <td className="px-3 py-2 align-middle text-sm font-medium text-foreground">{r.full_name?.trim() || "—"}</td>
                      <td className="px-3 py-2 align-middle font-mono text-xs text-muted-foreground">{ownerLabel(r)}</td>
                      <td className="px-3 py-2 align-middle text-xs text-muted-foreground">{r.packageName ?? "—"}</td>
                      <td className="px-3 py-2 align-middle font-mono text-xs text-muted-foreground">{r.mac || "—"}</td>
                      <td className="px-3 py-2 align-middle text-center">
                        <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold", sub.className)}>{sub.label}</span>
                      </td>
                      <td className="px-3 py-2 align-middle text-center text-xs tabular-nums text-muted-foreground">
                        {r.expires ? String(r.expires).slice(0, 10) : "—"}
                      </td>
                      <td className="px-3 py-2 align-middle text-center">
                        <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold", dev.className)}>{dev.label}</span>
                      </td>
                      <td className="px-3 py-2 align-middle text-center">
                        <PortalSubscriberRowActions
                          account={r.account}
                          portalBase={portalBase}
                          listReturnPath={listReturnPath}
                          subscriptionExpired={subscriptionExpired}
                          variant={variant}
                          rowStatus={r.status}
                          expired={expired}
                          resellerStatusQuickActions={showResellerStb}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {renewOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-xl border border-border/60 bg-card p-5 shadow-lg">
            <h2 className="text-lg font-semibold text-foreground">Bulk renew</h2>
            <p className="mt-1 text-sm text-muted-foreground">{selected.size} account(s) will be renewed.</p>
            <label id="portal-bulk-renew-validity" className="mt-4 block text-sm font-semibold text-foreground">
              Validity
            </label>
            <BulkRenewValiditySelect
              value={validity}
              onValueChange={setValidity}
              options={validityOptions}
              labelledBy="portal-bulk-renew-validity"
              triggerClassName="mt-1 w-full"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-input px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/50"
                onClick={() => setRenewOpen(false)}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                onClick={runBulkRenew}
                disabled={pending}
              >
                {pending ? "Working…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {resultsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-xl border border-border/60 bg-card p-5 shadow-lg">
            <h2 className="text-lg font-semibold text-foreground">Update results</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {results.map((row, i) => (
                <li
                  key={`${row.account}-${i}`}
                  className={cn(
                    "rounded-lg border px-2 py-2",
                    row.ok ? "border-border bg-muted/30 text-foreground" : "border-destructive/30 bg-destructive/10 text-destructive",
                  )}
                >
                  {row.message}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                onClick={() => {
                  setResultsOpen(false);
                  router.refresh();
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

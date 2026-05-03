import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CreditCard, History } from "lucide-react";
import type { FlashToastItem } from "@/components/FlashToasts";
import { FlashToastsBoundary } from "@/components/FlashToasts";
import { getSession } from "@/lib/session";
import {
  getDealerById,
  getHierarchyCreditPreviewBundle,
  getSettings,
  listDealersOwnedByReseller,
  type ResellerPortalDealerRow,
} from "@/lib/data";
import { hierarchyAddCreditsMax, hierarchyAddCreditsMin } from "@/lib/repos/billing";
import { PageHeader } from "@/components/admin/PageHeader";
import { Panel } from "@/components/admin/Panel";
import { HierarchyCreditsSplitForms } from "@/components/portal/HierarchyCreditsSplitForms";
import { ResellerDeleteDealerForm } from "@/components/portal/ResellerDeleteDealerForm";
import { applyResellerDealerCreditsAction, saveResellerDealerAction } from "@/actions/forms";
import { EndUserTransactionsTable } from "@/components/admin/EndUserTransactionsTable";
import { PasswordInputWithToggle } from "@/components/forms/PasswordInputWithToggle";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/forms/form-select";
import { Button, buttonOutlineLinkClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Props = {
  params: Promise<{ username: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstString(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function formatInt(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

function resellerDealerEditFlashes(sp: Record<string, string | string[] | undefined>): FlashToastItem[] {
  const ok = firstString(sp.ok);
  const err = firstString(sp.error);
  const items: FlashToastItem[] = [];
  if (ok === "1") {
    items.push({ type: "success", message: "Saved", description: "Dealer profile was updated." });
  }
  if (ok === "credits_added") {
    items.push({ type: "success", message: "Credits added successfully." });
  }
  if (ok === "credits_recovered") {
    items.push({ type: "success", message: "Credits recovered successfully." });
  }
  if (err === "missing") {
    items.push({ type: "error", message: "Name and password are required." });
  }
  if (err === "credits_balance") {
    const bal = firstString(sp.bal) ?? "0";
    const req = firstString(sp.req) ?? "?";
    items.push({
      type: "error",
      message: "Not enough credits",
      description: `Remaining ${bal}, required ${req}.`,
    });
  }
  if (err === "credits_invalid") {
    items.push({ type: "error", message: "Choose valid credit values." });
  }
  if (err === "credits_db") {
    items.push({ type: "error", message: "Credit transaction failed." });
  }
  if (err === "delete") {
    items.push({
      type: "error",
      message: "Could not delete dealer",
      description: "Remove subscriber accounts first.",
    });
  }
  return items;
}

const textareaClass = cn(
  "flex min-h-[100px] w-full min-w-0 rounded-md border border-input bg-input-background px-3 py-2 text-base text-foreground outline-none transition-[color,box-shadow,border-color] duration-200 ease-out",
  "placeholder:text-muted-foreground",
  "md:text-sm",
  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
);

const FLASH_STRIP = ["ok", "error", "bal", "req"] as const;

export default async function ResellerEditDealerPage({ params, searchParams }: Props) {
  const s = await getSession();
  if (!s || s.type !== "SRSLR") redirect("/login?error=forbidden");

  const { username: raw } = await params;
  const un = decodeURIComponent(raw);
  const sp = (await searchParams) ?? {};

  const owned = await listDealersOwnedByReseller(s.username);
  const portalRow = owned.find((r: ResellerPortalDealerRow) => r.username === un);
  if (!portalRow) redirect("/reseller/dealers?error=forbidden");

  const d = await getDealerById(un);
  if (!d) notFound();

  const [settings, creditPreview] = await Promise.all([
    getSettings(),
    getHierarchyCreditPreviewBundle("RSLR", d.username),
  ]);
  const addMin = hierarchyAddCreditsMin("reseller_dealer", settings);
  const addMax = hierarchyAddCreditsMax(settings);
  const flashes = resellerDealerEditFlashes(sp);

  const breadcrumb = (
    <nav className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
      <Link href="/reseller/dealers" className="transition-colors hover:text-foreground">
        Dealers
      </Link>
      <span aria-hidden className="text-border">
        /
      </span>
      <span className="font-mono font-medium text-foreground">{d.username}</span>
    </nav>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      {flashes.length ? <FlashToastsBoundary items={flashes} stripParams={[...FLASH_STRIP]} /> : null}
      <PageHeader title="Edit dealer" breadcrumb={breadcrumb} showBack backHref="/reseller/dealers" backLabel="Back to list" />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_min(340px,100%)] lg:items-start">
        <Panel title="Profile & access" subtleHeader>
          <form action={saveResellerDealerAction} className="space-y-6">
            <input type="hidden" name="username" value={d.username} />

            <div className="space-y-2">
              <Label htmlFor="srl-edit-dlr-name">Display name</Label>
              <Input id="srl-edit-dlr-name" name="name" defaultValue={d.name} autoComplete="organization" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="srl-edit-dlr-username-ro">Username</Label>
              <p className="text-xs text-muted-foreground">Login cannot be changed.</p>
              <Input id="srl-edit-dlr-username-ro" readOnly value={d.username} className="font-mono text-muted-foreground" aria-readonly="true" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="srl-dlr-password-field">Password</Label>
              <p className="text-xs text-muted-foreground">Masked in the browser. Submit to keep or replace the billing password.</p>
              <PasswordInputWithToggle
                id="srl-dlr-password-field"
                name="password"
                autoComplete="new-password"
                defaultValue={d.passwordPlaceholder}
                className="font-mono"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="srl-edit-dlr-status">Status</Label>
              <FormSelect
                id="srl-edit-dlr-status"
                name="status"
                defaultValue={d.status}
                options={[
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Suspended" },
                ]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="srl-edit-dlr-tickets">Tickets in portal</Label>
              <div id="srl-edit-dlr-tickets" className="flex items-center gap-3">
                <label className="inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    name="tickets_manager"
                    value="Yes"
                    defaultChecked={d.ticketsManager === "Yes"}
                    className="peer sr-only"
                  />
                  <span className="relative h-7 w-12 rounded-full bg-muted/70 transition-colors duration-200 ease-out after:absolute after:left-0.5 after:top-0.5 after:h-6 after:w-6 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:duration-300 after:ease-[cubic-bezier(0.22,1,0.36,1)] after:content-[''] peer-checked:bg-emerald-500/85 peer-checked:after:translate-x-5 peer-active:after:scale-[0.96]" />
                </label>
                <span className="text-sm font-medium text-foreground">On / Off</span>
              </div>
              <input type="hidden" name="tickets_manager" value="No" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="srl-edit-dlr-comments">Internal notes</Label>
              <textarea id="srl-edit-dlr-comments" name="comments" rows={4} defaultValue={d.comments} className={textareaClass} />
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-border/60 pt-6 sm:flex-row sm:justify-end">
              <Link href="/reseller/dealers" className={buttonOutlineLinkClassName("inline-flex min-h-11 w-full justify-center sm:w-auto md:min-h-9")}>
                Discard
              </Link>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="h-auto w-full justify-center px-0 text-[11px] font-semibold uppercase tracking-wide text-primary underline decoration-primary/40 underline-offset-2 hover:bg-transparent hover:decoration-primary sm:w-auto"
              >
                Save changes
              </Button>
            </div>
          </form>

          <div className="mt-8 border-t border-border/60 pt-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Danger zone</p>
            <ResellerDeleteDealerForm username={d.username} canDelete={portalRow.canDelete} buttonLabel="Delete this dealer" className="w-full sm:w-auto" />
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Credit balance" subtleHeader>
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <CreditCard className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              <span>Add pulls from your reseller balance; recover returns credits (split rules apply).</span>
            </div>
            <HierarchyCreditsSplitForms
              username={d.username}
              addMin={addMin}
              addMax={addMax}
              currentBalance={d.credits}
              applyAction={applyResellerDealerCreditsAction}
              creditPreview={creditPreview}
              recoverPreviewRole="RSLR"
            />
          </Panel>

          <Panel title="Transaction history" subtleHeader>
            <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
              <History className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              <span>Recent credit movements for this dealer.</span>
            </div>
            <EndUserTransactionsTable rows={d.transactions} compact />
          </Panel>
        </div>
      </div>
    </div>
  );
}

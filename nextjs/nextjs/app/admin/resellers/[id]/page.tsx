import Link from "next/link";
import { notFound } from "next/navigation";
import { CreditCard, History } from "lucide-react";
import { getDeductionsConfig, getHierarchyCreditPreviewBundle, getResellerById, getSettings, listManagersForSelect } from "@/lib/data";
import { buildMonthDeductionChargedMap } from "@/lib/repos/accountCreate";
import { hierarchyAddCreditsMax, hierarchyAddCreditsMin } from "@/lib/repos/billing";
import { PageHeader } from "@/components/admin/PageHeader";
import { Panel } from "@/components/admin/Panel";
import { HierarchyCreditsSplitForms } from "@/components/portal/HierarchyCreditsSplitForms";
import { applyResellerCreditsAction, saveResellerAction } from "@/actions/forms";
import { EndUserTransactionsTable } from "@/components/admin/EndUserTransactionsTable";
import { PasswordInputWithToggle } from "@/components/forms/PasswordInputWithToggle";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SearchableFormSelect } from "@/components/forms/SearchableFormSelect";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { FlashToastsBoundary } from "@/components/FlashToasts";
import { hierarchyCreditsEditFlashItems } from "@/lib/adminInlineFlashToasts";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ ok?: string; error?: string; bal?: string; req?: string; credit?: string; modal?: string }>;
};

function formatInt(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

const textareaClass = cn(
  "flex min-h-[100px] w-full min-w-0 rounded-md border border-input bg-input-background px-3 py-2 text-base text-foreground outline-none transition-[color,box-shadow,border-color] duration-200 ease-out",
  "placeholder:text-muted-foreground",
  "md:text-sm",
  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
);

export default async function EditResellerPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const r = await getResellerById(decodeURIComponent(id));
  if (!r) notFound();
  const isModal = sp.modal === "1";
  const managers = await listManagersForSelect();
  const [settings, deductions] = await Promise.all([getSettings(), getDeductionsConfig()]);
  const addMin = hierarchyAddCreditsMin("admin_reseller", settings);
  const addMax = hierarchyAddCreditsMax(settings);
  const bonusChargedMap = buildMonthDeductionChargedMap(
    deductions.rows.map((d) => ({ month: d.month, month_deduction: Number(d.month_deduction) || 0 })),
  );
  const creditPreview = await getHierarchyCreditPreviewBundle("SRSLR", r.username);

  const breadcrumb = (
    <nav className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
      <Link href="/admin/managers" className="transition-colors hover:text-foreground">
        Staff
      </Link>
      <span aria-hidden className="text-border">
        /
      </span>
      <span className="font-mono font-medium text-foreground">{r.username}</span>
    </nav>
  );

  const creditFlashes = hierarchyCreditsEditFlashItems(sp, "reseller");

  return (
    <div className={cn("mx-auto w-full max-w-[min(100%,1440px)] space-y-6 pb-10", isModal ? "max-w-none space-y-4 pb-0" : "")}>
      {!isModal ? <PageHeader title="Edit reseller" breadcrumb={breadcrumb} showBack backHref="/admin/managers" backLabel="Back to staff" /> : null}
      {creditFlashes.length ? (
        <FlashToastsBoundary items={creditFlashes} stripParams={["ok", "error", "bal", "req"]} />
      ) : null}

      <section
        id="reseller-edit-main"
        className={cn(
          "grid gap-6 lg:grid-cols-[minmax(0,1fr)_min(420px,100%)] lg:items-start",
          isModal ? "rounded-2xl border border-border/60 bg-card/95 p-3 sm:p-4" : "",
        )}
      >
        {isModal ? (
          <div className="space-y-3">
            <div className="border-b border-border/60 pb-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Profile & access</h2>
            </div>
            <form action={saveResellerAction} className="space-y-6">
              <input type="hidden" name="_intent" value="edit" />
              <input type="hidden" name="username" value={r.username} />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="edit-res-name">Display name</Label>
                  <p className="min-h-[1.25rem] text-xs text-muted-foreground" aria-hidden>
                    &nbsp;
                  </p>
                  <Input id="edit-res-name" name="name" defaultValue={r.name} autoComplete="organization" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-res-username-ro">Username</Label>
                  <p className="min-h-[1.25rem] text-xs text-muted-foreground">Login cannot be changed.</p>
                  <Input id="edit-res-username-ro" readOnly value={r.username} className="font-mono text-muted-foreground" aria-readonly="true" />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="reseller-password-field">Password</Label>
                  <p className="min-h-[1.25rem] text-xs text-muted-foreground">Submit to keep or replace the billing password.</p>
                  <PasswordInputWithToggle
                    id="reseller-password-field"
                    name="password"
                    autoComplete="new-password"
                    defaultValue={r.password}
                    className="font-mono"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-res-manager">Manager</Label>
                  <p className="min-h-[1.25rem] text-xs text-muted-foreground" aria-hidden>
                    &nbsp;
                  </p>
                  <SearchableFormSelect
                    id="edit-res-manager"
                    name="manager"
                    defaultValue={r.manager}
                    searchPlaceholder="Search manager..."
                    options={managers.map((m) => ({
                      value: m.username,
                      label: `${m.name} (${m.username})`,
                    }))}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="edit-res-status">Status</Label>
                  <p className="min-h-[1.25rem] text-xs text-muted-foreground" aria-hidden>
                    &nbsp;
                  </p>
                  <div id="edit-res-status" className="flex items-center gap-3">
                    <label className="inline-flex cursor-pointer items-center">
                      <input type="checkbox" name="status" value="ACTIVE" defaultChecked={r.status === "ACTIVE"} className="peer sr-only" />
                      <span className="relative h-7 w-12 rounded-full bg-muted/70 transition-colors duration-200 ease-out after:absolute after:left-0.5 after:top-0.5 after:h-6 after:w-6 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:duration-300 after:ease-[cubic-bezier(0.22,1,0.36,1)] after:content-[''] peer-checked:bg-emerald-500/85 peer-checked:after:translate-x-5 peer-active:after:scale-[0.96]" />
                    </label>
                    <span className="text-sm font-medium text-foreground">Active / Suspended</span>
                  </div>
                  <input type="hidden" name="status" value="INACTIVE" />
                </div>
                <div className="space-y-1">
                  <p className="min-h-[1.25rem]" aria-hidden>
                    &nbsp;
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="edit-res-comments">Internal notes</Label>
                <textarea id="edit-res-comments" name="comments" rows={4} defaultValue={r.comments} className={textareaClass} />
              </div>

              <div className="flex border-t border-border/60 pt-6 sm:justify-end">
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
          </div>
        ) : (
          <Panel
            title="Profile & access"
            subtleHeader
            headerRight={
              <div className="text-right text-xs font-normal normal-case tracking-normal text-muted-foreground">
                <span>Under manager </span>
                <Link href={`/admin/managers/${encodeURIComponent(r.manager)}`} className="font-mono font-semibold text-primary hover:underline">
                  {r.manager}
                </Link>
              </div>
            }
          >
          <form action={saveResellerAction} className="space-y-6">
            <input type="hidden" name="_intent" value="edit" />
            <input type="hidden" name="username" value={r.username} />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="edit-res-name">Display name</Label>
                <p className="min-h-[1.25rem] text-xs text-muted-foreground" aria-hidden>
                  &nbsp;
                </p>
                <Input id="edit-res-name" name="name" defaultValue={r.name} autoComplete="organization" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-res-username-ro">Username</Label>
                <p className="min-h-[1.25rem] text-xs text-muted-foreground">Login cannot be changed.</p>
                <Input id="edit-res-username-ro" readOnly value={r.username} className="font-mono text-muted-foreground" aria-readonly="true" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="reseller-password-field">Password</Label>
                <p className="min-h-[1.25rem] text-xs text-muted-foreground">Submit to keep or replace the billing password.</p>
                <PasswordInputWithToggle
                  id="reseller-password-field"
                  name="password"
                  autoComplete="new-password"
                  defaultValue={r.password}
                  className="font-mono"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-res-manager">Manager</Label>
                <p className="min-h-[1.25rem] text-xs text-muted-foreground" aria-hidden>
                  &nbsp;
                </p>
                <SearchableFormSelect
                  id="edit-res-manager"
                  name="manager"
                  defaultValue={r.manager}
                  searchPlaceholder="Search manager..."
                  options={managers.map((m) => ({
                    value: m.username,
                    label: `${m.name} (${m.username})`,
                  }))}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="edit-res-status">Status</Label>
                <p className="min-h-[1.25rem] text-xs text-muted-foreground" aria-hidden>
                  &nbsp;
                </p>
                <div id="edit-res-status" className="flex items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center">
                    <input type="checkbox" name="status" value="ACTIVE" defaultChecked={r.status === "ACTIVE"} className="peer sr-only" />
                    <span className="relative h-7 w-12 rounded-full bg-muted/70 transition-colors duration-200 ease-out after:absolute after:left-0.5 after:top-0.5 after:h-6 after:w-6 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:duration-300 after:ease-[cubic-bezier(0.22,1,0.36,1)] after:content-[''] peer-checked:bg-emerald-500/85 peer-checked:after:translate-x-5 peer-active:after:scale-[0.96]" />
                  </label>
                  <span className="text-sm font-medium text-foreground">Active / Suspended</span>
                </div>
                <input type="hidden" name="status" value="INACTIVE" />
              </div>
              <div className="space-y-1">
                <p className="min-h-[1.25rem]" aria-hidden>
                  &nbsp;
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="edit-res-comments">Internal notes</Label>
              <textarea id="edit-res-comments" name="comments" rows={4} defaultValue={r.comments} className={textareaClass} />
            </div>

            <div className="flex border-t border-border/60 pt-6 sm:justify-end">
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
          </Panel>
        )}

        {isModal ? (
          <div className="space-y-3 lg:border-l lg:border-border/60 lg:pl-4">
            <div className="border-b border-border/60 pb-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Credit balance</h2>
            </div>
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <CreditCard className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              <span>Add pulls from admin pool; recover returns credits (split rules apply).</span>
            </div>
            <HierarchyCreditsSplitForms
              username={r.username}
              addMin={addMin}
              addMax={addMax}
              currentBalance={r.credits}
              applyAction={applyResellerCreditsAction}
              bonusChargedMap={bonusChargedMap}
              creditPreview={creditPreview}
              recoverPreviewRole="SRSLR"
            />
          </div>
        ) : (
          <Panel title="Credit balance" subtleHeader>
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <CreditCard className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              <span>Add pulls from admin pool; recover returns credits (split rules apply).</span>
            </div>
            <HierarchyCreditsSplitForms
              username={r.username}
              addMin={addMin}
              addMax={addMax}
              currentBalance={r.credits}
              applyAction={applyResellerCreditsAction}
              bonusChargedMap={bonusChargedMap}
              creditPreview={creditPreview}
              recoverPreviewRole="SRSLR"
            />
          </Panel>
        )}
      </section>
      {!isModal ? (
        <section id="reseller-transaction-history">
          <Panel title="Transaction history" subtleHeader>
            <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
              <History className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              <span>Recent credit movements for this reseller.</span>
            </div>
            <EndUserTransactionsTable rows={r.transactions} />
          </Panel>
        </section>
      ) : null}
    </div>
  );
}

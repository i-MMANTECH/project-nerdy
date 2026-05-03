import Link from "next/link";
import { UserPlus } from "lucide-react";
import { listResellersForSelect } from "@/lib/data";
import { PageHeader } from "@/components/admin/PageHeader";
import { Panel } from "@/components/admin/Panel";
import { saveDealerAction } from "@/actions/forms";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SearchableFormSelect } from "@/components/forms/SearchableFormSelect";
import { Button, buttonOutlineLinkClassName } from "@/components/ui/button";
import { FlashToastsBoundary } from "@/components/FlashToasts";
import { adminHierarchyNewMissingFlashItems } from "@/lib/urlFlashToasts";

type Props = { searchParams?: Promise<{ error?: string }> };

export default async function NewDealerPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const newFlashes = adminHierarchyNewMissingFlashItems(sp, "admin_dealer");
  const resellers = await listResellersForSelect();

  const breadcrumb = (
    <nav className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
      <Link href="/admin/managers" className="transition-colors hover:text-foreground">
        Staff
      </Link>
      <span aria-hidden className="text-border">
        /
      </span>
      <span className="font-medium text-foreground">Add dealer</span>
    </nav>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      <PageHeader title="Add dealer" breadcrumb={breadcrumb} showBack backHref="/admin/managers" backLabel="Back to staff" />
      {newFlashes.length ? <FlashToastsBoundary items={newFlashes} stripParams={["error"]} /> : null}

      <p className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
        Dealers belong to a reseller and manage day-to-day subscriber accounts. Enable tickets only if this shop should handle
        support tickets in the portal.
      </p>

      <Panel title="Account details" subtleHeader>
        <form action={saveDealerAction} className="space-y-6">
          <input type="hidden" name="_intent" value="new" />

          <div className="space-y-2">
            <Label htmlFor="new-dlr-name">Display name</Label>
            <Input id="new-dlr-name" name="name" autoComplete="organization" placeholder="e.g. Main street office" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-dlr-username">Username</Label>
            <p className="text-xs text-muted-foreground">Unique login for this dealer.</p>
            <Input id="new-dlr-username" name="username" autoComplete="username" placeholder="e.g. shop_main" className="font-mono" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-dlr-password">Password</Label>
            <Input id="new-dlr-password" name="password" type="password" autoComplete="new-password" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-dlr-reseller">Parent reseller</Label>
            <SearchableFormSelect
              id="new-dlr-reseller"
              name="username_owner"
              required
              initialUnset
              placeholder="Select reseller"
              searchPlaceholder="Search reseller..."
              options={resellers.map((r) => ({
                value: r.username,
                label: `${r.name} (${r.username})`,
              }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-dlr-tickets">Tickets in portal</Label>
            <p className="text-xs text-muted-foreground">Allow this dealer to work the ticket queue.</p>
            <div id="new-dlr-tickets" className="flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center">
                <input type="checkbox" name="tickets_manager" value="Yes" className="peer sr-only" />
                <span className="relative h-7 w-12 rounded-full bg-muted/70 transition-colors duration-200 ease-out after:absolute after:left-0.5 after:top-0.5 after:h-6 after:w-6 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:duration-300 after:ease-[cubic-bezier(0.22,1,0.36,1)] after:content-[''] peer-checked:bg-emerald-500/85 peer-checked:after:translate-x-5 peer-active:after:scale-[0.96]" />
              </label>
              <span className="text-sm font-medium text-foreground">On / Off</span>
            </div>
            <input type="hidden" name="tickets_manager" value="No" />
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-border/60 pt-6 sm:flex-row sm:justify-end">
            <Link href="/admin/managers" className={buttonOutlineLinkClassName("inline-flex min-h-11 w-full justify-center sm:w-auto md:min-h-9")}>
              Cancel
            </Link>
            <Button type="submit" className="min-h-11 w-full gap-2 sm:w-auto md:min-h-9">
              <UserPlus className="h-4 w-4" aria-hidden />
              Create dealer
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}

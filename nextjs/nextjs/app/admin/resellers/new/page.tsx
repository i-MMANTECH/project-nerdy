import Link from "next/link";
import { UserPlus } from "lucide-react";
import { listManagersForSelect } from "@/lib/data";
import { PageHeader } from "@/components/admin/PageHeader";
import { Panel } from "@/components/admin/Panel";
import { saveResellerAction } from "@/actions/forms";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/forms/form-select";
import { Button, buttonOutlineLinkClassName } from "@/components/ui/button";
import { FlashToastsBoundary } from "@/components/FlashToasts";
import { adminHierarchyNewMissingFlashItems } from "@/lib/urlFlashToasts";

type Props = { searchParams?: Promise<{ error?: string }> };

export default async function NewResellerPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const newFlashes = adminHierarchyNewMissingFlashItems(sp, "admin_reseller");
  const managers = await listManagersForSelect();

  const breadcrumb = (
    <nav className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
      <Link href="/admin/managers" className="transition-colors hover:text-foreground">
        Staff
      </Link>
      <span aria-hidden className="text-border">
        /
      </span>
      <span className="font-medium text-foreground">Add reseller</span>
    </nav>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      <PageHeader title="Add reseller" breadcrumb={breadcrumb} showBack backHref="/admin/managers" backLabel="Back to staff" />
      {newFlashes.length ? <FlashToastsBoundary items={newFlashes} stripParams={["error"]} /> : null}

      <p className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
        Resellers sit under a manager, add dealers, and can own user accounts. Username becomes their portal login.
      </p>

      <Panel title="Account details" subtleHeader>
        <form action={saveResellerAction} className="space-y-6">
          <input type="hidden" name="_intent" value="new" />

          <div className="space-y-2">
            <Label htmlFor="new-res-name">Display name</Label>
            <p className="text-xs text-muted-foreground">Shown in admin lists and hierarchy.</p>
            <Input id="new-res-name" name="name" autoComplete="organization" placeholder="e.g. City cable partner" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-res-username">Username</Label>
            <p className="text-xs text-muted-foreground">Unique billing login; stored lowercase.</p>
            <Input id="new-res-username" name="username" autoComplete="username" placeholder="e.g. partner01" className="font-mono" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-res-password">Password</Label>
            <Input id="new-res-password" name="password" type="password" autoComplete="new-password" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-res-manager">Manager</Label>
            <p className="text-xs text-muted-foreground">This reseller reports under the selected manager.</p>
            <FormSelect
              id="new-res-manager"
              name="manager"
              required
              initialUnset
              placeholder="Select manager"
              options={managers.map((m) => ({
                value: m.username,
                label: `${m.name} (${m.username})`,
              }))}
            />
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-border/60 pt-6 sm:flex-row sm:justify-end">
            <Link href="/admin/managers" className={buttonOutlineLinkClassName("inline-flex min-h-11 w-full justify-center sm:w-auto md:min-h-9")}>
              Cancel
            </Link>
            <Button type="submit" className="min-h-11 w-full gap-2 sm:w-auto md:min-h-9">
              <UserPlus className="h-4 w-4" aria-hidden />
              Create reseller
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}

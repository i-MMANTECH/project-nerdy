import Link from "next/link";
import { UserPlus } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Panel } from "@/components/admin/Panel";
import { saveManagerAction } from "@/actions/forms";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button, buttonOutlineLinkClassName } from "@/components/ui/button";
import { FlashToastsBoundary } from "@/components/FlashToasts";
import { adminHierarchyNewMissingFlashItems } from "@/lib/urlFlashToasts";

type Props = { searchParams?: Promise<{ error?: string }> };

export default async function NewManagerPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const newFlashes = adminHierarchyNewMissingFlashItems(sp, "manager");

  const breadcrumb = (
    <nav className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
      <Link href="/admin/managers" className="transition-colors hover:text-foreground">
        Staff
      </Link>
      <span aria-hidden className="text-border">
        /
      </span>
      <span className="font-medium text-foreground">Add manager</span>
    </nav>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      <PageHeader title="Add manager" breadcrumb={breadcrumb} showBack backHref="/admin/managers" backLabel="Back to staff" />
      {newFlashes.length ? <FlashToastsBoundary items={newFlashes} stripParams={["error"]} /> : null}

      <p className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
        Managers sign in to the billing portal, add resellers and dealers, and oversee users in their branch. Choose a
        unique username; it becomes their login.
      </p>

      <Panel title="Account details" subtleHeader>
        <form action={saveManagerAction} className="space-y-6">
          <input type="hidden" name="_intent" value="new" />

          <div className="space-y-2">
            <Label htmlFor="new-mgr-name">Display name</Label>
            <p className="text-xs text-muted-foreground">Shown in lists and reports (not the login).</p>
            <Input id="new-mgr-name" name="name" autoComplete="name" placeholder="e.g. North region lead" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-mgr-username">Username</Label>
            <p className="text-xs text-muted-foreground">Billing login; letters and numbers, stored in lowercase.</p>
            <Input
              id="new-mgr-username"
              name="username"
              autoComplete="username"
              placeholder="e.g. jsmith"
              className="font-mono"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-mgr-password">Password</Label>
            <p className="text-xs text-muted-foreground">Initial portal password. They can change it after first sign-in.</p>
            <Input id="new-mgr-password" name="password" type="password" autoComplete="new-password" required />
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-border/60 pt-6 sm:flex-row sm:justify-end">
            <Link href="/admin/managers" className={buttonOutlineLinkClassName("inline-flex min-h-11 w-full justify-center sm:w-auto md:min-h-9")}>
              Cancel
            </Link>
            <Button type="submit" className="min-h-11 w-full gap-2 sm:w-auto md:min-h-9">
              <UserPlus className="h-4 w-4" aria-hidden />
              Create manager
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}

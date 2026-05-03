import Link from "next/link";
import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import { getSession } from "@/lib/session";
import { listResellersOwnedByManager } from "@/lib/data";
import { PageHeader } from "@/components/admin/PageHeader";
import { Panel } from "@/components/admin/Panel";
import { createManagerDealerAction } from "@/actions/forms";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SearchableFormSelect } from "@/components/forms/SearchableFormSelect";
import { Button, buttonOutlineLinkClassName } from "@/components/ui/button";
import { FlashToastsBoundary } from "@/components/FlashToasts";
import { managerDealerNewFlashItems } from "@/lib/urlFlashToasts";

type Props = { searchParams?: Promise<{ error?: string; reseller?: string }> };

export default async function ManagerNewDealerPage({ searchParams }: Props) {
  const s = await getSession();
  if (!s || s.type !== "MNGR") redirect("/login?error=forbidden");

  const sp = (await searchParams) ?? {};
  const newFlashes = managerDealerNewFlashItems(sp);
  const resellers = await listResellersOwnedByManager(s.username);
  const prefReseller = (sp.reseller ?? "").trim();
  const defaultReseller =
    prefReseller && resellers.some((r) => r.username === prefReseller) ? prefReseller : "";

  const breadcrumb = (
    <nav className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
      <Link href="/manager/dealers" className="transition-colors hover:text-foreground">
        Dealers
      </Link>
      <span aria-hidden className="text-border">
        /
      </span>
      <span className="font-medium text-foreground">Add dealer</span>
    </nav>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      <PageHeader title="Add dealer" breadcrumb={breadcrumb} showBack backHref="/manager/dealers" backLabel="Back to list" />
      {newFlashes.length ? <FlashToastsBoundary items={newFlashes} stripParams={["error"]} /> : null}

      {resellers.length === 0 ? (
        <p className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          Create a reseller first, then you can add dealers under them.
        </p>
      ) : (
        <p className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
          Dealers log in with the username you set and sell under the selected reseller. Tickets portal access stays off until
          changed on edit (matches legacy defaults).
        </p>
      )}

      {resellers.length > 0 ? (
        <Panel title="Account details" subtleHeader>
          <form action={createManagerDealerAction} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="mgr-new-dlr-name">Display name</Label>
              <Input id="mgr-new-dlr-name" name="name" autoComplete="organization" placeholder="e.g. Downtown shop" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mgr-new-dlr-username">Username</Label>
              <p className="text-xs text-muted-foreground">Unique billing login; stored lowercase.</p>
              <Input id="mgr-new-dlr-username" name="username" autoComplete="username" placeholder="e.g. shop01" className="font-mono" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mgr-new-dlr-password">Password</Label>
              <Input id="mgr-new-dlr-password" name="password" type="password" autoComplete="new-password" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mgr-new-dlr-reseller">Parent reseller</Label>
              <SearchableFormSelect
                id="mgr-new-dlr-reseller"
                name="reseller"
                required
                placeholder="Select reseller"
                searchPlaceholder="Search reseller..."
                {...(defaultReseller
                  ? { defaultValue: defaultReseller }
                  : { initialUnset: true })}
                options={resellers.map((r) => ({
                  value: r.username,
                  label: `${r.name || r.username} (${r.username})`,
                }))}
              />
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-border/60 pt-6 sm:flex-row sm:justify-end">
              <Link href="/manager/dealers" className={buttonOutlineLinkClassName("inline-flex min-h-11 w-full justify-center sm:w-auto md:min-h-9")}>
                Cancel
              </Link>
              <Button type="submit" className="min-h-11 w-full gap-2 sm:w-auto md:min-h-9">
                <UserPlus className="h-4 w-4" aria-hidden />
                Create dealer
              </Button>
            </div>
          </form>
        </Panel>
      ) : null}
    </div>
  );
}

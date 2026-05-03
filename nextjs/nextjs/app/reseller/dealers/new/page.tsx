import Link from "next/link";
import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/admin/PageHeader";
import { Panel } from "@/components/admin/Panel";
import { createResellerDealerAction } from "@/actions/forms";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button, buttonOutlineLinkClassName } from "@/components/ui/button";
import { FlashToastsBoundary } from "@/components/FlashToasts";
import { resellerDealerNewFlashItems } from "@/lib/urlFlashToasts";

type Props = { searchParams?: Promise<{ error?: string }> };

export default async function ResellerNewDealerPage({ searchParams }: Props) {
  const s = await getSession();
  if (!s || s.type !== "SRSLR") redirect("/login?error=forbidden");

  const sp = (await searchParams) ?? {};
  const newFlashes = resellerDealerNewFlashItems(sp);

  const breadcrumb = (
    <nav className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
      <Link href="/reseller/dealers" className="transition-colors hover:text-foreground">
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
      <PageHeader title="Add dealer" breadcrumb={breadcrumb} showBack backHref="/reseller/dealers" backLabel="Back to list" />
      {newFlashes.length ? <FlashToastsBoundary items={newFlashes} stripParams={["error"]} /> : null}

      <p className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
        New dealers are created under your reseller login. They manage end-user subscriber accounts for your branch.
      </p>

      <Panel title="Account details" subtleHeader>
        <form action={createResellerDealerAction} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="srl-new-dlr-name">Display name</Label>
            <Input id="srl-new-dlr-name" name="name" autoComplete="organization" placeholder="e.g. Downtown shop" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="srl-new-dlr-username">Username</Label>
            <p className="text-xs text-muted-foreground">Unique billing login; stored lowercase.</p>
            <Input id="srl-new-dlr-username" name="username" autoComplete="username" placeholder="e.g. shop01" className="font-mono" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="srl-new-dlr-password">Password</Label>
            <Input id="srl-new-dlr-password" name="password" type="password" autoComplete="new-password" required />
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-border/60 pt-6 sm:flex-row sm:justify-end">
            <Link href="/reseller/dealers" className={buttonOutlineLinkClassName("inline-flex min-h-11 w-full justify-center sm:w-auto md:min-h-9")}>
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

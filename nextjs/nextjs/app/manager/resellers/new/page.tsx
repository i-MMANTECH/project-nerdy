import Link from "next/link";
import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import { getSession } from "@/lib/session";
import { getCreditBalance } from "@/lib/repos/billing";
import { PageHeader } from "@/components/admin/PageHeader";
import { Panel } from "@/components/admin/Panel";
import { createManagerResellerAction } from "@/actions/forms";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button, buttonOutlineLinkClassName } from "@/components/ui/button";
import { FlashToastsBoundary } from "@/components/FlashToasts";
import { managerResellerNewFlashItems } from "@/lib/urlFlashToasts";

type Props = { searchParams?: Promise<{ error?: string }> };

function formatInt(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

export default async function ManagerNewResellerPage({ searchParams }: Props) {
  const s = await getSession();
  if (!s || s.type !== "MNGR") redirect("/login?error=forbidden");

  const sp = (await searchParams) ?? {};
  const bal = await getCreditBalance(s.username);
  const newFlashes = managerResellerNewFlashItems(sp, formatInt(bal));

  const breadcrumb = (
    <nav className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
      <Link href="/manager/resellers" className="transition-colors hover:text-foreground">
        Resellers
      </Link>
      <span aria-hidden className="text-border">
        /
      </span>
      <span className="font-medium text-foreground">Add reseller</span>
    </nav>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      <PageHeader title="Add reseller" breadcrumb={breadcrumb} showBack backHref="/manager/resellers" backLabel="Back to list" />
      {newFlashes.length ? <FlashToastsBoundary items={newFlashes} stripParams={["error"]} /> : null}

      <p className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
        New resellers are created under your manager login. They can add dealers and own user accounts. Your current credit
        balance: <span className="font-mono font-semibold text-foreground">{formatInt(bal)}</span>.
      </p>

      <Panel title="Account details" subtleHeader>
        <form action={createManagerResellerAction} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="mgr-new-res-name">Display name</Label>
            <p className="text-xs text-muted-foreground">Shown in lists and hierarchy.</p>
            <Input id="mgr-new-res-name" name="name" autoComplete="organization" placeholder="e.g. City cable partner" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mgr-new-res-username">Username</Label>
            <p className="text-xs text-muted-foreground">Unique billing login; stored lowercase.</p>
            <Input id="mgr-new-res-username" name="username" autoComplete="username" placeholder="e.g. partner01" className="font-mono" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mgr-new-res-password">Password</Label>
            <Input id="mgr-new-res-password" name="password" type="password" autoComplete="new-password" required />
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-border/60 pt-6 sm:flex-row sm:justify-end">
            <Link href="/manager/resellers" className={buttonOutlineLinkClassName("inline-flex min-h-11 w-full justify-center sm:w-auto md:min-h-9")}>
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

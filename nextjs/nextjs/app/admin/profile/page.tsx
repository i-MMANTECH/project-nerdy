import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { Panel } from "@/components/admin/Panel";
import { changePasswordAction } from "@/actions/forms";
import { Button, buttonOutlineLinkClassName } from "@/components/ui/button";
import { FlashToastsBoundary } from "@/components/FlashToasts";
import { adminProfilePasswordFlashItems } from "@/lib/urlFlashToasts";

type Props = { searchParams?: Promise<{ ok?: string; error?: string }> };

export default async function ProfilePage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const profileFlashes = adminProfilePasswordFlashItems(sp);

  return (
    <div>
      <PageHeader title="Change Password" breadcrumb="Home › Profile" />
      {profileFlashes.length ? <FlashToastsBoundary items={profileFlashes} stripParams={["error"]} /> : null}
      <Panel title="Change Password">
        <form action={changePasswordAction} className="mx-auto max-w-xl space-y-4">
          <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
            <label className="text-sm font-semibold text-foreground">Current Password</label>
            <input
              name="old_password"
              type="password"
              autoComplete="current-password"
              placeholder="Type your current password"
              className="rounded border border-input bg-muted/50 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
            <label className="text-sm font-semibold text-foreground">New Password</label>
            <input
              name="new_password"
              type="password"
              autoComplete="new-password"
              placeholder="Type your New Password"
              className="rounded border border-input bg-muted/50 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
            <label className="text-sm font-semibold text-foreground">Retype New Password</label>
            <input
              name="new_confirm_passsword"
              type="password"
              autoComplete="new-password"
              placeholder="Retype your New Password"
              className="rounded border border-input bg-muted/50 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit">Save password</Button>
            <Link href="/admin/dashboard" className={buttonOutlineLinkClassName("bg-card shadow-sm")}>
              Cancel
            </Link>
          </div>
        </form>
      </Panel>
    </div>
  );
}

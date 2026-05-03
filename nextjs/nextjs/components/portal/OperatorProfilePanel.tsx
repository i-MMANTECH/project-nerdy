import Link from "next/link";
import { Panel } from "@/components/admin/Panel";
import { changeOperatorPasswordAction } from "@/actions/forms";
import { Button, buttonOutlineLinkClassName } from "@/components/ui/button";

export function OperatorProfilePanel({ cancelHref }: { cancelHref: string }) {
  return (
    <Panel title="Change Password">
      <form action={changeOperatorPasswordAction} className="mx-auto max-w-xl space-y-4">
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
            placeholder="4–12 characters (PHP form rules)"
            className="rounded border border-input bg-muted/50 px-3 py-2 text-sm"
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
          <label className="text-sm font-semibold text-foreground">Retype New Password</label>
          <input
            name="new_confirm_passsword"
            type="password"
            autoComplete="new-password"
            placeholder="Retype your new password"
            className="rounded border border-input bg-muted/50 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">Save password</Button>
          <Link href={cancelHref} className={buttonOutlineLinkClassName("bg-card shadow-sm")}>
            Cancel
          </Link>
        </div>
      </form>
    </Panel>
  );
}

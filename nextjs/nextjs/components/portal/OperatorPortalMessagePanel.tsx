"use client";

import Link from "next/link";
import { Panel } from "@/components/admin/Panel";
import { Alert } from "@/components/ui/alert";
import { FormSelect } from "@/components/forms/form-select";
import { NativeSelect } from "@/components/ui/select";
import { sendOperatorPortalMessageAction } from "@/actions/forms";
import type { StalkerMessageUserOption } from "@/lib/repos/billing";
import { cn } from "@/lib/cn";
import { Button, buttonOutlineLinkClassName } from "@/components/ui/button";

const multiSelectClass = cn(
  "thin-scrollbar min-h-[12rem] w-full rounded-lg border border-input bg-input-background px-2 py-2 font-mono text-sm text-foreground shadow-sm outline-none transition-[border-color,box-shadow] duration-200 ease-out",
  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
  "[&>option]:bg-card [&>option]:py-1 [&>option]:text-foreground",
);

export function OperatorPortalMessagePanel({
  stalkerUsers,
  cancelHref,
}: {
  stalkerUsers: StalkerMessageUserOption[];
  cancelHref: string;
}) {
  return (
    <Panel title="Send Message">
      <form action={sendOperatorPortalMessageAction} className="mx-auto max-w-2xl space-y-3.5">
        <div className="grid gap-1 sm:grid-cols-[100px_1fr] sm:items-center">
          <label htmlFor="opm-audience" className="text-sm font-semibold text-foreground">
            Users
          </label>
          <FormSelect
            id="opm-audience"
            name="type"
            defaultValue="All"
            options={[
              { value: "All", label: "To All" },
              { value: "Custom", label: "Custom selection" },
            ]}
            className="h-10"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-foreground">Stalker users (hold Ctrl/Cmd to select several)</label>
          {stalkerUsers.length ? (
            <NativeSelect name="users" multiple size={12} className={multiSelectClass}>
              {stalkerUsers.map((u) => (
                <option key={u.id} value={u.login}>
                  {u.login}
                </option>
              ))}
            </NativeSelect>
          ) : (
            <Alert>
              No Stalker users matched your billing accounts. Check Stalker DB env and that users exist under your hierarchy.
            </Alert>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            “To All” sends to every device whose Stalker login matches a user account in your portal scope (same idea as PHP portal Message). Custom selection submits billing logins like PHP <span className="font-mono">users[]</span> / account values.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-foreground">Message</label>
          <textarea
            name="message"
            rows={7}
            placeholder="Type Your Message"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-inner outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">Send message</Button>
          <Link href={cancelHref} className={buttonOutlineLinkClassName("bg-card shadow-sm")}>
            Cancel
          </Link>
        </div>
      </form>
    </Panel>
  );
}

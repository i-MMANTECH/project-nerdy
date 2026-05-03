import { Search, User } from "lucide-react";
import type { FlashToastItem } from "@/components/FlashToasts";
import { FlashToastsBoundary } from "@/components/FlashToasts";
import { PageHeader } from "@/components/admin/PageHeader";
import { changeOperatorPasswordAction } from "@/actions/forms";
import type { PortalBase } from "@/lib/portal-nav";
import Link from "next/link";

function firstString(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function profileFlashItems(sp: Record<string, string | string[] | undefined>): FlashToastItem[] {
  const code = firstString(sp.error);
  if (!code) return [];
  const message =
    code === "match"
      ? "New passwords do not match."
      : code === "old"
        ? "Current password is incorrect."
        : code === "old_len"
          ? "Current password must be between 3 and 100 characters."
          : code === "new_len"
            ? "New password must be between 4 and 12 characters (PHP portal rules)."
            : "Could not update password.";
  return [{ type: "error" as const, message }];
}

export function OperatorProfilePage({
  portalBase,
  username,
  displayName,
  searchParams: sp,
}: {
  portalBase: PortalBase;
  username: string;
  displayName: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const who = displayName?.trim() || username;
  const flashes = profileFlashItems(sp);

  return (
    <div className="mx-auto w-full max-w-[min(100%,1920px)] space-y-6 pb-10">
      {flashes.length ? <FlashToastsBoundary items={flashes} stripParams={["error"]} /> : null}
      <PageHeader
        title="My profile"
        breadcrumb="Home › Profile"
        showBack={false}
        actions={
          <form action={`${portalBase}/users`} method="get" className="w-full min-w-0 sm:max-w-md">
            <label className="sr-only" htmlFor="portal-profile-search">
              Search subscribers
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                id="portal-profile-search"
                name="query"
                type="search"
                placeholder="Search subscribers, MAC account…"
                className="h-10 w-full rounded-lg border border-border/80 bg-background/80 py-2 pl-10 pr-3 text-sm text-foreground shadow-inner outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </form>
        }
      />
      <p className="text-sm text-muted-foreground">
        Account and password for <span className="font-medium text-foreground">{who}</span> ({username}). After a successful change you will be
        signed out and need to log in again.
      </p>

      <section
        aria-labelledby="portal-profile-password"
        className="rounded-2xl border border-border/60 bg-card/95 p-5 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06] sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
            <User className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 id="portal-profile-password" className="text-base font-semibold tracking-tight text-foreground">
              Change password
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">Same rules as the PHP manager / reseller / dealer profile screen.</p>
          </div>
        </div>

        <form action={changeOperatorPasswordAction} className="mt-6 max-w-xl space-y-4">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,160px)_1fr] sm:items-center">
            <label htmlFor="old_password" className="text-sm font-semibold text-foreground">
              Current password
            </label>
            <input
              id="old_password"
              name="old_password"
              type="password"
              autoComplete="current-password"
              placeholder="Current password"
              className="h-11 rounded-lg border border-border/80 bg-background/80 px-3 text-sm text-foreground shadow-inner outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,160px)_1fr] sm:items-center">
            <label htmlFor="new_password" className="text-sm font-semibold text-foreground">
              New password
            </label>
            <input
              id="new_password"
              name="new_password"
              type="password"
              autoComplete="new-password"
              placeholder="4–12 characters"
              className="h-11 rounded-lg border border-border/80 bg-background/80 px-3 text-sm text-foreground shadow-inner outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,160px)_1fr] sm:items-center">
            <label htmlFor="new_confirm_passsword" className="text-sm font-semibold text-foreground">
              Confirm new password
            </label>
            <input
              id="new_confirm_passsword"
              name="new_confirm_passsword"
              type="password"
              autoComplete="new-password"
              placeholder="Retype new password"
              className="h-11 rounded-lg border border-border/80 bg-background/80 px-3 text-sm text-foreground shadow-inner outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
            >
              Save password
            </button>
            <Link
              href={portalBase}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-border/80 bg-muted/30 px-5 text-sm font-semibold text-foreground transition hover:bg-muted/50"
            >
              Cancel
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}

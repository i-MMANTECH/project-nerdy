import { Search, Fingerprint } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { checkMacDealerAction, checkMacManagerAction, checkMacResellerAction } from "@/actions/forms";
import { MacAddressInput } from "@/components/forms/MacAddressInput";
import type { PortalBase } from "@/lib/portal-nav";
import { cn } from "@/lib/cn";

type OwnerType = "MNGR" | "SRSLR" | "RSLR";

function checkMacActionForRole(ownerType: OwnerType) {
  if (ownerType === "MNGR") return checkMacManagerAction;
  if (ownerType === "SRSLR") return checkMacResellerAction;
  return checkMacDealerAction;
}

function OutcomePanel({
  out,
  expired,
  expiresRaw,
}: {
  out: string | undefined;
  expired: string | undefined;
  expiresRaw: string | undefined;
}) {
  if (!out || out === "") {
    return (
      <p className="text-sm text-muted-foreground">
        Enter a device MAC address to see whether it is already registered on a user account.
      </p>
    );
  }

  if (out === "missing") {
    return (
      <div
        role="status"
        className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
      >
        Please enter a MAC address before checking.
      </div>
    );
  }

  if (out === "invalid") {
    return (
      <div
        role="status"
        className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
      >
        This does not look like a valid MAC. Use six hex pairs, for example{" "}
        <span className="font-mono text-foreground">AA:BB:CC:DD:EE:FF</span> or{" "}
        <span className="font-mono text-foreground">AA-BB-CC-DD-EE-FF</span>.
      </div>
    );
  }

  if (out === "available") {
    return (
      <div
        role="status"
        className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
      >
        No user account uses this MAC. It is available to assign to a new or existing account.
      </div>
    );
  }

  if (out === "ambiguous") {
    return (
      <div
        role="status"
        className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
      >
        More than one account matched this MAC in billing. Data should be cleaned up so the MAC is unique.
      </div>
    );
  }

  if (out === "exists") {
    const isExpired = expired === "1";
    const expiresLabel =
      expiresRaw && expiresRaw.trim() !== ""
        ? expiresRaw.includes("T")
          ? expiresRaw
          : expiresRaw.replace(" ", "T")
        : null;
    const pretty = expiresLabel
      ? (() => {
          const d = new Date(expiresLabel);
          return Number.isNaN(d.getTime()) ? expiresRaw : d.toLocaleString();
        })()
      : null;
    return (
      <div
        role="status"
        className={cn(
          "rounded-lg border px-4 py-3 text-sm",
          isExpired
            ? "border-rose-500/35 bg-rose-500/10 text-rose-100"
            : "border-sky-500/35 bg-sky-500/10 text-sky-100",
        )}
      >
        <p className="font-medium text-foreground">This MAC is already in use.</p>
        <p className="mt-1 text-muted-foreground">
          Status:{" "}
          <span className={cn("font-semibold", isExpired ? "text-rose-200" : "text-emerald-200")}>
            {isExpired ? "Expired" : "Active or not expired"}
          </span>
          {pretty ? (
            <>
              {" "}
              · Expiry: <span className="font-mono text-foreground">{pretty}</span>
            </>
          ) : null}
        </p>
      </div>
    );
  }

  return (
    <div role="status" className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
      Unknown result. Try again.
    </div>
  );
}

export function OperatorCheckMacPage({
  portalBase,
  ownerType,
  searchParams: sp,
}: {
  portalBase: PortalBase;
  ownerType: OwnerType;
  searchParams: { out?: string; expired?: string; e?: string };
}) {
  const action = checkMacActionForRole(ownerType);
  const out = sp.out?.trim();
  const expired = sp.expired?.trim();
  let expiresRaw: string | undefined;
  try {
    expiresRaw = sp.e ? decodeURIComponent(sp.e) : undefined;
  } catch {
    expiresRaw = sp.e;
  }

  return (
    <div className="mx-auto w-full max-w-[min(100%,1920px)] space-y-6 pb-10">
      <PageHeader
        title="Check MAC"
        breadcrumb="Home › Check MAC"
        showBack={false}
        actions={
          <form action={`${portalBase}/users`} method="get" className="w-full min-w-0 sm:max-w-md">
            <label className="sr-only" htmlFor="portal-mac-search">
              Search users
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                id="portal-mac-search"
                name="query"
                type="search"
                placeholder="Search users, MAC account…"
                className="h-10 w-full rounded-lg border border-border/80 bg-background/80 py-2 pl-10 pr-3 text-sm text-foreground shadow-inner outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </form>
        }
      />
      <p className="text-sm text-muted-foreground">Validate whether a device MAC exists in billing.</p>

      <section
        aria-labelledby="check-mac-heading"
        className="rounded-2xl border border-border/60 bg-card/95 p-5 shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06] sm:p-6"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
              <Fingerprint className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 id="check-mac-heading" className="text-base font-semibold tracking-tight text-foreground">
                MAC lookup
              </h2>
              <p className="text-xs text-muted-foreground">
                Matches billing <span className="font-medium text-foreground">accounts.mac</span> (same rules as PHP).
              </p>
            </div>
          </div>
        </div>

        <form action={action} className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-0 flex-1 sm:max-w-xl">
            <label htmlFor="mac-input" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              MAC address
            </label>
            <MacAddressInput
              id="mac-input"
              name="mac"
              placeholder="AA:BB:CC:DD:EE:FF"
              className="h-11 w-full rounded-lg border border-border/80 bg-background/80 px-3 font-mono text-sm uppercase text-foreground shadow-inner outline-none ring-offset-background placeholder:normal-case placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            Check MAC
          </button>
        </form>

        <div className="mt-6 border-t border-border/60 pt-6">
          <OutcomePanel out={out} expired={expired} expiresRaw={expiresRaw} />
        </div>
      </section>
    </div>
  );
}


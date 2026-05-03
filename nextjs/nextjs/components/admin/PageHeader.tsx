import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  title: string;
  /** Optional one-line subtitle under the title. */
  subtitle?: ReactNode;
  breadcrumb?: ReactNode;
  /** When true, shows a prominent BACK link (sidebar makes this optional on list pages). */
  showBack?: boolean;
  /** Target for BACK (admin default: dashboard; portals should pass e.g. `/manager`). */
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  className?: string;
  /** Hide the visible title block (rare — list pages whose own toolbar carries the heading). */
  hideVisibleTitle?: boolean;
};

/**
 * HUD-style page header — visible gradient title + breadcrumb + optional actions.
 * Drop-in compatible with the original (which only rendered an `sr-only` h1):
 * existing pages that pass just `title` now get a real animated heading for free.
 */
export function PageHeader({
  title,
  subtitle,
  breadcrumb,
  showBack = false,
  backHref = "/admin/dashboard",
  backLabel = "BACK",
  actions,
  className,
  hideVisibleTitle = false,
}: Props) {
  const hasControls = Boolean(actions) || showBack;
  return (
    <header
      className={cn(
        "fx-rise mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        hideVisibleTitle && "mb-3",
        className,
      )}
    >
      {hideVisibleTitle ? (
        <>
          <h1 className="sr-only">{title}</h1>
          {breadcrumb ? <div className="sr-only">{breadcrumb}</div> : null}
        </>
      ) : (
        <div className="min-w-0 space-y-1">
          {breadcrumb ? (
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {breadcrumb}
            </div>
          ) : null}
          <h1 className="text-[clamp(1.5rem,3vw,2rem)] font-bold leading-tight tracking-tight">
            <span className="fx-text-grad">{title}</span>
          </h1>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
      )}

      {hasControls ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          {actions}
          {showBack ? (
            <Link
              href={backHref}
              className="fx-neon-outline inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-md bg-card/40 px-3 py-1.5 text-sm font-semibold text-primary transition-colors duration-200 ease-out hover:text-primary sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {backLabel}
            </Link>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}

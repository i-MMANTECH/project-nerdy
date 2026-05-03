"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type ServerAction = (formData: FormData) => void | Promise<void>;

const PANEL_W = 288;
const GAP = 10;
const VIEW_M = 10;

type Props = {
  action: ServerAction;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Horizontal alignment of the panel relative to the trigger. */
  align?: "left" | "right";
  className?: string;
  /** Confirm button tone (e.g. primary for “Activate”, destructive for deletes). */
  confirmVariant?: ButtonProps["variant"];
  /** Notified when the confirm panel opens or closes (e.g. close a parent ⋮ menu on open). */
  onPanelOpenChange?: (open: boolean) => void;
  /** When true, the panel starts open (e.g. form rendered outside a menu after picking “Delete”). */
  defaultOpen?: boolean;
  /** Use this element’s screen rect for panel placement instead of the trigger wrapper. */
  positionSourceRef?: RefObject<HTMLElement | null>;
  /** Optional visual style variant for the confirm panel. */
  panelStyle?: "default" | "smooth";
  children: React.ReactNode;
  trigger: (onOpen: () => void) => React.ReactNode;
};

/**
 * Confirm destructive / sensitive server actions without `window.confirm`.
 * Panel is portaled above the trigger with a light backdrop (Escape / outside click cancel).
 */
export function InlineConfirmAction({
  action,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  align = "right",
  className,
  confirmVariant = "destructive",
  onPanelOpenChange,
  defaultOpen = false,
  positionSourceRef,
  panelStyle = "default",
  children,
  trigger,
}: Props) {
  const formId = useId().replace(/:/g, "");
  const formRef = useRef<HTMLFormElement>(null);
  const submitHelperRef = useRef<HTMLButtonElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const onPanelOpenChangeRef = useRef(onPanelOpenChange);
  onPanelOpenChangeRef.current = onPanelOpenChange;
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(!!defaultOpen);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  const openPanel = useCallback(() => {
    setOpen(true);
    onPanelOpenChangeRef.current?.(true);
  }, []);
  const closePanel = useCallback(() => {
    setOpen(false);
    onPanelOpenChangeRef.current?.(false);
  }, []);

  useEffect(() => setMounted(true), []);

  const reposition = useCallback(() => {
    const el = positionSourceRef?.current ?? anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left =
      align === "right"
        ? Math.min(Math.max(VIEW_M, r.right - PANEL_W), window.innerWidth - PANEL_W - VIEW_M)
        : Math.min(Math.max(VIEW_M, r.left), window.innerWidth - PANEL_W - VIEW_M);
    setPos({ left, top: r.top - GAP });
  }, [align, positionSourceRef]);

  useLayoutEffect(() => {
    if (!open || !mounted) return;
    reposition();
    const id = requestAnimationFrame(() => reposition());
    return () => cancelAnimationFrame(id);
  }, [open, mounted, reposition]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, reposition, closePanel]);

  const overlay =
    mounted && open
      ? createPortal(
          <>
            <div
              className="fixed inset-0 z-[380] bg-black/45 sm:bg-black/35"
              aria-hidden
              onClick={() => closePanel()}
            />
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={`${formId}-title`}
              className={cn(
                "fixed z-[390] w-[min(300px,calc(100vw-20px))] rounded-xl p-4",
                panelStyle === "smooth"
                  ? "border border-border/60 bg-card/95 shadow-2xl ring-1 ring-black/[0.06] backdrop-blur-sm dark:ring-white/[0.08]"
                  : "border border-border bg-card shadow-xl ring-1 ring-black/5 dark:ring-white/10",
              )}
              style={{
                left: pos.left,
                top: pos.top,
                transform: "translateY(-100%)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <p id={`${formId}-title`} className={cn("text-sm font-semibold text-foreground", panelStyle === "smooth" ? "tracking-tight" : "")}>
                {title}
              </p>
              <p className={cn("mt-1.5 text-xs leading-relaxed text-muted-foreground", panelStyle === "smooth" ? "text-[12px]" : "")}>{description}</p>
              <div className={cn("mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", panelStyle === "smooth" ? "border-t border-border/50 pt-3" : "")}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(panelStyle === "smooth" ? "border-border/60 bg-background/60 hover:bg-muted/50" : "")}
                  onClick={() => closePanel()}
                >
                  {cancelLabel}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={confirmVariant}
                  className={cn(panelStyle === "smooth" ? "shadow-sm transition-all duration-200 hover:translate-y-[-1px]" : "")}
                  onClick={() => {
                    /**
                     * Confirm UI is portaled under `document.body`, so a `type="submit"` + `form=""` button can fail
                     * to run the Next.js server action reliably. Submit via the in-DOM `<form>` instead.
                     */
                    const form = formRef.current;
                    const sub = submitHelperRef.current;
                    if (form) {
                      // Primary path: submit the real in-DOM form directly.
                      form.requestSubmit();
                    } else if (sub) {
                      // Fallback when form ref is temporarily unavailable.
                      sub.click();
                    }
                    // Keep panel mounted; page refresh/redirect or error toast will drive next state.
                  }}
                >
                  {confirmLabel}
                </Button>
              </div>
            </div>
          </>,
          document.body,
        )
      : null;

  const anchorFullWidth = (className ?? "").includes("w-full");

  return (
    <>
      <div className={cn("inline-block", className)}>
        <form ref={formRef} id={formId} action={action}>
          {children}
          {/* In-form submitter so `requestSubmit(submitter)` matches a real user click for Next.js server actions. */}
          <button
            ref={submitHelperRef}
            type="submit"
            tabIndex={-1}
            aria-hidden
            className="pointer-events-none absolute h-px w-px overflow-hidden border-0 p-0 opacity-0"
          />
          <div ref={anchorRef} className={cn(anchorFullWidth ? "block w-full" : "inline-block")}>
            {trigger(openPanel)}
          </div>
        </form>
      </div>
      {overlay}
    </>
  );
}

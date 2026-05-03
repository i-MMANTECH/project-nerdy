"use client";

import { useEffect } from "react";
import { ArrowUpRight, MessageSquareText, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  title: string;
  description: string;
  recipients: string[];
  message: string;
  maxLength?: number;
  pending?: boolean;
  submitLabel?: string;
  onMessageChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function AdminSendMessageModal({
  open,
  title,
  description,
  recipients,
  message,
  maxLength = 1000,
  pending = false,
  submitLabel = "Send Messages",
  onMessageChange,
  onClose,
  onSubmit,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 backdrop-blur-[2px] sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-[min(96vw,1200px)] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/95 text-left shadow-md ring-1 ring-black/[0.06] dark:bg-[hsl(222_47%_8%/0.92)] dark:ring-white/[0.08]">
        <div className="flex items-start justify-between gap-2 border-b border-border/60 bg-muted/5 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="inline-flex items-center gap-1.5 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              <MessageSquareText className="h-5 w-5 text-primary sm:h-6 sm:w-6" aria-hidden />
              {title}
            </h2>
            <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 bg-background/60 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            aria-label="Close send message modal"
            title="Close"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="thin-scrollbar max-h-[calc(88dvh-5.5rem)] space-y-3 overflow-y-auto p-4 sm:p-5">
          <div className="space-y-1.5">
            <div className="flex w-full items-center justify-start gap-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Users className="h-4 w-4" aria-hidden />
              <span>Recipients ({recipients.length})</span>
            </div>
            <div className="thin-scrollbar h-9 overflow-x-auto overflow-y-hidden whitespace-nowrap rounded-lg border border-border/80 bg-muted/20 px-2.5 py-1.5 text-left text-sm text-muted-foreground">
              {recipients.join(", ")}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="admin-send-message-body" className="block w-full text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Message *
            </label>
            <textarea
              id="admin-send-message-body"
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
              maxLength={maxLength}
              rows={5}
              className="flex min-h-[140px] w-full min-w-0 rounded-lg border border-border/80 bg-muted/20 px-2.5 py-2 text-sm text-foreground outline-none transition-[color,box-shadow,border-color] duration-200 ease-out placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground focus-visible:border-cyan-500/50 focus-visible:ring-[3px] focus-visible:ring-cyan-500/25"
              placeholder="Enter your message content"
            />
            <p className="w-full text-left text-[11px] tabular-nums text-muted-foreground">{message.length}/{maxLength} characters</p>
          </div>

          <div className="flex justify-end border-t border-border/60 pt-3">
            <Button
              type="button"
              variant="ctaLink"
              size="inline"
              className="gap-1 text-sm"
              onClick={onSubmit}
              disabled={pending || !message.trim() || recipients.length === 0}
            >
              {pending ? (
                "Sending..."
              ) : (
                submitLabel
              )}
              {!pending ? <ArrowUpRight className="h-4 w-4" aria-hidden /> : null}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { ArrowUpRight, Banknote, MessageSquare, Sparkles, Ticket, UserPlus, UsersRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type QuickAction = {
  href: string;
  label: string;
  hint: string;
  icon: typeof UserPlus;
  tone: "cyan" | "violet" | "magenta" | "amber" | "emerald";
};

const ACTIONS: QuickAction[] = [
  { href: "/admin/users/new", label: "New user", hint: "Add a subscriber and bind a device.", icon: UserPlus, tone: "cyan" },
  { href: "/admin/dealers/new", label: "New dealer", hint: "Onboard a dealer under a reseller.", icon: UsersRound, tone: "violet" },
  { href: "/admin/transactions", label: "Grant credits", hint: "Credit / debit ledger and bonuses.", icon: Banknote, tone: "emerald" },
  { href: "/admin/message", label: "Send message", hint: "Broadcast to active devices.", icon: MessageSquare, tone: "magenta" },
  { href: "/admin/tickets", label: "Open tickets", hint: "Triage support queue.", icon: Ticket, tone: "amber" },
];

const TONE: Record<QuickAction["tone"], string> = {
  cyan: "text-cyan-300 ring-cyan-400/25 group-hover:ring-cyan-300/55 group-hover:bg-cyan-400/[0.08]",
  violet: "text-violet-300 ring-violet-400/25 group-hover:ring-violet-300/55 group-hover:bg-violet-400/[0.08]",
  magenta: "text-pink-300 ring-pink-400/25 group-hover:ring-pink-300/55 group-hover:bg-pink-400/[0.08]",
  amber: "text-amber-300 ring-amber-400/25 group-hover:ring-amber-300/55 group-hover:bg-amber-400/[0.08]",
  emerald: "text-emerald-300 ring-emerald-400/25 group-hover:ring-emerald-300/55 group-hover:bg-emerald-400/[0.08]",
};

export function QuickActionsLauncher() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="fx-shine group inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card/80 px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm transition-all duration-200 hover:border-primary/55 hover:shadow-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary transition-transform duration-200 group-hover:rotate-12" aria-hidden />
          Quick actions
          <kbd className="ml-1 hidden rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline">
            ⌘K
          </kbd>
        </button>
      </DialogTrigger>

      <DialogContent size="lg" className="fx-content-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            <span>Quick actions</span>
          </DialogTitle>
          <DialogDescription>Jump to common admin tasks without losing your dashboard.</DialogDescription>
        </DialogHeader>

        <div className="fx-rise-stagger grid gap-2 p-4 sm:grid-cols-2">
          {ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.href}
                href={a.href}
                className="group flex items-start gap-3 rounded-lg border border-border/60 bg-muted/[0.18] px-3.5 py-3 transition-all duration-200 hover:border-primary/40 hover:bg-muted/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45"
              >
                <span
                  className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md ring-1 transition-all duration-200 ${TONE[a.tone]}`}
                  aria-hidden
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    {a.label}
                    <ArrowUpRight
                      className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
                      aria-hidden
                    />
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{a.hint}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

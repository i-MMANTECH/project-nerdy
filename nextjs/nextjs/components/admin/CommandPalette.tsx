"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { m } from "framer-motion";
import {
  ArrowRight,
  Banknote,
  ChevronRight,
  CircleDollarSign,
  Cpu,
  FileBarChart2,
  Gauge,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Search,
  Settings as SettingsIcon,
  Ticket,
  UserPlus,
  Users,
  UsersRound,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/cn";

type Cmd = {
  id: string;
  label: string;
  hint?: string;
  group: "Navigate" | "Create" | "Account";
  icon: typeof Users;
  href: string;
  /** Extra keywords to make fuzzy search find this even with synonyms. */
  keywords?: string;
};

/* eslint-disable react-hooks/refs */
const NAV: Cmd[] = [
  { id: "nav-dash", group: "Navigate", label: "Dashboard", hint: "Mission control overview", icon: LayoutDashboard, href: "/admin/dashboard", keywords: "home overview kpis" },
  { id: "nav-users", group: "Navigate", label: "Users", hint: "All subscribers", icon: Users, href: "/admin/users", keywords: "subscribers accounts" },
  { id: "nav-managers", group: "Navigate", label: "Managers", hint: "Staff hierarchy", icon: UsersRound, href: "/admin/managers" },
  { id: "nav-resellers", group: "Navigate", label: "Resellers", hint: "Reseller network", icon: UsersRound, href: "/admin/resellers" },
  { id: "nav-dealers", group: "Navigate", label: "Dealers", hint: "Dealer accounts", icon: UsersRound, href: "/admin/dealers" },
  { id: "nav-tx", group: "Navigate", label: "Transactions", hint: "Credit ledger", icon: Banknote, href: "/admin/transactions", keywords: "credits payments" },
  { id: "nav-deductions", group: "Navigate", label: "Credit deductions", hint: "Monthly deduction rules", icon: CircleDollarSign, href: "/admin/deductions" },
  { id: "nav-bonus", group: "Navigate", label: "Bonus rules", hint: "Promotional credits", icon: CircleDollarSign, href: "/admin/bonus-rules", keywords: "promo bonus" },
  { id: "nav-msg", group: "Navigate", label: "Messages", hint: "Broadcast to devices", icon: MessageSquare, href: "/admin/message" },
  { id: "nav-tickets", group: "Navigate", label: "Tickets", hint: "Support queue", icon: Ticket, href: "/admin/tickets" },
  { id: "nav-reports", group: "Navigate", label: "Reports", hint: "Analytics & exports", icon: FileBarChart2, href: "/admin/reports", keywords: "analytics export csv" },
  { id: "nav-settings", group: "Navigate", label: "Settings", hint: "Configuration", icon: SettingsIcon, href: "/admin/settings" },
  { id: "nav-stb", group: "Navigate", label: "STB monitor", hint: "Devices online", icon: Cpu, href: "/admin/users?status=activity" },
  { id: "nav-perf", group: "Navigate", label: "Performance", hint: "System health", icon: Gauge, href: "/admin/reports" },
];

const CREATE: Cmd[] = [
  { id: "new-user", group: "Create", label: "New user", hint: "Add a subscriber", icon: UserPlus, href: "/admin/users/new" },
  { id: "new-dealer", group: "Create", label: "New dealer", hint: "Onboard a dealer", icon: UsersRound, href: "/admin/dealers/new" },
  { id: "new-reseller", group: "Create", label: "New reseller", hint: "Add a reseller account", icon: UsersRound, href: "/admin/resellers/new" },
  { id: "new-manager", group: "Create", label: "New manager", hint: "Add staff", icon: UsersRound, href: "/admin/managers/new" },
];

const ACCOUNT: Cmd[] = [
  { id: "acc-profile", group: "Account", label: "My profile", hint: "Account settings", icon: SettingsIcon, href: "/admin/profile" },
  { id: "acc-logout", group: "Account", label: "Sign out", hint: "End this session", icon: LogOut, href: "/logout" },
];

const ALL_COMMANDS: Cmd[] = [...NAV, ...CREATE, ...ACCOUNT];

/** Tiny fuzzy: match if every char of `query` appears in `text` in order. */
function fuzzy(query: string, text: string): boolean {
  if (!query) return true;
  let qi = 0;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (q[qi] === t[ti]) qi++;
  }
  return qi === q.length;
}

function score(query: string, cmd: Cmd): number {
  const haystack = `${cmd.label} ${cmd.hint ?? ""} ${cmd.keywords ?? ""}`.toLowerCase();
  const q = query.toLowerCase();
  if (!q) return 0;
  if (cmd.label.toLowerCase().startsWith(q)) return 1000 - cmd.label.length;
  if (cmd.label.toLowerCase().includes(q)) return 500;
  if (haystack.includes(q)) return 100;
  return fuzzy(q, haystack) ? 10 : -1;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // Global hotkey: ⌘K / Ctrl+K opens; Esc closes (Radix handles Esc).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      // Defer focus so Radix has mounted the input.
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  const results = useMemo(() => {
    if (!query.trim()) {
      return { Navigate: NAV.slice(0, 8), Create: CREATE, Account: ACCOUNT } as Record<Cmd["group"], Cmd[]>;
    }
    const ranked = ALL_COMMANDS
      .map((c) => ({ c, s: score(query, c) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.c);
    const grouped: Record<Cmd["group"], Cmd[]> = { Navigate: [], Create: [], Account: [] };
    for (const c of ranked) grouped[c.group].push(c);
    return grouped;
  }, [query]);

  const flat = useMemo(() => [...results.Navigate, ...results.Create, ...results.Account], [results]);

  function run(cmd: Cmd) {
    setOpen(false);
    router.push(cmd.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = flat[active];
      if (cmd) run(cmd);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        size="lg"
        className="fx-content-in fx-ring-grad p-0 sm:max-w-2xl"
        hideClose
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <div className="flex items-center gap-3 border-b border-border/50 bg-card/50 px-4 py-3" onKeyDown={onKeyDown}>
          <Search className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder="Jump anywhere — type a page, a person, an action..."
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
            ESC
          </kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2" onKeyDown={onKeyDown}>
          {flat.length === 0 ? (
            <p className="px-3 py-12 text-center text-sm text-muted-foreground">
              No matches. Try fewer letters or a synonym.
            </p>
          ) : (
            (Object.keys(results) as Cmd["group"][]).map((group) => {
              const groupItems = results[group];
              if (groupItems.length === 0) return null;
              return (
                <div key={group} className="mb-2">
                  <p className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    {group}
                  </p>
                  <ul className="space-y-0.5">
                    {groupItems.map((cmd) => {
                      const idx = flat.indexOf(cmd);
                      const isActive = idx === active;
                      const Icon = cmd.icon;
                      return (
                        <li key={cmd.id}>
                          <m.button
                            type="button"
                            onClick={() => run(cmd)}
                            onMouseEnter={() => setActive(idx)}
                            whileHover={{ x: 2 }}
                            transition={{ duration: 0.12 }}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors",
                              isActive
                                ? "bg-primary/[0.12] text-foreground ring-1 ring-primary/30"
                                : "text-foreground hover:bg-muted/30",
                            )}
                          >
                            <span
                              className={cn(
                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1",
                                isActive
                                  ? "bg-primary/15 text-primary ring-primary/30"
                                  : "bg-card/40 text-muted-foreground ring-border/40",
                              )}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{cmd.label}</span>
                              {cmd.hint ? (
                                <span className="block truncate text-[11px] text-muted-foreground">{cmd.hint}</span>
                              ) : null}
                            </span>
                            {isActive ? (
                              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
                            )}
                          </m.button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border/50 bg-card/40 px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono">↑↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono">↵</kbd> open
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono">⌘ K</kbd> toggle
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

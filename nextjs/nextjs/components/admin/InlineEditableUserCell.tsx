"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";

type EditableField = "user" | "password" | "mac" | "status";

function toCanonicalMac(raw: string): string | null {
  const hexOnly = raw.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  if (hexOnly.length !== 12) return null;
  const parts = hexOnly.match(/.{1,2}/g);
  if (!parts || parts.length !== 6) return null;
  return parts.join(":");
}

function formatMacWhileTyping(raw: string): string {
  const hex = raw.toUpperCase().replace(/[^0-9A-F]/g, "").slice(0, 12);
  const groups = hex.match(/.{1,2}/g);
  return groups ? groups.join(":") : "";
}

function macCursorPosition(raw: string, cursor: number): number {
  const before = raw.slice(0, cursor).replace(/[^0-9A-Fa-f]/g, "").slice(0, 12);
  return formatMacWhileTyping(before).length;
}

export function InlineEditableUserCell({
  account,
  field,
  value,
  expired = false,
  className,
}: {
  account: string;
  field: EditableField;
  value: string;
  expired?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmValue, setConfirmValue] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const statusEditorRef = useRef<HTMLDivElement | null>(null);

  const statusLabel = value === "1" ? "Inactive" : "Active";
  const visibleText = useMemo(() => {
    if (field === "password") return value ? (showPassword ? value : "••••••••") : "—";
    if (field === "status") return statusLabel;
    return value || "—";
  }, [field, value, showPassword, statusLabel]);

  async function save(nextValueRaw?: string) {
    const nextValue = (nextValueRaw ?? draft).trim();
    const finalValue = field === "mac" ? toCanonicalMac(nextValue) ?? "" : nextValue;
    setFieldError(null);
    if (field !== "status" && nextValue === value) {
      setEditing(false);
      setConfirmOpen(false);
      return;
    }
    if (field !== "status" && !finalValue) {
      if (field === "mac") {
        setFieldError("Invalid MAC format. Use AA:BB:CC:DD:EE:FF.");
        setConfirmOpen(false);
        setEditing(true);
        return;
      }
      setEditing(false);
      setConfirmOpen(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/users-inline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account,
          field,
          value: field === "status" ? nextValueRaw ?? draft : finalValue,
        }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        if (payload?.error === "invalid_mac") {
          setFieldError("Invalid MAC format. Use AA:BB:CC:DD:EE:FF.");
          setConfirmOpen(false);
          setEditing(true);
          return;
        }
        if (payload?.error === "duplicate_mac") {
          setFieldError("This MAC already exists. MAC must be unique.");
          setConfirmOpen(false);
          setEditing(true);
          return;
        }
        toast.error("Failed to update value.");
        return;
      }
      if (field === "user" || field === "mac") {
        toast.success(`${field === "user" ? "User" : "MAC"} updated successfully.`);
      }
      setEditing(false);
      setConfirmOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to update value.");
    } finally {
      setSaving(false);
    }
  }

  function openConfirm(nextValueRaw?: string) {
    const next = String(nextValueRaw ?? draft).trim();
    const prepared = field === "mac" ? toCanonicalMac(next) ?? "" : next;
    setFieldError(null);
    if (field === "status" && expired && value === "1" && prepared === "0") {
      toast.warning("Cannot activate expired user. Renew this account first.");
      return;
    }
    if (field !== "status" && !prepared) {
      if (field === "mac") {
        setFieldError("Invalid MAC format. Use AA:BB:CC:DD:EE:FF.");
      }
      return;
    }
    if (field !== "status" && prepared === value) {
      setEditing(false);
      return;
    }
    if (field === "status" && next === value) {
      setEditing(false);
      return;
    }
    setConfirmValue(prepared);
    setConfirmOpen(true);
  }

  useEffect(() => {
    if (!(editing && field === "status")) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (statusEditorRef.current?.contains(target)) return;
      if (confirmOpen) return;
      setDraft(value || "0");
      setEditing(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [editing, field, confirmOpen, value]);

  const confirmModal = confirmOpen ? (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          void save(confirmValue);
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setConfirmOpen(false);
        }
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-border/70 bg-card/95 p-5 shadow-2xl ring-1 ring-black/5 dark:ring-white/10">
        <h3 className="text-base font-semibold tracking-tight text-foreground">Confirm update</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Save changes for <span className="font-medium text-foreground">{account}</span>?
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => setConfirmOpen(false)}
            className="inline-flex h-9 items-center rounded-md border border-border/70 bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save(confirmValue)}
            autoFocus
            className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  if (!editing) {
    if (field === "password") {
      return (
        <>
          <div className={cn("inline-flex items-center gap-1.5", className)}>
            <button
              type="button"
              onDoubleClick={() => setEditing(true)}
              className="inline-flex min-h-8 items-center rounded-md border border-border/50 bg-background/35 px-2 py-1 font-mono text-sm text-muted-foreground hover:bg-muted/25"
              title="Double click to edit"
            >
              {visibleText}
            </button>
            {value ? (
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
              </button>
            ) : null}
          </div>
          {confirmModal}
        </>
      );
    }
    if (field === "status") {
      return (
        <>
          <button
            type="button"
            onDoubleClick={() => {
              setDraft(value || "0");
              setEditing(true);
            }}
            className={cn(
              "inline-flex min-h-6 items-center rounded-full border border-border/50 bg-background/35 px-2 py-0 text-[10px] font-semibold ring-1 hover:bg-muted/25",
              value === "1" ? "bg-rose-500/15 text-rose-300 ring-rose-500/30" : "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
              className,
            )}
            title="Double click to edit"
          >
            {statusLabel}
          </button>
          {confirmModal}
        </>
      );
    }
    return (
      <>
        <button
          type="button"
          onDoubleClick={() => setEditing(true)}
          className={cn(
            field === "user" || field === "mac"
              ? "inline-flex items-center bg-transparent p-0 text-left text-sm"
              : "inline-flex min-h-8 items-center rounded-md border border-border/50 bg-background/35 px-2 py-1 text-left text-sm hover:bg-muted/25 hover:underline",
            className,
          )}
          title="Double click to edit"
        >
          {visibleText}
        </button>
        {confirmModal}
      </>
    );
  }

  if (field === "status") {
    return (
      <>
        <div
          ref={statusEditorRef}
          role="group"
          tabIndex={0}
          onBlur={(e) => {
            if (confirmOpen) return;
            if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
            setDraft(value);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              openConfirm();
            }
            if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
          className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-background p-1"
        >
          <button
            type="button"
            disabled={saving}
            onClick={() => setDraft("0")}
            onDoubleClick={() => {
              setDraft("0");
              openConfirm("0");
            }}
            className={cn(
              "h-7 rounded px-2 text-xs font-semibold transition-colors",
              draft === "0" ? "bg-emerald-500/20 text-emerald-300" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
            )}
          >
            Active
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => setDraft("1")}
            onDoubleClick={() => {
              setDraft("1");
              openConfirm("1");
            }}
            className={cn(
              "h-7 rounded px-2 text-xs font-semibold transition-colors",
              draft === "1" ? "bg-rose-500/20 text-rose-300" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
            )}
          >
            Inactive
          </button>
        </div>
        {confirmModal}
      </>
    );
  }

  return (
    <>
      <div className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/35 p-1">
        <input
          type={field === "password" && !showPassword ? "password" : "text"}
          value={draft}
          disabled={saving}
          onInput={(e) => {
            if (field !== "mac") return;
            const el = e.currentTarget;
            const raw = el.value;
            const cursor = el.selectionStart ?? raw.length;
            const formatted = formatMacWhileTyping(raw);
            if (formatted !== raw) {
              const nextCursor = macCursorPosition(raw, cursor);
              el.value = formatted;
              el.setSelectionRange(nextCursor, nextCursor);
            }
            setDraft(formatted);
            setFieldError(null);
          }}
          onChange={(e) => {
            if (field === "mac") {
              setDraft(formatMacWhileTyping(e.target.value));
              setFieldError(null);
              return;
            }
            setDraft(e.target.value);
          }}
          onBlur={() => {
            if (confirmOpen) return;
            setDraft(value);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              openConfirm();
            }
            if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
          className={cn(
            "h-8 min-w-[7rem] rounded-md border border-border/70 bg-background px-2 text-sm",
            field === "password" || field === "mac" ? "font-mono" : "",
          )}
          inputMode={field === "mac" ? "text" : undefined}
          autoCapitalize={field === "mac" ? "characters" : undefined}
          autoComplete={field === "mac" ? "off" : undefined}
          spellCheck={field === "mac" ? false : undefined}
          maxLength={field === "mac" ? 17 : undefined}
          placeholder={field === "mac" ? "AA:AA:AA:AA:AA:AA" : undefined}
          title={field === "mac" ? "Format: AA:BB:CC:DD:EE:FF" : undefined}
          autoFocus
        />
        {field === "password" ? (
          <button
            type="button"
            disabled={saving}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowPassword((prev) => !prev)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={showPassword ? "Hide password" : "Show password"}
            title={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
        ) : null}
      </div>
      {field === "mac" && fieldError ? <p className="mt-1 text-xs text-destructive">{fieldError}</p> : null}
      {confirmModal}
    </>
  );
}

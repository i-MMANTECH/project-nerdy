"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";

type StaffType = "MANAGER" | "RESELLER" | "DEALER";
type EditableField = "name" | "password" | "status";

export function InlineEditableStaffCell({
  rowType,
  username,
  field,
  value,
  className,
}: {
  rowType: StaffType;
  username: string;
  field: EditableField;
  value: string;
  className?: string;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmValue, setConfirmValue] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const nextStatusLabel = confirmValue === "A" ? "Active" : "Inactive";
  const currentStatusLabel = value === "A" ? "Active" : "Inactive";
  const confirmButtonClassName =
    confirmValue === "A"
      ? "bg-emerald-600 text-white hover:bg-emerald-500"
      : "bg-rose-600 text-white hover:bg-rose-500";

  useEffect(() => {
    if (!editing || field !== "status" || confirmOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (root.contains(target)) return;
      setDraft(value);
      setEditing(false);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [editing, field, confirmOpen, value]);

  const statusLabel = value === "A" ? "Active" : "Inactive";
  const visibleText = useMemo(() => {
    if (field === "password") return value ? (showPassword ? value : "••••••••") : "—";
    if (field === "status") return statusLabel;
    return value || "—";
  }, [field, value, statusLabel, showPassword]);

  async function save(nextValueRaw?: string) {
    const nextValue = (nextValueRaw ?? draft).trim();
    if (!nextValue) return;
    if (nextValue === value) {
      setEditing(false);
      setConfirmOpen(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/staff-inline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rowType,
          username,
          field,
          value: nextValue,
        }),
      });
      if (!res.ok) {
        alert("Failed to update value.");
        return;
      }
      setEditing(false);
      setConfirmOpen(false);
      router.refresh();
    } catch {
      alert("Failed to update value.");
    } finally {
      setSaving(false);
    }
  }

  function openConfirm() {
    const nextValue = draft.trim();
    if (!nextValue) return;
    if (nextValue === value) {
      setEditing(false);
      return;
    }
    setConfirmValue(nextValue);
    setConfirmOpen(true);
  }

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
        <h3 className="text-base font-semibold tracking-tight text-foreground">Confirm status change</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Update <span className="font-medium text-foreground">{username}</span> from{" "}
          <span className="font-medium text-foreground">{currentStatusLabel}</span> to{" "}
          <span className="font-medium text-foreground">{nextStatusLabel}</span>?
        </p>
        <div className="mt-4 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          This change will be saved immediately.
        </div>
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
            className={cn(
              "inline-flex h-9 items-center rounded-md px-3 text-sm font-semibold shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              confirmButtonClassName,
            )}
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
          <div
            className={cn(
              "inline-flex min-h-8 items-center gap-2 rounded-md border border-border/50 bg-background/35 px-2 py-1",
              className,
            )}
          >
            <button
              type="button"
              onDoubleClick={() => setEditing(true)}
              className="text-left text-sm"
              title="Double click to edit"
            >
              {visibleText}
            </button>
            {value ? (
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
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
            onDoubleClick={() => setEditing(true)}
            className={cn(
              "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1",
              value === "A" ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30" : "bg-rose-500/15 text-rose-300 ring-rose-500/30",
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
            "inline p-0 text-left text-sm text-foreground no-underline hover:text-primary",
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
      <div ref={rootRef} className="inline-flex">
        <div
          role="group"
          tabIndex={0}
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
            onClick={() => setDraft("A")}
            onDoubleClick={() => {
              setDraft("A");
              setConfirmValue("A");
              setConfirmOpen(true);
            }}
            className={cn(
              "h-7 rounded px-2 text-xs font-semibold transition-colors",
              draft === "A" ? "bg-emerald-500/20 text-emerald-300" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
            )}
          >
            Active
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => setDraft("S")}
            onDoubleClick={() => {
              setDraft("S");
              setConfirmValue("S");
              setConfirmOpen(true);
            }}
            className={cn(
              "h-7 rounded px-2 text-xs font-semibold transition-colors",
              draft === "S" ? "bg-rose-500/20 text-rose-300" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
            )}
          >
            Inactive
          </button>
        </div>
        {confirmModal}
      </div>
    );
  }

  return (
    <>
      <div className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/35 p-1">
        <input
          type={field === "password" && !showPassword ? "password" : "text"}
          value={draft}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
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
            "h-8 w-full min-w-[7rem] rounded-md border border-border/70 bg-background px-2 text-sm",
            field === "password" ? "font-mono" : "",
          )}
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
      {confirmModal}
    </>
  );
}

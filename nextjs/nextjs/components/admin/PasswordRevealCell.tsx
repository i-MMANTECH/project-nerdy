"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";

type PasswordRevealCellProps = {
  password: string;
  className?: string;
};

export function PasswordRevealCell({ password, className }: PasswordRevealCellProps) {
  const [visible, setVisible] = useState(false);
  const masked = useMemo(() => "•".repeat(Math.max(8, password.length)), [password.length]);

  return (
    <span className={cn("inline-flex items-center gap-2 font-mono", className)}>
      <span className={visible ? "text-foreground" : "text-foreground/90"}>{visible ? password : masked}</span>
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
      </button>
    </span>
  );
}

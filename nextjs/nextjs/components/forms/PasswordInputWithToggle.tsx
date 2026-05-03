"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

type PasswordInputWithToggleProps = {
  id: string;
  name: string;
  defaultValue?: string;
  autoComplete?: string;
  required?: boolean;
  className?: string;
};

export function PasswordInputWithToggle({
  id,
  name,
  defaultValue,
  autoComplete = "new-password",
  required,
  className,
}: PasswordInputWithToggleProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        className={cn("pr-10", className)}
        required={required}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
}

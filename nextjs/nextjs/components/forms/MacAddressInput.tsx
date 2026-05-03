"use client";

import * as React from "react";

function formatMacAddress(raw: string): string {
  const hex = raw.toUpperCase().replace(/[^0-9A-F]/g, "").slice(0, 12);
  const groups = hex.match(/.{1,2}/g);
  return groups ? groups.join(":") : "";
}

function formattedCursor(raw: string, cursor: number): number {
  const before = raw.slice(0, cursor).replace(/[^0-9A-Fa-f]/g, "").slice(0, 12);
  return formatMacAddress(before).length;
}

const MAC_RE = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;

function isCompleteMac(formatted: string): boolean {
  return MAC_RE.test(formatted);
}

export type MacAddressInputProps = React.ComponentProps<"input">;

/** Auto-formats MAC input to `AA:BB:CC:DD:EE:FF` while typing. */
export function MacAddressInput({ onInput, onBlur, ...props }: MacAddressInputProps) {
  const inputHandler = onInput as ((event: React.FormEvent<HTMLInputElement>) => void) | undefined;
  const hintId = React.useId();
  const [touched, setTouched] = React.useState(false);
  const [current, setCurrent] = React.useState(() =>
    formatMacAddress(String(props.defaultValue ?? props.value ?? "")),
  );

  React.useEffect(() => {
    if (props.value == null) return;
    setCurrent(formatMacAddress(String(props.value)));
  }, [props.value]);

  const showIncomplete = touched && current.length > 0 && !isCompleteMac(current);
  const helperText =
    current.length === 0 || showIncomplete
      ? showIncomplete
        ? "Incomplete MAC address. Expected AA:BB:CC:DD:EE:FF."
        : "Format: AA:BB:CC:DD:EE:FF"
      : null;

  const handleInput = React.useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      const el = e.currentTarget;
      const raw = el.value;
      const cursor = el.selectionStart ?? raw.length;
      const formatted = formatMacAddress(raw);
      if (formatted !== raw) {
        const nextCursor = formattedCursor(raw, cursor);
        el.value = formatted;
        el.setSelectionRange(nextCursor, nextCursor);
      }
      setCurrent(formatted);
      inputHandler?.(e);
    },
    [inputHandler],
  );

  const handleBlur = React.useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const formatted = formatMacAddress(e.currentTarget.value);
      e.currentTarget.value = formatted;
      setTouched(true);
      setCurrent(formatted);
      onBlur?.(e);
    },
    [onBlur],
  );

  return (
    <div className="space-y-1">
      <input
        {...props}
        type="text"
        inputMode="text"
        autoCapitalize="characters"
        autoComplete={props.autoComplete ?? "off"}
        spellCheck={props.spellCheck ?? false}
        maxLength={17}
        pattern={props.pattern ?? "([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}"}
        title={props.title ?? "Format: AA:BB:CC:DD:EE:FF"}
        aria-invalid={showIncomplete || props["aria-invalid"] ? true : undefined}
        aria-describedby={helperText ? hintId : props["aria-describedby"]}
        onInput={handleInput}
        onBlur={handleBlur}
      />
      {helperText ? (
        <p id={hintId} className={showIncomplete ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

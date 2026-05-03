"use client";

import * as React from "react";
import {
  SelectRoot,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/cn";

const EMPTY = "__form_select_empty__";

function toRadixValue(formValue: string) {
  return formValue === "" ? EMPTY : formValue;
}

function fromRadixValue(radixValue: string) {
  return radixValue === EMPTY ? "" : radixValue;
}

export type FormSelectOption = { value: string; label: string; disabled?: boolean };

export type FormSelectProps = {
  name: string;
  id?: string;
  options: FormSelectOption[];
  /** Uncontrolled initial form value (submitted string). */
  defaultValue?: string;
  /** Controlled form value. */
  value?: string;
  onValueChange?: (formValue: string) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  contentClassName?: string;
  /**
   * When there is no `value: ""` option, start with no Radix selection so the placeholder shows
   * until the user picks (hidden field stays empty until then; `required` blocks submit).
   */
  initialUnset?: boolean;
};

/**
 * Radix dropdown + hidden input for server actions and GET forms.
 * Empty string option values are supported (encoded internally for Radix).
 */
export function FormSelect({
  name,
  id,
  options,
  defaultValue,
  value: controlledValue,
  onValueChange,
  disabled,
  required,
  placeholder = "Select…",
  className,
  contentClassName,
  initialUnset,
}: FormSelectProps) {
  const isControlled = controlledValue !== undefined;
  const hasEmptyOption = options.some((o) => o.value === "");

  const [internal, setInternal] = React.useState<string | undefined>(() => {
    if (isControlled) return undefined;
    if (initialUnset) return undefined;
    if (defaultValue !== undefined) return defaultValue;
    return "";
  });

  const formValueStr = isControlled ? (controlledValue ?? "") : (internal ?? "");

  /** Radix: `value=""` shows placeholder when no item uses `""` (SelectItem forbids empty string). */
  const radixValue: string =
    formValueStr === "" && hasEmptyOption ? toRadixValue("") : formValueStr === "" ? "" : formValueStr;

  function commit(nextForm: string) {
    if (!isControlled) setInternal(nextForm);
    onValueChange?.(nextForm);
  }

  return (
    <>
      <input type="hidden" name={name} value={formValueStr} required={required} />
      <SelectRoot value={radixValue} onValueChange={(r) => commit(fromRadixValue(r))} disabled={disabled}>
        <SelectTrigger id={id} className={cn(className)} aria-required={required}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent position="popper" className={cn(contentClassName)}>
          {options.map((o) => (
            <SelectItem key={o.value === "" ? EMPTY : o.value} value={toRadixValue(o.value)} disabled={o.disabled}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </SelectRoot>
    </>
  );
}

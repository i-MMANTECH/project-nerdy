"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { FormSelect, type FormSelectOption } from "@/components/forms/form-select";

type Props = {
  pageSize: string;
  options: FormSelectOption[];
  hrefByValue: Record<string, string>;
};

export function AdminUsersPerPageControl({ pageSize, options, hrefByValue }: Props) {
  const router = useRouter();
  const showOptions = useMemo(
    () =>
      options.map((opt) => ({
        ...opt,
        label: opt.label.startsWith("Show:") ? opt.label : `Show: ${opt.label}`,
      })),
    [options],
  );
  const validValues = useMemo(() => new Set(showOptions.map((opt) => opt.value)), [showOptions]);
  const safePageSize = validValues.has(pageSize) ? pageSize : (showOptions[0]?.value ?? pageSize);

  return (
    <FormSelect
      id="admin-users-page-size"
      name="pageSize"
      value={safePageSize}
      options={showOptions}
      className="h-10 w-[9.25rem] shrink-0 rounded-xl border-border/70 bg-background px-3.5 font-semibold text-foreground transition-colors hover:border-border hover:bg-muted/20 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/20"
      contentClassName="w-[9.25rem] min-w-[9.25rem]"
      onValueChange={(next) => {
        const href = hrefByValue[next];
        if (href) router.push(href);
      }}
    />
  );
}

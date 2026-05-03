"use client";

import { useRouter } from "next/navigation";
import { FormSelect, type FormSelectOption } from "@/components/forms/form-select";

type Props = {
  value: string;
  options: FormSelectOption[];
  hrefByValue: Record<string, string>;
};

export function AdminUsersAutoRenewControl({ value, options, hrefByValue }: Props) {
  const router = useRouter();

  return (
    <FormSelect
      name="autoRenew"
      defaultValue={value}
      options={options}
      placeholder="All renew"
      className="h-10 w-[11rem] border-border/70 bg-background px-3 font-medium text-foreground transition-colors hover:border-border hover:bg-muted/20 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/20"
      contentClassName="min-w-[12rem] [&_[role=option]]:whitespace-nowrap"
      onValueChange={(next) => {
        const href = hrefByValue[next];
        if (href) router.push(href);
      }}
    />
  );
}

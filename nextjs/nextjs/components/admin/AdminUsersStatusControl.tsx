"use client";

import { useRouter } from "next/navigation";
import { FormSelect, type FormSelectOption } from "@/components/forms/form-select";

type Props = {
  value: string;
  options: FormSelectOption[];
  hrefByValue: Record<string, string>;
};

export function AdminUsersStatusControl({ value, options, hrefByValue }: Props) {
  const router = useRouter();

  return (
    <FormSelect
      name="status"
      defaultValue={value}
      options={options}
      placeholder="All status"
      className="h-10 w-[12rem] border-border/70 bg-background px-3 font-medium text-foreground transition-colors hover:border-border hover:bg-muted/20 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/20"
      contentClassName="min-w-[16rem] [&_[role=option]]:whitespace-nowrap"
      onValueChange={(next) => {
        const href = hrefByValue[next];
        if (href) router.push(href);
      }}
    />
  );
}

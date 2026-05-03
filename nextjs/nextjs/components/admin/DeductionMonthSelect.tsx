"use client";

import { FormSelect } from "@/components/forms/form-select";

const monthOptions = Array.from({ length: 24 }, (_, i) => {
  const m = i + 1;
  return { value: String(m), label: `${m} ${m === 1 ? "month" : "months"}` };
});

export function DeductionMonthSelect({
  id,
  name,
  defaultMonth,
  className,
}: {
  id: string;
  name: string;
  defaultMonth: number;
  className?: string;
}) {
  return (
    <FormSelect
      id={id}
      name={name}
      options={monthOptions}
      defaultValue={String(defaultMonth)}
      className={className}
    />
  );
}

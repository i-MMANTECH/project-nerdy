"use client";

import { FormSelect } from "@/components/forms/form-select";

export function UserStatusFormSelect({
  id,
  name,
  defaultValue,
  className,
}: {
  id?: string;
  name: string;
  defaultValue: string;
  className?: string;
}) {
  return (
    <FormSelect
      id={id}
      name={name}
      defaultValue={defaultValue}
      options={[
        { value: "0", label: "ACTIVE" },
        { value: "1", label: "INACTIVE" },
      ]}
      className={className}
    />
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { renewUserAction } from "@/actions/forms";
import { FormField } from "@/components/forms/form-field";
import { FormStack } from "@/components/forms/form-stack";
import { FormActions } from "@/components/forms/form-actions";
import { Button, buttonOutlineLinkClassName } from "@/components/ui/button";
import { FormSelect } from "@/components/forms/form-select";
import { NativeSelect } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
type Props = {
  account: string;
  action?: typeof renewUserAction;
  cancelHref?: string;
  /** Subscribers list URL (with optional query) — server uses it to revalidate nested `/dealers/.../users` caches. */
  listRevalidatePath?: string;
};

export function RenewRecoverCreditsForm({ account, action = renewUserAction, cancelHref, listRevalidatePath }: Props) {
  const [type, setType] = useState<"RENEW" | "RCDT">("RENEW");

  const validityOptions = useMemo(() => {
    const o: { value: string; label: string }[] = [{ value: "FREE_TRIAL", label: "2 Days Trial" }];
    for (let i = 1; i <= 24; i += 1) {
      o.push({ value: String(i), label: i === 1 ? "1 Month" : `${i} Months` });
    }
    return o;
  }, []);

  return (
    <form action={action}>
      <FormStack>
        <input type="hidden" name="account" value={account} />
        {listRevalidatePath ? <input type="hidden" name="redirect" value={listRevalidatePath} /> : null}
        {type === "RENEW" ? (
          <FormField id={`rr-validity-${account}`} label="Validity">
            <FormSelect
              id={`rr-validity-${account}`}
              name="validity"
              defaultValue="1"
              options={validityOptions}
              className="max-w-md"
            />
          </FormField>
        ) : (
          <FormField id={`rr-credits-${account}`} label="Select credits">
            <NativeSelect id={`rr-credits-${account}`} name="credits" defaultValue="1" className="max-w-md">
              {Array.from({ length: 2000 }, (_, i) => (
                <option key={i + 1} value={String(i + 1)}>
                  {i + 1}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        )}
        <fieldset className="grid gap-2 rounded-lg border border-border bg-muted/30 p-3">
          <legend className="px-1 text-sm font-semibold text-foreground">Type</legend>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <Checkbox type="radio" name="type" value="RENEW" checked={type === "RENEW"} onChange={() => setType("RENEW")} />
            RENEWAL TO ADD
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <Checkbox type="radio" name="type" value="RCDT" checked={type === "RCDT"} onChange={() => setType("RCDT")} />
            RECOVER
          </label>
        </fieldset>
        <FormActions>
          <Button type="submit" className="w-full sm:w-auto">
            Submit
          </Button>
          {cancelHref ? (
            <Link href={cancelHref} className={buttonOutlineLinkClassName("w-full justify-center sm:w-auto")}>
              Cancel
            </Link>
          ) : null}
        </FormActions>
      </FormStack>
    </form>
  );
}

import type { ReactNode } from "react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Panel } from "@/components/admin/Panel";
import { MacAddressInput } from "@/components/forms/MacAddressInput";
import { Button } from "@/components/ui/button";

type Search = { out?: string; expired?: string; e?: string };

function decodeExp(raw: string | undefined) {
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function CheckMacView({
  breadcrumb,
  action,
  searchParams,
}: {
  breadcrumb: string;
  action: (formData: FormData) => void | Promise<void>;
  searchParams: Search;
}) {
  const { out, expired, e } = searchParams;
  const expStr = decodeExp(e);

  let result: ReactNode = null;
  if (out === "missing") {
    result = <p className="text-sm text-destructive">Enter a MAC address.</p>;
  } else if (out === "invalid") {
    result = <p className="text-sm text-destructive">MAC format is invalid (use six hex pairs, e.g. AA:BB:CC:DD:EE:FF).</p>;
  } else if (out === "available") {
    result = <p className="text-sm text-accent-foreground">MAC address is available.</p>;
  } else if (out === "ambiguous") {
    result = <p className="text-sm font-medium text-muted-foreground">Multiple billing accounts match this MAC; check data manually.</p>;
  } else if (out === "exists") {
    const isExpired = expired === "1";
    result = (
      <div className="space-y-2 text-sm">
        <p className="text-destructive">MAC address already exists on an account.</p>
        {isExpired ? (
          <p className="text-foreground">
            Subscription is <span className="font-semibold">expired</span>
            {expStr ? (
              <>
                {" "}
                (expires: <span className="font-mono">{expStr}</span>)
              </>
            ) : null}
            .
          </p>
        ) : (
          <p className="text-accent-foreground">MAC address is active (not expired).</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Check MAC address" breadcrumb={breadcrumb} showBack={false} />
      <Panel title="Lookup">
        <p className="mb-4 text-sm text-muted-foreground">
          Enter a MAC address to see whether it is already used on an account and whether that account&apos;s subscription has expired (same as PHP).
        </p>
        <form action={action} className="max-w-md space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-foreground">MAC address</label>
            <MacAddressInput
              name="mac"
              required
              placeholder="AA:BB:CC:DD:EE:FF"
              className="w-full rounded border border-input bg-muted/50 px-3 py-2 font-mono text-sm uppercase"
            />
          </div>
          <Button type="submit">Check</Button>
        </form>
        {result ? <div className="mt-6 rounded border border-border bg-muted/50 p-4">{result}</div> : null}
      </Panel>
    </div>
  );
}


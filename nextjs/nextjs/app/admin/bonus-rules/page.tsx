import Link from "next/link";
import { ArrowLeft, Gift } from "lucide-react";
import type { FlashToastItem } from "@/components/FlashToasts";
import { FlashToastsBoundary } from "@/components/FlashToasts";
import { BonusRulesForm } from "@/components/admin/BonusRulesForm";
import { PageHeader } from "@/components/admin/PageHeader";
import { getPromoBonusRules } from "@/lib/data";

type Props = { searchParams?: Promise<{ ok?: string; error?: string }> };

export default async function BonusRulesPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const rules = await getPromoBonusRules();

  const flashes: FlashToastItem[] = [];
  if (sp.ok) {
    flashes.push({
      type: "success",
      message: "Bonus rules saved",
      description: "Promo tiers are stored in billing configs and apply on the next add-credit action.",
    });
  }
  if (sp.error) {
    flashes.push({
      type: "error",
      message: "Could not save",
      description: decodeURIComponent(sp.error),
    });
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[min(100%,1920px)] flex-col gap-3 overflow-hidden">
      {flashes.length ? <FlashToastsBoundary items={flashes} stripParams={["ok", "error"]} /> : null}
      <PageHeader title="Bonus rules" breadcrumb="Home › Settings › Bonus rules" />
      <div>
        <Link
          href="/admin/settings?tab=billing"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to settings
        </Link>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/60 bg-card/95 p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10">
            <Gift className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <h2 className="text-base font-semibold text-foreground">Promo 1 + Promo 2</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              When an admin adds credits to a manager, reseller, or dealer, the system adds <span className="font-medium text-foreground">Promo 1</span> bonus
              (tier by <span className="font-medium text-foreground">requested amount</span>) plus <span className="font-medium text-foreground">Promo 2</span> bonus
              (tier by <span className="font-medium text-foreground">active client count</span>). Each part is rounded up; both apply to the same requested credit
              base. On <span className="font-medium text-foreground">recover</span>, enter the <span className="font-medium text-foreground">principal</span> you
              want to reverse; if a matching grant with <span className="font-medium text-foreground">(base …)</span> exists in the ledger, the full grant total
              (including promo) is taken back in FIFO order.
            </p>
          </div>
        </div>
        <div className="min-h-0 h-full overflow-hidden">
          <BonusRulesForm initialP1={rules.p1} initialP2={rules.p2} />
        </div>
      </div>
    </div>
  );
}

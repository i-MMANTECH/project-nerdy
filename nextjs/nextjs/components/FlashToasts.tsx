"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

export type FlashToastItem = {
  type: "success" | "error" | "info" | "warning";
  message: string;
  description?: string;
};

function FlashToastsInner({
  items,
  stripParams = ["ok", "error"],
}: {
  items: FlashToastItem[];
  stripParams?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const handledSig = useRef<string | null>(null);

  useEffect(() => {
    if (!items.length) return;
    const sig = JSON.stringify(items);
    if (handledSig.current === sig) return;
    handledSig.current = sig;

    for (const it of items) {
      const opts = it.description ? { description: it.description } : undefined;
      if (it.type === "success") toast.success(it.message, opts);
      else if (it.type === "error") toast.error(it.message, opts);
      else if (it.type === "warning") toast.warning(it.message, opts);
      else toast.message(it.message, opts);
    }

    const p = new URLSearchParams(searchParams?.toString() ?? "");
    let changed = false;
    for (const k of stripParams) {
      if (p.has(k)) {
        p.delete(k);
        changed = true;
      }
    }
    if (changed) {
      const q = p.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    }
  }, [items, pathname, router, searchParams, stripParams]);

  return null;
}

/** Renders nothing; fires Sonner toasts once from server-serialized flash items and strips listed query keys. */
export function FlashToastsBoundary(props: { items: FlashToastItem[]; stripParams?: string[] }) {
  return (
    <Suspense fallback={null}>
      <FlashToastsInner {...props} />
    </Suspense>
  );
}

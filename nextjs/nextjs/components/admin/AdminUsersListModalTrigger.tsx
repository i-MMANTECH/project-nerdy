"use client";

import type { ReactNode, Ref } from "react";
import { useMemo, useState } from "react";
import { AdminSubscribersFetchModal } from "@/components/admin/AdminSubscribersFetchModal";
import { cn } from "@/lib/cn";

type RowType = "MANAGER" | "RESELLER" | "DEALER";
type StatusFilter = "active" | "expired" | "";

export function AdminUsersListModalTrigger({
  rowType,
  username,
  displayName,
  status,
  label,
  className,
  triggerRef,
}: {
  rowType: RowType;
  username: string;
  displayName?: string;
  status: StatusFilter;
  label: ReactNode;
  className?: string;
  triggerRef?: Ref<HTMLButtonElement>;
}) {
  const [open, setOpen] = useState(false);

  const apiBaseUrl = useMemo(() => {
    const u = encodeURIComponent(username);
    if (rowType === "MANAGER") return `/api/admin/managers/${u}/subscribers`;
    if (rowType === "RESELLER") return `/api/admin/resellers/${u}/subscribers`;
    return `/api/admin/dealers/${u}/subscribers`;
  }, [rowType, username]);

  const scopeDescription = status === "active" ? "Showing active users in this scope." : status === "expired" ? "Showing expired users in this scope." : "Showing all users in this scope.";

  return (
    <>
      <button type="button" ref={triggerRef} onClick={() => setOpen(true)} className={cn("inline cursor-pointer bg-transparent p-0", className)}>
        {label}
      </button>
      <AdminSubscribersFetchModal
        open={open}
        onOpenChange={setOpen}
        apiBaseUrl={apiBaseUrl}
        fixedQuery={status ? { status } : undefined}
        entityDisplayName={displayName || username}
        entityLogin={username}
        scopeDescription={scopeDescription}
      />
    </>
  );
}

"use client";

import { AdminSubscribersFetchModal } from "@/components/admin/AdminSubscribersFetchModal";

export function AdminManagerSubscribersModal({
  open,
  onOpenChange,
  managerLogin,
  managerDisplayName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  managerLogin: string;
  managerDisplayName: string;
}) {
  return (
    <AdminSubscribersFetchModal
      open={open}
      onOpenChange={onOpenChange}
      apiBaseUrl={`/api/admin/managers/${encodeURIComponent(managerLogin)}/subscribers`}
      entityDisplayName={managerDisplayName}
      entityLogin={managerLogin}
      scopeDescription="Only accounts under this manager’s hierarchy."
    />
  );
}

import type { FlashToastItem } from "@/components/FlashToasts";
import {
  portalUsersDeleteListErrorMessage,
  portalUsersRenewListErrorMessage,
  portalUsersResetListErrorMessage,
  portalUsersStatusQuickErrorMessage,
} from "@/lib/portalUsersRenewListMessages";

type FlashSp = {
  ok?: string;
  error?: string;
  bal?: string;
  req?: string;
  renew_acc?: string;
};

/** URL flash → Sonner items for manager/reseller/dealer subscriber list pages. */
export function portalSubscriberListFlashItems(sp: FlashSp): FlashToastItem[] {
  const renewErrMsg = portalUsersRenewListErrorMessage(sp);
  const resetErrMsg = portalUsersResetListErrorMessage(sp.error);
  const deleteErrMsg = portalUsersDeleteListErrorMessage(sp.error);
  const statusErrMsg = portalUsersStatusQuickErrorMessage(sp.error);

  return [
    ...(sp.ok === "created" ? [{ type: "success" as const, message: "User account was created successfully." }] : []),
    ...(sp.ok === "renew"
      ? [{ type: "success" as const, message: "One month added (PHP renewOneMonth / grid +1)." }]
      : []),
    ...(sp.ok === "renew_trial"
      ? [{ type: "success" as const, message: "Free trial applied from quick +1 where configured." }]
      : []),
    ...(sp.ok === "renew_recover"
      ? [{ type: "success" as const, message: "RCDT-style recover completed from quick renew path." }]
      : []),
    ...(sp.ok === "reset"
      ? [
          {
            type: "success" as const,
            message: "Stalker device bindings cleared (device_id, access_token) — same as PHP Reset.",
          },
        ]
      : []),
    ...(sp.ok === "deleted_user"
      ? [{ type: "success" as const, message: "User account was deleted successfully." }]
      : []),
    ...(sp.ok === "activated" ? [{ type: "success" as const, message: "STB box was activated successfully." }] : []),
    ...(sp.ok === "blocked" ? [{ type: "success" as const, message: "STB box was blocked successfully." }] : []),
    ...(renewErrMsg ? [{ type: "error" as const, message: renewErrMsg }] : []),
    ...(resetErrMsg ? [{ type: "error" as const, message: resetErrMsg }] : []),
    ...(deleteErrMsg ? [{ type: "error" as const, message: deleteErrMsg }] : []),
    ...(statusErrMsg ? [{ type: "error" as const, message: statusErrMsg }] : []),
  ];
}

export const PORTAL_SUBSCRIBER_LIST_FLASH_KEYS = ["ok", "error", "bal", "req", "renew_acc"] as const;

import type { FlashToastItem } from "@/components/FlashToasts";
import {
  portalUsersDeleteListErrorMessage,
  portalUsersRenewListErrorMessage,
  portalUsersResetListErrorMessage,
  portalUsersStatusQuickErrorMessage,
} from "@/lib/portalUsersRenewListMessages";

export type AdminHierarchyNewKind = "manager" | "admin_dealer" | "admin_reseller";

export function adminHierarchyNewMissingFlashItems(sp: { error?: string }, kind: AdminHierarchyNewKind): FlashToastItem[] {
  if (sp.error !== "missing") return [];
  const message =
    kind === "manager"
      ? "Name, username, and password are required."
      : kind === "admin_dealer"
        ? "Name, username, password, and parent reseller are required."
        : "Name, username, password, and manager are required.";
  return [{ type: "error", message }];
}

export function managerResellerNewFlashItems(sp: { error?: string }, creditBalanceLabel: string): FlashToastItem[] {
  const e = sp.error;
  if (!e) return [];
  const msg =
    e === "missing"
      ? "Name, username, and password are required."
      : e === "username"
        ? "Username is invalid. Use letters, numbers, and underscores only (billing rules)."
        : e === "password"
          ? "Password must be between 3 and 50 characters."
          : e === "credits"
            ? `You need at least 1 credit on your manager account to create a reseller (current balance: ${creditBalanceLabel}).`
            : e === "taken"
              ? "That username is already taken."
              : e === "db"
                ? "Could not create the account. Try again or check server logs."
                : null;
  return msg ? [{ type: "error", message: msg }] : [];
}

export function managerDealerNewFlashItems(sp: { error?: string }): FlashToastItem[] {
  const e = sp.error;
  if (!e) return [];
  const msg =
    e === "missing"
      ? "Name, username, password, and parent reseller are required."
      : e === "username"
        ? "Username is invalid. Use 3–50 letters or numbers only."
        : e === "password"
          ? "Password must be between 3 and 50 characters."
          : e === "reseller"
            ? "Choose a reseller that belongs to your manager account."
            : e === "taken"
              ? "That username is already taken."
              : e === "db"
                ? "Could not create the account. Try again or check server logs."
                : null;
  return msg ? [{ type: "error", message: msg }] : [];
}

export function resellerDealerNewFlashItems(sp: { error?: string }): FlashToastItem[] {
  const e = sp.error;
  if (!e) return [];
  const msg =
    e === "missing"
      ? "Name, username, and password are required."
      : e === "username"
        ? "Username is invalid. Use 3–50 letters or numbers only."
        : e === "password"
          ? "Password must be between 3 and 50 characters."
          : e === "taken"
            ? "That username is already taken."
            : e === "db"
              ? "Could not create the account. Try again or check server logs."
              : null;
  return msg ? [{ type: "error", message: msg }] : [];
}

export function portalTicketCreateFlashItems(sp: { error?: string }): FlashToastItem[] {
  if (sp.error === "validation") {
    return [{ type: "error", message: "Please fill priority, category, channel, channel number, and subject." }];
  }
  if (sp.error === "db") {
    return [
      {
        type: "error",
        message: "Could not save the ticket. Check the billing MySQL tickets table matches the legacy schema.",
      },
    ];
  }
  return [];
}

export function ticketDetailFlashItems(sp: { ok?: string; error?: string }): FlashToastItem[] {
  const items: FlashToastItem[] = [];
  if (sp.ok === "comment") items.push({ type: "success", message: "Comment added." });
  if (sp.error === "comment") items.push({ type: "error", message: "Comment is required." });
  if (sp.error === "validation") items.push({ type: "error", message: "Invalid priority or status." });
  if (sp.error === "db") {
    items.push({
      type: "error",
      message: "Could not complete that action (check tickets / tickets_comments tables).",
    });
  }
  return items;
}

export function portalTicketListFlashItems(sp: { ok?: string; error?: string }): FlashToastItem[] {
  const items: FlashToastItem[] = [];
  if (sp.ok === "created") items.push({ type: "success", message: "Ticket was created." });
  if (sp.ok === "complete") items.push({ type: "success", message: "Ticket marked completed." });
  if (sp.ok === "reopened") items.push({ type: "success", message: "Ticket was reopened." });
  if (sp.ok === "updated") items.push({ type: "success", message: "Ticket was updated." });
  if (sp.ok === "deleted") items.push({ type: "success", message: "Ticket was deleted." });
  if (sp.error === "ticket") items.push({ type: "error", message: "Invalid ticket." });
  return items;
}

export function adminProfilePasswordFlashItems(sp: { error?: string }): FlashToastItem[] {
  const e = sp.error;
  if (!e) return [];
  const message =
    e === "match"
      ? "New passwords do not match."
      : e === "old"
        ? "Current password is incorrect."
        : e === "old_len"
          ? "Current password must be between 3 and 100 characters."
          : e === "new_len"
            ? "New password must be between 4 and 12 characters (PHP portal rules)."
            : null;
  return message ? [{ type: "error", message }] : [];
}

export type NewEndUserFlashVariant =
  | "admin"
  | "manager"
  | "dealer"
  | "reseller"
  | "manager_dealer_nested"
  | "reseller_dealer_nested";

const NEW_USER_ERRORS: Record<NewEndUserFlashVariant, Record<string, string>> = {
  admin: {
    stalker_required: "Stalker database is not configured (set STALKER_DATABASE_NAME and related env vars).",
    invalid: "Check login (lowercase alphanumeric), password (4–100 chars), and MAC format (AA:BB:CC:DD:EE:FF).",
    duplicate_login: "That login is already used (billing or Stalker).",
    duplicate_mac: "That MAC is already registered.",
    bad_owner: "Reseller or dealer selection is invalid.",
    bad_package: "Choose a valid package (tariff plan).",
    bad_validity: "That validity option is not allowed.",
    db: "Database error while creating the user. Stalker row was rolled back if billing failed.",
  },
  manager: {
    stalker_required: "Stalker database is not configured (set STALKER_DATABASE_NAME and related env vars).",
    invalid: "Check login (lowercase alphanumeric), password (4–100 chars), and MAC format (AA:BB:CC:DD:EE:FF).",
    duplicate_login: "That login is already used (billing or Stalker).",
    duplicate_mac: "That MAC is already registered.",
    bad_owner: "Reseller or dealer selection failed validation.",
    bad_package: "Choose a valid package (tariff plan).",
    bad_validity: "That validity option is not allowed.",
    db: "Database error while creating the user. Stalker row was rolled back if billing failed.",
    missing_hierarchy: "Select a reseller owned by your manager account.",
    forbidden: "That reseller or dealer is not in your hierarchy.",
    forbidden_dealer: "The dealer does not belong to the selected reseller.",
  },
  dealer: {
    stalker_required: "Stalker database is not configured (set STALKER_DATABASE_NAME and related env vars).",
    invalid: "Check login (lowercase alphanumeric), password (4–100 chars), and MAC format (AA:BB:CC:DD:EE:FF).",
    duplicate_login: "That login is already used (billing or Stalker).",
    duplicate_mac: "That MAC is already registered.",
    bad_owner: "Your dealer account is not linked to a reseller (missing username_owner).",
    bad_package: "Choose a valid package (tariff plan).",
    bad_validity: "That validity option is not allowed.",
    db: "Database error while creating the user. Stalker row was rolled back if billing failed.",
  },
  reseller: {
    stalker_required: "Stalker database is not configured (set STALKER_DATABASE_NAME and related env vars).",
    invalid: "Check login (lowercase alphanumeric), password (4–100 chars), and MAC format (AA:BB:CC:DD:EE:FF).",
    duplicate_login: "That login is already used (billing or Stalker).",
    duplicate_mac: "That MAC is already registered.",
    bad_owner: "Reseller account is not valid for billing.",
    bad_package: "Choose a valid package (tariff plan).",
    bad_validity: "That validity option is not allowed.",
    db: "Database error while creating the user. Stalker row was rolled back if billing failed.",
  },
  manager_dealer_nested: {
    missing_dealer: "Dealer context was missing. Use Add user from that dealer’s list.",
    missing_hierarchy: "Hierarchy was incomplete.",
    forbidden: "You do not have access to create users for this dealer.",
    forbidden_dealer: "That dealer is not under the expected reseller in your tree.",
    stalker_required: "Stalker database is not configured (set STALKER_DATABASE_NAME and related env vars).",
    invalid: "Check login (lowercase alphanumeric), password (4–100 chars), and MAC format (AA:BB:CC:DD:EE:FF).",
    duplicate_login: "That login is already used (billing or Stalker).",
    duplicate_mac: "That MAC is already registered.",
    bad_owner: "Owner accounts are not valid for billing.",
    bad_package: "Choose a valid package (tariff plan).",
    bad_validity: "That validity option is not allowed.",
    db: "Database error while creating the user. Stalker row was rolled back if billing failed.",
  },
  reseller_dealer_nested: {
    missing_dealer: "Dealer context was missing. Use the Add user link from the dealer’s user list.",
    stalker_required: "Stalker database is not configured (set STALKER_DATABASE_NAME and related env vars).",
    invalid: "Check login (lowercase alphanumeric), password (4–100 chars), and MAC format (AA:BB:CC:DD:EE:FF).",
    duplicate_login: "That login is already used (billing or Stalker).",
    duplicate_mac: "That MAC is already registered.",
    bad_owner: "Reseller account is not valid for billing.",
    bad_package: "Choose a valid package (tariff plan).",
    bad_validity: "That validity option is not allowed.",
    db: "Database error while creating the user. Stalker row was rolled back if billing failed.",
  },
};

function insufficientCreditsMessage(
  variant: NewEndUserFlashVariant,
  bal: string | undefined,
  req: string | undefined,
): string {
  const b = bal ?? "0";
  const r = req ?? "?";
  switch (variant) {
    case "admin":
      return `The selected reseller/dealer does not have enough credits (remaining ${b}, need ${r} months). Same rule as PHP check_validity_credits.`;
    case "manager":
      return `Not enough credits on the debited account (remaining ${b}, need ${r} months). Credits are taken from the dealer if selected, otherwise the reseller.`;
    case "dealer":
      return `Not enough credits on your dealer balance (remaining ${b}, need ${r} months).`;
    case "reseller":
      return `Not enough credits on your reseller balance (remaining ${b}, need ${r} months).`;
    case "manager_dealer_nested":
    case "reseller_dealer_nested":
      return `Not enough credits (remaining ${b}, need ${r} months).`;
    default:
      return `Not enough credits (remaining ${b}, need ${r} months).`;
  }
}

export function newEndUserCreationFlashItems(
  sp: { error?: string; bal?: string; req?: string },
  variant: NewEndUserFlashVariant,
): FlashToastItem[] {
  const e = sp.error;
  if (!e) return [];
  if (e === "insufficient_credits") {
    return [{ type: "error", message: insufficientCreditsMessage(variant, sp.bal, sp.req) }];
  }
  const table = NEW_USER_ERRORS[variant];
  const message = table[e] ?? `Could not create user (${e}).`;
  return [{ type: "error", message }];
}

export type OperatorUserEditFlashSp = {
  ok?: string;
  error?: string;
  bal?: string;
  req?: string;
  max?: string;
  renew_acc?: string;
};

/** Manager / reseller / dealer subscriber edit page — URL flash → Sonner items. */
export function operatorUserEditFlashItems(sp: OperatorUserEditFlashSp): FlashToastItem[] {
  const items: FlashToastItem[] = [];
  const bal = sp.bal != null && sp.bal !== "" ? sp.bal : "0";
  const req = sp.req != null && sp.req !== "" ? sp.req : "?";
  const maxM = sp.max != null && sp.max !== "" ? sp.max : "0";

  if (sp.ok === "1") items.push({ type: "success", message: "Saved." });
  if (sp.ok === "msg") items.push({ type: "success", message: "Message queued." });
  if (sp.ok === "renew") {
    items.push({ type: "success", message: "Subscription extended (credits debited from your operator balance)." });
  }
  if (sp.ok === "renew_trial") items.push({ type: "success", message: "Free trial applied (no credits debited)." });
  if (sp.ok === "renew_recover") {
    items.push({ type: "success", message: "Recover applied (RCDT). Subscription expiry was reduced." });
  }
  if (sp.ok === "activated") items.push({ type: "success", message: "STB box was activated successfully." });
  if (sp.ok === "blocked") items.push({ type: "success", message: "STB box was blocked successfully." });
  if (sp.ok === "reset") items.push({ type: "success", message: "Stalker device bindings cleared." });
  if (sp.ok === "deleted_user") items.push({ type: "success", message: "User account was deleted." });

  if (sp.error === "save") items.push({ type: "error", message: "Could not save. Check database logs." });
  if (sp.error === "msg_empty") items.push({ type: "error", message: "Message is required." });
  if (sp.error === "msg_stalker") {
    items.push({ type: "error", message: "Configure Stalker DB env to send device messages." });
  }
  if (sp.error === "msg_events") {
    items.push({
      type: "error",
      message:
        "This Stalker database has no events table (device messages require it). Use a full Ministra schema or create the table.",
    });
  }
  if (sp.error === "msg_no_user") items.push({ type: "error", message: "Stalker user was not found for this account." });
  if (sp.error === "msg_db") items.push({ type: "error", message: "Message failed to send. Check database logs." });

  const statusQuickErrMsg = portalUsersStatusQuickErrorMessage(sp.error);
  if (statusQuickErrMsg) items.push({ type: "error", message: statusQuickErrMsg });

  if (sp.error === "renew_invalid") {
    items.push({
      type: "error",
      message:
        "Renew or recover request was invalid. Check validity (1–24 or free trial) or credits (1–2000).",
    });
  }
  if (sp.error === "renew_credits") {
    items.push({
      type: "error",
      message: `Not enough credits on your balance to renew (remaining: ${bal}, required: ${req}).`,
    });
  }
  if (sp.error === "renew_recover_credits") {
    items.push({
      type: "error",
      message: `Cannot recover that many credits (remaining recoverable: ${bal}, requested: ${req}).`,
    });
  }
  if (sp.error === "renew_rcdt_reseller") {
    items.push({
      type: "error",
      message: `You cannot recover ${req} credits (recover max by PHP month rule = ${maxM}).`,
    });
  }
  if (sp.error === "renew_no_summarize") {
    items.push({ type: "error", message: "Missing user_credit_summarize row for this account." });
  }
  if (sp.error === "renew_no_stalker") {
    items.push({
      type: "error",
      message: "Stalker DB is not available to this server. Set STALKER_DATABASE_NAME and restart Next.js.",
    });
  }
  if (sp.error === "renew_no_stalker_user" || sp.error === "renew_stalker") {
    const m =
      portalUsersRenewListErrorMessage({ error: sp.error, renew_acc: sp.renew_acc, bal: sp.bal, req: sp.req, max: sp.max }) ??
      "No Stalker user row for this login.";
    items.push({ type: "error", message: m });
  }
  if (sp.error === "renew_trial_used") items.push({ type: "error", message: "This MAC has already used a free trial." });
  if (sp.error === "renew_trial_limit") {
    items.push({ type: "error", message: "Free trial usage limit exceeded for this MAC." });
  }
  if (sp.error === "renew_db") items.push({ type: "error", message: "Renew or recover failed (database error)." });

  if (sp.error === "renew_quick_invalid") {
    const m = portalUsersRenewListErrorMessage(sp) ?? "Quick renew failed.";
    items.push({ type: "error", message: m });
  }

  const resetErrMsg = portalUsersResetListErrorMessage(sp.error);
  if (resetErrMsg) items.push({ type: "error", message: resetErrMsg });
  const deleteErrMsg = portalUsersDeleteListErrorMessage(sp.error);
  if (deleteErrMsg) items.push({ type: "error", message: deleteErrMsg });

  return items;
}

export const OPERATOR_USER_EDIT_FLASH_STRIP = ["ok", "error", "bal", "req", "max", "renew_acc"] as const;

/** Flash copy for user list Delete (`delete_*` query params; admin + portal lists). */
export function portalUsersDeleteListErrorMessage(error: string | undefined): string | null {
  if (!error?.startsWith("delete_")) return null;
  switch (error) {
    case "delete_invalid":
      return "Delete failed: missing account.";
    case "delete_active_portal":
      return "You can't delete an active user account (reseller / dealer).";
    case "delete_no_account":
      return "Delete failed: no billing account row.";
    case "delete_no_stalker":
      return "Configure Stalker DB env (STALKER_DATABASE_*) to delete end users.";
    case "delete_no_stalker_user":
      return "Delete failed: no Stalker users row for this login.";
    case "delete_no_account_del":
      return "Delete failed: billing account row was not removed.";
    case "delete_stalker_db":
    case "delete_billing_db":
      return "Delete failed: database error. Check server logs.";
    default:
      return "Delete failed. Try again or check logs.";
  }
}

/** Flash copy for user list Reset (`reset_*` query params). */
export function portalUsersResetListErrorMessage(error: string | undefined): string | null {
  switch (error) {
    case "reset_invalid":
      return "Reset failed: missing account.";
    case "reset_no_account":
      return "Reset failed: no billing account row.";
    case "reset_no_stalker":
      return "Configure Stalker DB env (STALKER_DATABASE_*) to reset devices.";
    case "reset_no_row":
      return "No Stalker `users` row for this login (nothing updated).";
    default:
      return null;
  }
}

/** Flash copy for portal (and admin) user list quick +1 renew query params. */
export function portalUsersRenewListErrorMessage(sp: {
  error?: string;
  bal?: string;
  req?: string;
  /** Admin detail renew RCDT redirect uses `max` (months cap), not `bal`. */
  max?: string;
  /** Set when renew failed: no Stalker row — same value as billing `accounts.account` / form `account`. */
  renew_acc?: string;
}): string | null {
  const e = sp.error ?? "";
  if (e === "renew_quick_invalid") return "Quick +1 renew failed: missing account.";
  if (!e.startsWith("renew_")) return null;
  switch (e) {
    case "renew_credits":
      return `Not enough credits to add one month (remaining: ${sp.bal ?? "0"}, required: ${sp.req ?? "?"}).`;
    case "renew_recover_credits":
      return `Recover credits check failed (remaining: ${sp.bal ?? "0"}, required: ${sp.req ?? "?"}).`;
    case "renew_no_summarize":
      return "Renew failed: missing `user_credit_summarize` row for this account.";
    case "renew_no_stalker":
      return "Renew failed: Stalker DB pool is not available. Set STALKER_DATABASE_NAME (and host/user/password), restart Next.js, and confirm the server process sees `.env.local`.";
    case "renew_no_stalker_user": {
      const id = sp.renew_acc?.trim();
      const tail =
        "Stalker must have a row in `users` where `login` equals that id (same as PHP `get_stalker_user`). Create the subscriber in Ministra, import users, or fix the billing/Stalker mismatch.";
      return id
        ? `Renew failed: no Stalker \`users\` row with login = ${JSON.stringify(id)}. ${tail}`
        : `Renew failed: no Stalker \`users\` row for this billing account (\`accounts.account\`). ${tail}`;
    }
    case "renew_stalker": {
      const idLegacy = sp.renew_acc?.trim();
      return idLegacy
        ? `Renew failed (legacy code): no Stalker \`users\` row for login = ${JSON.stringify(idLegacy)}.`
        : "Renew failed: Stalker user row missing or Stalker DB not configured.";
    }
    case "renew_trial_used":
      return "This MAC address already used a free trial.";
    case "renew_trial_limit":
      return "This account reached the configured free-trial retry limit.";
    case "renew_rcdt_reseller":
      return `RCDT / reseller month check failed (see detail page; max=${sp.max ?? sp.bal ?? "?"}, req=${sp.req ?? "?"}).`;
    case "renew_invalid":
      return "Invalid renew request.";
    case "renew_db":
      return "Renew failed (database). Check server logs.";
    default:
      return "Renew failed.";
  }
}

/** List-level activate/block (`setResellerEndUserStatusQuickAction` / manager equivalent) query `error`. */
export function portalUsersStatusQuickErrorMessage(error: string | undefined): string | null {
  switch (error) {
    case "activate_expired":
      return "You can't activate expired box.";
    case "block_expired":
      return "You can't change expired box.";
    case "activate_already":
      return "The box is already active.";
    case "block_already":
      return "The box is already blocked or expired.";
    case "status_no_account":
      return "Status update failed: no billing account row.";
    case "status_no_stalker":
      return "Configure Stalker DB env to change status.";
    case "status_no_stalker_user":
      return "Status update failed: no Stalker user row for this login.";
    case "status_invalid":
      return "Status update failed: invalid request.";
    case "status_db":
      return "Status update failed (database error).";
    default:
      return null;
  }
}

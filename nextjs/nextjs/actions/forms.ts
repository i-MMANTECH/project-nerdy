"use server";

import type { RowDataPacket } from "mysql2";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getBillingPool } from "@/lib/db/pool";
import * as repo from "@/lib/repos/billing";
import { HIERARCHY_ADD_CREDITS_MAX } from "@/lib/constants/hierarchyCredits";
import { clearStalkerUserDeviceTokensByLogin } from "@/lib/repos/stalkerDevices";
import { createEndUserAccount } from "@/lib/repos/accountCreate";
import {
  getStalkerCustomPackagePlanId,
  getStalkerUserDbIdByLogin,
  setStalkerUserPackageSubscriptions,
} from "@/lib/repos/stalkerUserPackages";
import * as ticketRepo from "@/lib/repos/tickets";
import * as managerPortal from "@/lib/repos/managerPortal";
import * as resellerPortal from "@/lib/repos/resellerPortal";
import * as checkMacRepo from "@/lib/repos/checkMac";
import { getSession, clearSession, homePathForUserType } from "@/lib/session";
import { isBillingAccountExpired } from "@/lib/billingAccountExpiry";
import { safePortalUsersRedirectPath } from "@/lib/portalUsersRedirectPath";
import type { PromoTier } from "@/lib/promoBonus";

async function requireRootSession() {
  const s = await getSession();
  if (!s) redirect("/login?error=forbidden");
  if (s.type !== "ROOT") {
    const home = homePathForUserType(s.type);
    redirect(home ?? "/login?error=forbidden");
  }
  return s;
}

async function requirePortalSession() {
  const s = await getSession();
  if (!s) redirect("/login?error=forbidden");
  return s;
}

async function requireManagerSession() {
  const s = await requirePortalSession();
  if (s.type !== "MNGR") {
    redirect(portalBasePathByType(s.type));
  }
  return s;
}

async function requireResellerSession() {
  const s = await requirePortalSession();
  if (s.type !== "SRSLR") {
    redirect(portalBasePathByType(s.type));
  }
  return s;
}

async function requireDealerSession() {
  const s = await requirePortalSession();
  if (s.type !== "RSLR") {
    redirect(portalBasePathByType(s.type));
  }
  return s;
}

function redirectAfterMacLookup(base: "/manager" | "/reseller" | "/dealer", r: checkMacRepo.CheckMacLookupResult): never {
  switch (r.kind) {
    case "invalid":
      redirect(`${base}/check-mac?out=invalid`);
    case "available":
      redirect(`${base}/check-mac?out=available`);
    case "ambiguous":
      redirect(`${base}/check-mac?out=ambiguous`);
    case "exists": {
      const expQ = r.expires ? `&e=${encodeURIComponent(r.expires)}` : "";
      redirect(`${base}/check-mac?out=exists&expired=${r.expired ? 1 : 0}${expQ}`);
    }
  }
}

/** PHP `manager|reseller|dealer/Check_mac::index` */
export async function checkMacManagerAction(formData: FormData) {
  await requireManagerSession();
  const mac = String(formData.get("mac") ?? "").trim();
  if (!mac) redirect("/manager/check-mac?out=missing");
  redirectAfterMacLookup("/manager", await checkMacRepo.lookupAccountByMac(mac));
}

export async function checkMacResellerAction(formData: FormData) {
  await requireResellerSession();
  const mac = String(formData.get("mac") ?? "").trim();
  if (!mac) redirect("/reseller/check-mac?out=missing");
  redirectAfterMacLookup("/reseller", await checkMacRepo.lookupAccountByMac(mac));
}

export async function checkMacDealerAction(formData: FormData) {
  await requireDealerSession();
  const mac = String(formData.get("mac") ?? "").trim();
  if (!mac) redirect("/dealer/check-mac?out=missing");
  redirectAfterMacLookup("/dealer", await checkMacRepo.lookupAccountByMac(mac));
}

function portalBasePathByType(type: string): "/admin" | "/manager" | "/reseller" | "/dealer" {
  if (type === "MNGR") return "/manager";
  if (type === "SRSLR") return "/reseller";
  if (type === "RSLR") return "/dealer";
  return "/admin";
}

async function assertAccountAccessOrRedirect(session: Awaited<ReturnType<typeof requirePortalSession>>, account: string) {
  const ok = await repo.canAccessAccountByRole({
    ownerType: (session.type === "MNGR" || session.type === "SRSLR" || session.type === "RSLR" ? session.type : "ROOT") as
      | "ROOT"
      | "MNGR"
      | "SRSLR"
      | "RSLR",
    ownerUsername: session.username,
    account,
  });
  if (!ok) {
    redirect(`${portalBasePathByType(session.type)}/users`);
  }
}

function normUserStatus(v: string) {
  const u = v.toUpperCase();
  if (u === "S" || u === "INACTIVE") return "S";
  return "A";
}

const SETTINGS_TABS = new Set(["general", "announcement", "billing", "notifications", "security", "appearance"]);

function settingsTabQuery(formData: FormData): string {
  const raw = String(formData.get("active_tab") ?? "general").trim().toLowerCase();
  return SETTINGS_TABS.has(raw) ? raw : "general";
}

export async function saveSettingsAction(formData: FormData) {
  await requireRootSession();
  const tabQ = settingsTabQuery(formData);
  const tabSuffix = `&tab=${encodeURIComponent(tabQ)}`;

  const row = await repo.getSettings();
  if (!row.id) redirect(`/admin/settings?error=nosettings${tabSuffix}`);

  if (tabQ === "general") {
    const title = String(formData.get("title") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const pinDefault = String(formData.get("pin_default") ?? "").trim();
    const numberRetry = Number.parseInt(String(formData.get("number_retry_trial") ?? ""), 10);
    const isRetryTrial = formData.get("is_retry_trial") === "1";

    if (title.length < 3 || title.length > 50) redirect(`/admin/settings?error=validation${tabSuffix}`);
    if (!/^\d{4}$/.test(pinDefault)) redirect(`/admin/settings?error=validation${tabSuffix}`);
    if (!Number.isFinite(numberRetry) || numberRetry < 0) redirect(`/admin/settings?error=validation${tabSuffix}`);

    await repo.updateSettingsRow(row.id, title, email, row.announcement ?? "");
    await repo.upsertConfigByKey("pin_default", pinDefault);
    await repo.upsertConfigByKey("is_retry_trial", isRetryTrial ? "1" : "0");
    await repo.upsertConfigByKey("number_retry_trial", String(numberRetry));
  } else if (tabQ === "announcement") {
    const global_msg = String(formData.get("global_msg") ?? "").trim();
    await repo.updateSettingsRow(row.id, row.title ?? "", row.adminEmail ?? "", global_msg);
  } else if (tabQ === "billing") {
    const limitReseller = Number.parseInt(String(formData.get("limit_reseller_credit") ?? ""), 10);
    const limitDealer = Number.parseInt(String(formData.get("limit_dealer_credit") ?? ""), 10);
    const limitManager = Number.parseInt(String(formData.get("limit_manager_credit") ?? ""), 10);
    const hierarchyAddMax = Number.parseInt(String(formData.get("hierarchy_add_credit_max") ?? ""), 10);
    if (!Number.isFinite(hierarchyAddMax) || hierarchyAddMax < 1 || hierarchyAddMax > HIERARCHY_ADD_CREDITS_MAX) {
      redirect(`/admin/settings?error=validation${tabSuffix}`);
    }
    if (!Number.isFinite(limitManager) || limitManager < 1 || limitManager > hierarchyAddMax) {
      redirect(`/admin/settings?error=validation${tabSuffix}`);
    }
    if (!Number.isFinite(limitReseller) || limitReseller < 1 || limitReseller > hierarchyAddMax) {
      redirect(`/admin/settings?error=validation${tabSuffix}`);
    }
    if (!Number.isFinite(limitDealer) || limitDealer < 1 || limitDealer > hierarchyAddMax) {
      redirect(`/admin/settings?error=validation${tabSuffix}`);
    }
    await repo.upsertConfigByKey("limit_manager_credit", String(limitManager));
    await repo.upsertConfigByKey("hierarchy_add_credit_max", String(hierarchyAddMax));
    await repo.upsertConfigByKey("limit_reseller_credit", String(limitReseller));
    await repo.upsertConfigByKey("limit_dealer_credit", String(limitDealer));
  } else if (tabQ === "notifications") {
    const notifyExpiringSubscriptions = formData.get("notify_expiring_subscriptions") === "1";
    const notifyLowCredit = formData.get("notify_low_credit") === "1";
    const notifyNewTickets = formData.get("notify_new_tickets") === "1";
    const notifyDeviceOffline = formData.get("notify_device_offline") === "1";
    await repo.upsertConfigByKey("notify_expiring_subscriptions", notifyExpiringSubscriptions ? "1" : "0");
    await repo.upsertConfigByKey("notify_low_credit", notifyLowCredit ? "1" : "0");
    await repo.upsertConfigByKey("notify_new_tickets", notifyNewTickets ? "1" : "0");
    await repo.upsertConfigByKey("notify_device_offline", notifyDeviceOffline ? "1" : "0");
  }

  revalidatePath("/admin/settings");
  redirect(`/admin/settings?ok=1${tabSuffix}`);
}

export async function saveDeductionsAction(formData: FormData) {
  await requireRootSession();
  const cfg = await repo.getDeductionsConfig();
  const rows = cfg.rows.map((r) => {
    const month = Number(formData.get(`month_${r.id}`));
    const month_deduction = Number(formData.get(`month_deduction_${r.id}`));
    return { id: r.id, month: Number.isFinite(month) ? month : r.month, month_deduction: Number.isFinite(month_deduction) ? month_deduction : 0 };
  });
  const monthFree = formData.get("one_month_free") === "1";
  const recoverBonus = formData.get("is_recover_bonus_credit") === "1";
  await repo.saveDeductions({ rows, monthFree, recoverBonus });
  revalidatePath("/admin/deductions");
  redirect("/admin/deductions?ok=1");
}

export async function saveBonusPromoRulesAction(formData: FormData) {
  await requireRootSession();
  const p1Parse = parsePromoTiersPayloadStrict(String(formData.get("promo_p1_json") ?? "[]"), "Promo 1");
  if (!p1Parse.ok) {
    redirect(`/admin/bonus-rules?error=${encodeURIComponent(p1Parse.error)}`);
  }
  const p2Parse = parsePromoTiersPayloadStrict(String(formData.get("promo_p2_json") ?? "[]"), "Promo 2");
  if (!p2Parse.ok) {
    redirect(`/admin/bonus-rules?error=${encodeURIComponent(p2Parse.error)}`);
  }
  const p1 = p1Parse.tiers;
  const p2 = p2Parse.tiers;
  const r = await repo.savePromoBonusRules({ p1, p2 });
  if (!r.ok) {
    redirect(`/admin/bonus-rules?error=${encodeURIComponent(r.error)}`);
  }
  revalidatePath("/admin/bonus-rules");
  redirect("/admin/bonus-rules?ok=1");
}

function parsePromoTiersPayloadStrict(
  raw: string,
  label: string,
): { ok: true; tiers: PromoTier[] } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, tiers: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    return { ok: false, error: `${label} payload is invalid JSON.` };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, error: `${label} payload must be a JSON array.` };
  }
  const tiers: PromoTier[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const row = parsed[i];
    if (row == null || typeof row !== "object") {
      return { ok: false, error: `${label} row ${i + 1} is invalid.` };
    }
    const o = row as Record<string, unknown>;
    const ge = Math.floor(Number(o.ge));
    const percentage = Number(o.percentage);
    const ltRaw = o.lt;
    const lt = ltRaw === null || ltRaw === undefined || String(ltRaw).trim() === "" ? null : Math.floor(Number(ltRaw));
    if (!Number.isFinite(ge) || ge < 0) {
      return { ok: false, error: `${label} row ${i + 1} has invalid GE.` };
    }
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      return { ok: false, error: `${label} row ${i + 1} has invalid percentage.` };
    }
    if (lt != null && (!Number.isFinite(lt) || lt <= ge)) {
      return { ok: false, error: `${label} row ${i + 1} has LT less than or equal to GE.` };
    }
    tiers.push({ ge, lt, percentage });
  }
  return { ok: true, tiers };
}

const ADMIN_MESSAGE_AUDIENCES = new Set([
  "all",
  "active",
  "expired",
  "expiring",
  "managers",
  "resellers",
  "inactive",
  "custom",
]);

export async function sendMessageAction(formData: FormData) {
  await requireRootSession();
  const message = String(formData.get("message") ?? "").trim();
  if (!message) redirect("/admin/message?error=empty");
  const rawAudience = String(formData.get("audience") ?? "").trim().toLowerCase();
  const audience = ADMIN_MESSAGE_AUDIENCES.has(rawAudience) ? rawAudience : "all";
  const pr = Number(formData.get("priority"));
  const priority = Number.isFinite(pr) && pr >= 1 && pr <= 3 ? Math.floor(pr) : 2;

  if (audience === "all") {
    const n = await repo.broadcastStalkerMessageAdminSubscribers(message, priority);
    if (n === 0) {
      const ready = await repo.stalkerEventsMessagingReady();
      if (ready === "no_events") redirect("/admin/message?error=events_table");
      redirect("/admin/message?error=no_recipients");
    }
  } else if (audience === "custom") {
    const raw = formData.getAll("users");
    const uids = [...new Set(raw.map((v) => Number.parseInt(String(v), 10)).filter((n) => Number.isFinite(n) && n > 0))];
    if (!uids.length) redirect("/admin/message?error=none_selected");
    const n = await repo.sendStalkerMessageToUserIds(uids, message, priority);
    if (n === 0) {
      const ready = await repo.stalkerEventsMessagingReady();
      if (ready === "no_events") redirect("/admin/message?error=events_table");
      redirect("/admin/message?error=stalker");
    }
  } else {
    const { uids } = await repo.resolveAdminMessageStalkerUids(audience);
    if (!uids.length) redirect("/admin/message?error=no_recipients");
    const n = await repo.sendStalkerMessageToUserIds(uids, message, priority);
    if (n === 0) {
      const ready = await repo.stalkerEventsMessagingReady();
      if (ready === "no_events") redirect("/admin/message?error=events_table");
      redirect("/admin/message?error=stalker");
    }
  }
  revalidatePath("/admin/message");
  redirect("/admin/message?ok=1");
}

/** Manager / reseller / dealer Message index: scoped “To All” or custom Stalker ids in hierarchy. */
export async function sendOperatorPortalMessageAction(formData: FormData) {
  const s = await requirePortalSession();
  if (!(s.type === "MNGR" || s.type === "SRSLR" || s.type === "RSLR")) {
    redirect("/login?error=forbidden");
  }
  const base = portalBasePathByType(s.type);
  const message = String(formData.get("message") ?? "").trim();
  if (!message) redirect(`${base}/message?error=empty`);
  const type = String(formData.get("type") ?? "All").trim();
  const owner = { ownerType: s.type as "MNGR" | "SRSLR" | "RSLR", ownerUsername: s.username };
  const pr = Number(formData.get("priority"));
  const priority = Number.isFinite(pr) && pr >= 1 && pr <= 3 ? Math.floor(pr) : 2;

  if (type === "All" || type === "") {
    const n = await repo.broadcastStalkerMessageScoped(message, owner, priority);
    if (n === 0) {
      const ready = await repo.stalkerEventsMessagingReady();
      if (ready === "no_events") redirect(`${base}/message?error=events_table`);
      redirect(`${base}/message?error=stalker`);
    }
  } else {
    const raw = formData.getAll("users");
    const accounts = [...new Set(raw.map((v) => String(v ?? "").trim().toLowerCase()).filter(Boolean))];
    if (!accounts.length) redirect(`${base}/message?error=none_selected`);
    const allowed: number[] = [];
    const seen = new Set<number>();
    for (const account of accounts) {
      const ok = await repo.canAccessAccountByRole({
        ownerType: owner.ownerType,
        ownerUsername: owner.ownerUsername,
        account,
      });
      if (!ok) continue;
      const uid = await getStalkerUserDbIdByLogin(account);
      if (uid != null && uid > 0 && !seen.has(uid)) {
        seen.add(uid);
        allowed.push(uid);
      }
    }
    if (!allowed.length) redirect(`${base}/message?error=none_selected`);
    const n = await repo.sendStalkerMessageToUserIds(allowed, message, priority);
    if (n === 0) {
      const ready = await repo.stalkerEventsMessagingReady();
      if (ready === "no_events") redirect(`${base}/message?error=events_table`);
      redirect(`${base}/message?error=stalker`);
    }
  }
  revalidatePath(`${base}/message`);
  redirect(`${base}/message?ok=1`);
}

export async function sendUserMessageAction(formData: FormData) {
  const s = await requirePortalSession();
  const base = portalBasePathByType(s.type);
  const account = String(formData.get("account") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  if (!account) redirect(`${base}/users?error=missing`);
  await assertAccountAccessOrRedirect(s, account);
  if (!message) redirect(`${base}/users/${encodeURIComponent(account)}?error=msg_empty`);
  const r = await repo.sendStalkerMessageToAccount(account, message);
  if (!r.ok) {
    const q =
      r.code === "stalker"
        ? "msg_stalker"
        : r.code === "no_user"
          ? "msg_no_user"
          : r.code === "no_events"
            ? "msg_events"
            : "msg_db";
    redirect(`${base}/users/${encodeURIComponent(account)}?error=${q}`);
  }
  revalidatePath(`${base}/users/${encodeURIComponent(account)}`);
  redirect(`${base}/users/${encodeURIComponent(account)}?ok=msg`);
}

function ticketCheckboxOn(formData: FormData, key: string) {
  return formData.get(key) != null;
}

export async function createTicketAction(formData: FormData) {
  await requireRootSession();
  const subject = String(formData.get("subject") ?? "").trim();
  const description = String(formData.get("description") ?? "");
  const priority = Number(formData.get("priority"));
  const category_id = Number(formData.get("category"));
  const channel_id = Number(formData.get("channel"));
  const channel_number = Number(String(formData.get("channel_number") ?? "").trim());
  if (!subject || !Number.isFinite(priority) || priority < 1 || priority > 3) {
    redirect("/admin/tickets/create?error=validation");
  }
  if (!Number.isFinite(category_id) || category_id <= 0 || !Number.isFinite(channel_id) || channel_id <= 0) {
    redirect("/admin/tickets/create?error=validation");
  }
  if (!Number.isFinite(channel_number) || channel_number <= 0) {
    redirect("/admin/tickets/create?error=validation");
  }
  try {
    await ticketRepo.insertTicket({
      subject,
      descriptionHtml: description,
      priority_id: priority,
      channel_number,
      category_id,
      channel_id,
      flags: {
        no_audio: ticketCheckboxOn(formData, "no_audio"),
        no_video: ticketCheckboxOn(formData, "no_video"),
        stream_error: ticketCheckboxOn(formData, "stream_error"),
        no_epg: ticketCheckboxOn(formData, "no_epg"),
        catch_up_needed: ticketCheckboxOn(formData, "catch_up_needed"),
        epg_needed: ticketCheckboxOn(formData, "epg_needed"),
        file_missing: ticketCheckboxOn(formData, "file_missing"),
        wrong_channel_name: ticketCheckboxOn(formData, "wrong_channel_name"),
      },
      user_id: 0,
    });
  } catch {
    redirect("/admin/tickets/create?error=db");
  }
  revalidatePath("/admin/tickets");
  redirect("/admin/tickets?ok=created");
}

export async function markTicketCompleteAction(formData: FormData) {
  await requireRootSession();
  const id = Number(formData.get("ticket_id"));
  if (!Number.isFinite(id) || id <= 0) redirect("/admin/tickets?error=ticket");
  await ticketRepo.markTicketCompleted(id);
  revalidatePath("/admin/tickets");
  revalidatePath(`/admin/tickets/${id}`);
  redirect("/admin/tickets?ok=complete");
}

export async function addTicketCommentAction(formData: FormData) {
  await requireRootSession();
  const ticket_id = Number(formData.get("ticket_id"));
  const comment = String(formData.get("comment") ?? "").trim();
  if (!Number.isFinite(ticket_id) || ticket_id <= 0) redirect("/admin/tickets?error=ticket");
  if (!comment) redirect(`/admin/tickets/${ticket_id}?error=comment`);
  try {
    await ticketRepo.insertTicketComment(ticket_id, comment);
  } catch {
    redirect(`/admin/tickets/${ticket_id}?error=db`);
  }
  revalidatePath(`/admin/tickets/${ticket_id}`);
  revalidatePath("/admin/tickets");
  redirect(`/admin/tickets/${ticket_id}?ok=comment`);
}

export async function reopenTicketAction(formData: FormData) {
  await requireRootSession();
  const ticket_id = Number(formData.get("ticket_id"));
  if (!Number.isFinite(ticket_id) || ticket_id <= 0) redirect("/admin/tickets?error=ticket");
  await ticketRepo.reopenTicket(ticket_id);
  revalidatePath("/admin/tickets");
  revalidatePath(`/admin/tickets/${ticket_id}`);
  redirect("/admin/tickets?ok=reopened");
}

export async function updateTicketAdminAction(formData: FormData) {
  await requireRootSession();
  const ticket_id = Number(formData.get("ticket_id"));
  const priority = Number(formData.get("priority"));
  const status = Number(formData.get("status"));
  if (!Number.isFinite(ticket_id) || ticket_id <= 0) redirect("/admin/tickets?error=ticket");
  if (!Number.isFinite(priority) || priority < 1 || priority > 3) {
    redirect(`/admin/tickets/${ticket_id}?error=validation`);
  }
  if (!Number.isFinite(status) || status < 1 || status > 3) {
    redirect(`/admin/tickets/${ticket_id}?error=validation`);
  }
  const ok = await ticketRepo.updateTicketPriorityAndStatus(ticket_id, priority, status);
  if (!ok) redirect(`/admin/tickets/${ticket_id}?error=db`);
  revalidatePath("/admin/tickets");
  revalidatePath(`/admin/tickets/${ticket_id}`);
  redirect("/admin/tickets?ok=updated");
}

export async function deleteTicketAction(formData: FormData) {
  await requireRootSession();
  const ticket_id = Number(formData.get("ticket_id"));
  if (!Number.isFinite(ticket_id) || ticket_id <= 0) redirect("/admin/tickets?error=ticket");
  const ok = await ticketRepo.deleteTicketById(ticket_id);
  if (!ok) redirect(`/admin/tickets/${ticket_id}?error=db`);
  revalidatePath("/admin/tickets");
  redirect("/admin/tickets?ok=deleted");
}

function safeAdminUsersRedirectPath(raw: string): string {
  const s = String(raw ?? "").trim();
  if (s.startsWith("//") || s.includes("..")) return "/admin/users";
  if (s === "/admin/users" || s.startsWith("/admin/users?") || s.startsWith("/admin/users/")) return s;
  return "/admin/users";
}

function addSearchParamsToPath(path: string, updates: Record<string, string>): string {
  const idx = path.indexOf("?");
  const base = idx >= 0 ? path.slice(0, idx) : path;
  const sp = new URLSearchParams(idx >= 0 ? path.slice(idx + 1) : "");
  for (const [k, v] of Object.entries(updates)) sp.set(k, v);
  const q = sp.toString();
  return q ? `${base}?${q}` : base;
}

/** Map `renewAccountByOperatorValidity` failure codes to `?error=renew_*` (after credits / recoverable branches). */
function renewFailureQueryError(code: string): string {
  switch (code) {
    case "no_summarize":
      return "renew_no_summarize";
    case "no_stalker":
      return "renew_no_stalker";
    case "no_stalker_user":
      return "renew_no_stalker_user";
    case "trial_used":
      return "renew_trial_used";
    case "trial_limit":
      return "renew_trial_limit";
    case "invalid":
      return "renew_invalid";
    default:
      return "renew_db";
  }
}

/** Allow portal `/users` list or single-account `/users/:account` (for flashes after +1 / reset). */
function safeAdminManagersRedirectPath(raw: string): string {
  const s = String(raw ?? "").trim();
  if (s.startsWith("//") || s.includes("..")) return "/admin/managers";
  if (s === "/admin/managers" || s.startsWith("/admin/managers?")) return s;
  return "/admin/managers";
}

function safeAdminResellersRedirectPath(raw: string): string {
  const s = String(raw ?? "").trim();
  if (s.startsWith("//") || s.includes("..")) return "/admin/managers";
  if (s === "/admin/managers" || s.startsWith("/admin/managers?")) return s;
  return "/admin/managers";
}

function safeAdminDealersRedirectPath(raw: string): string {
  const s = String(raw ?? "").trim();
  if (s.startsWith("//") || s.includes("..")) return "/admin/managers";
  if (s === "/admin/managers" || s.startsWith("/admin/managers?")) return s;
  return "/admin/managers";
}

function revalidatePortalUsersListCaches(base: "/manager" | "/reseller" | "/dealer", redirectPath: string) {
  revalidatePath(`${base}/users`);
  const pathOnly = (redirectPath.split(/[?#]/)[0] ?? "").trim();
  const prefix = `${base}/dealers/`;
  const suffix = "/users";
  if (pathOnly.startsWith(prefix) && pathOnly.endsWith(suffix)) {
    const mid = pathOnly.slice(prefix.length, pathOnly.length - suffix.length);
    if (mid.length > 0 && !mid.includes("/")) {
      revalidatePath(`${base}/dealers/${mid}/users`);
    }
  }
}

/** PHP `admin/Users::reset` — clear Stalker `users` device_id / device_id2 / access_token for billing account login. */
export async function resetAdminEndUserStalkerDevicesAction(formData: FormData) {
  await requireRootSession();
  const account = String(formData.get("account") ?? "").trim();
  const redirectPath = safeAdminUsersRedirectPath(String(formData.get("redirect") ?? ""));
  if (!account) redirect(addSearchParamsToPath(redirectPath, { error: "reset_invalid" }));

  const pool = getBillingPool();
  const [rows] = await pool.execute<RowDataPacket[]>("SELECT 1 FROM accounts WHERE account = :a LIMIT 1", { a: account });
  if (!rows.length) {
    redirect(addSearchParamsToPath(`/admin/users/${encodeURIComponent(account)}`, { error: "reset_no_account" }));
  }

  const r = await clearStalkerUserDeviceTokensByLogin(account);
  if (!r.ok && r.reason === "no_stalker_db") {
    redirect(addSearchParamsToPath(redirectPath, { error: "reset_no_stalker" }));
  }
  if (!r.ok) {
    redirect(addSearchParamsToPath(redirectPath, { error: "reset_no_row" }));
  }

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${encodeURIComponent(account)}`);
  redirect(addSearchParamsToPath(redirectPath, { ok: "reset" }));
}

export async function resetAccountDeviceBindingsAction(
  account: string,
): Promise<{ ok: true } | { ok: false; error: "reset_invalid" | "reset_no_account" | "reset_no_stalker" | "reset_no_row" }> {
  await requireRootSession();
  const acc = String(account ?? "").trim();
  if (!acc) return { ok: false, error: "reset_invalid" };

  const pool = getBillingPool();
  const [rows] = await pool.execute<RowDataPacket[]>("SELECT 1 FROM accounts WHERE account = :a LIMIT 1", { a: acc });
  if (!rows.length) return { ok: false, error: "reset_no_account" };

  const r = await clearStalkerUserDeviceTokensByLogin(acc);
  if (!r.ok && r.reason === "no_stalker_db") return { ok: false, error: "reset_no_stalker" };
  if (!r.ok) return { ok: false, error: "reset_no_row" };

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${encodeURIComponent(acc)}`);
  return { ok: true };
}

/** PHP `manager|reseller|dealer/Users::reset` — same Stalker clear; account must be in portal scope. */
export async function resetOperatorEndUserStalkerDevicesAction(formData: FormData) {
  const s = await requirePortalSession();
  if (!(s.type === "MNGR" || s.type === "SRSLR" || s.type === "RSLR")) {
    redirect("/login?error=forbidden");
  }
  const baseRaw = portalBasePathByType(s.type);
  if (baseRaw === "/admin") redirect("/login?error=forbidden");
  const base = baseRaw as "/manager" | "/reseller" | "/dealer";

  const account = String(formData.get("account") ?? "").trim();
  const redirectPath = safePortalUsersRedirectPath(String(formData.get("redirect") ?? ""), base);
  if (!account) redirect(addSearchParamsToPath(redirectPath, { error: "reset_invalid" }));

  await assertAccountAccessOrRedirect(s, account);
  const pool = getBillingPool();
  const [rows] = await pool.execute<RowDataPacket[]>("SELECT 1 FROM accounts WHERE account = :a LIMIT 1", { a: account });
  if (!rows.length) {
    redirect(addSearchParamsToPath(`${base}/users/${encodeURIComponent(account)}`, { error: "reset_no_account" }));
  }

  const r = await clearStalkerUserDeviceTokensByLogin(account);
  if (!r.ok && r.reason === "no_stalker_db") {
    redirect(addSearchParamsToPath(redirectPath, { error: "reset_no_stalker" }));
  }
  if (!r.ok) {
    redirect(addSearchParamsToPath(redirectPath, { error: "reset_no_row" }));
  }

  revalidatePortalUsersListCaches(base, redirectPath);
  revalidatePath(`${base}/users/${encodeURIComponent(account)}`);
  redirect(addSearchParamsToPath(redirectPath, { ok: "reset" }));
}

/** PHP `admin/Users::delete` / `Users_model::delete` — full remove (Stalker user then billing account). */
export async function deleteAdminEndUserAccountAction(formData: FormData) {
  await requireRootSession();
  const account = String(formData.get("account") ?? "").trim();
  const redirectPath = safeAdminUsersRedirectPath(String(formData.get("redirect") ?? ""));
  if (!account) redirect(addSearchParamsToPath(redirectPath, { error: "delete_invalid" }));
  const r = await repo.deleteAdminEndUserAccount(account);
  if (!r.ok) redirect(addSearchParamsToPath(redirectPath, { error: `delete_${r.code}` }));
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${encodeURIComponent(account)}`);
  redirect(addSearchParamsToPath(redirectPath, { ok: "deleted_user" }));
}

/** PHP `admin/Managers::delete` */
export async function deleteAdminManagerAction(formData: FormData) {
  await requireRootSession();
  const username = String(formData.get("username") ?? "").trim();
  const redirectPath = safeAdminManagersRedirectPath(String(formData.get("redirect") ?? ""));
  if (!username) redirect(addSearchParamsToPath(redirectPath, { error: "delete_invalid" }));
  const ok = await repo.deleteAdminManager(username);
  if (!ok) redirect(addSearchParamsToPath(redirectPath, { error: "delete_forbidden" }));
  revalidatePath("/admin/managers");
  redirect(addSearchParamsToPath(redirectPath, { ok: "deleted_manager" }));
}

/** PHP `admin/Resellers::delete` */
export async function deleteAdminResellerAction(formData: FormData) {
  await requireRootSession();
  const username = String(formData.get("username") ?? "").trim();
  const redirectPath = safeAdminResellersRedirectPath(String(formData.get("redirect") ?? ""));
  if (!username) redirect(addSearchParamsToPath(redirectPath, { error: "delete_invalid" }));
  const ok = await repo.deleteAdminReseller(username);
  if (!ok) redirect(addSearchParamsToPath(redirectPath, { error: "delete_forbidden" }));
  revalidatePath("/admin/resellers");
  revalidatePath("/admin/dealers");
  revalidatePath("/admin/managers");
  redirect(addSearchParamsToPath(redirectPath, { ok: "deleted_reseller" }));
}

/** PHP `admin/Dealers::delete` */
export async function deleteAdminDealerAction(formData: FormData) {
  await requireRootSession();
  const username = String(formData.get("username") ?? "").trim();
  const redirectPath = safeAdminDealersRedirectPath(String(formData.get("redirect") ?? ""));
  if (!username) redirect(addSearchParamsToPath(redirectPath, { error: "delete_invalid" }));
  const ok = await repo.deleteAdminDealer(username);
  if (!ok) redirect(addSearchParamsToPath(redirectPath, { error: "delete_forbidden" }));
  revalidatePath("/admin/dealers");
  revalidatePath("/admin/users");
  revalidatePath("/admin/managers");
  redirect(addSearchParamsToPath(redirectPath, { ok: "deleted_dealer" }));
}

/**
 * PHP `manager/Users::delete` (any expiry) vs `reseller|dealer/Users::delete` (expired only).
 * Same `Users_model::delete` — Stalker user then billing account; account must be in portal scope.
 */
export async function deleteOperatorEndUserAccountAction(formData: FormData) {
  const s = await requirePortalSession();
  if (!(s.type === "MNGR" || s.type === "SRSLR" || s.type === "RSLR")) {
    redirect("/login?error=forbidden");
  }
  const baseRaw = portalBasePathByType(s.type);
  if (baseRaw === "/admin") redirect("/login?error=forbidden");
  const base = baseRaw as "/manager" | "/reseller" | "/dealer";

  const account = String(formData.get("account") ?? "").trim();
  const redirectPath = safePortalUsersRedirectPath(String(formData.get("redirect") ?? ""), base);
  if (!account) redirect(addSearchParamsToPath(redirectPath, { error: "delete_invalid" }));

  await assertAccountAccessOrRedirect(s, account);

  if (s.type === "SRSLR" || s.type === "RSLR") {
    const pool = getBillingPool();
    const [accRows] = await pool.execute<RowDataPacket[]>(
      "SELECT expires FROM accounts WHERE account = :a LIMIT 1",
      { a: account },
    );
    if (!accRows.length) redirect(addSearchParamsToPath(redirectPath, { error: "delete_no_account" }));
    const exp = accRows[0].expires != null ? String(accRows[0].expires) : null;
    if (!isBillingAccountExpired(exp)) {
      redirect(addSearchParamsToPath(redirectPath, { error: "delete_active_portal" }));
    }
  }

  const r = await repo.deleteAdminEndUserAccount(account);
  if (!r.ok) redirect(addSearchParamsToPath(redirectPath, { error: `delete_${r.code}` }));
  revalidatePortalUsersListCaches(base, redirectPath);
  revalidatePath(`${base}/users/${encodeURIComponent(account)}`);
  redirect(addSearchParamsToPath(redirectPath, { ok: "deleted_user" }));
}

function portalTicketsRole(type: string): ticketRepo.PortalTicketRole | null {
  if (type === "MNGR" || type === "RSLR") return type;
  return null;
}

async function requirePortalTicketsSession() {
  const s = await requirePortalSession();
  const role = portalTicketsRole(s.type);
  if (!role) redirect(portalBasePathByType(s.type));
  return { session: s, role };
}

async function assertPortalTicketAccessOrRedirect(
  username: string,
  role: ticketRepo.PortalTicketRole,
  ticketId: number,
  redirectOnDeny: string,
) {
  const ok = await ticketRepo.assertPortalTicketAccess(username, role, ticketId);
  if (!ok) redirect(redirectOnDeny);
}

/** Manager and dealer tickets (PHP `manager/Tickets`, `dealer/Tickets`). */
export async function createPortalTicketAction(formData: FormData) {
  const { session: s, role } = await requirePortalTicketsSession();
  const base = portalBasePathByType(s.type);
  const scope = await ticketRepo.getPortalTicketScope(s.username, role);
  if (!scope) redirect(`${base}/tickets/create?error=db`);

  const subject = String(formData.get("subject") ?? "").trim();
  const description = String(formData.get("description") ?? "");
  const priority = Number(formData.get("priority"));
  const category_id = Number(formData.get("category"));
  const channel_id = Number(formData.get("channel"));
  const channel_number = Number(String(formData.get("channel_number") ?? "").trim());
  if (!subject || !Number.isFinite(priority) || priority < 1 || priority > 3) {
    redirect(`${base}/tickets/create?error=validation`);
  }
  if (!Number.isFinite(category_id) || category_id <= 0 || !Number.isFinite(channel_id) || channel_id <= 0) {
    redirect(`${base}/tickets/create?error=validation`);
  }
  if (!Number.isFinite(channel_number) || channel_number <= 0) {
    redirect(`${base}/tickets/create?error=validation`);
  }
  try {
    await ticketRepo.insertTicket({
      subject,
      descriptionHtml: description,
      priority_id: priority,
      channel_number,
      category_id,
      channel_id,
      flags: {
        no_audio: ticketCheckboxOn(formData, "no_audio"),
        no_video: ticketCheckboxOn(formData, "no_video"),
        stream_error: ticketCheckboxOn(formData, "stream_error"),
        no_epg: ticketCheckboxOn(formData, "no_epg"),
        catch_up_needed: ticketCheckboxOn(formData, "catch_up_needed"),
        epg_needed: ticketCheckboxOn(formData, "epg_needed"),
        file_missing: ticketCheckboxOn(formData, "file_missing"),
        wrong_channel_name: ticketCheckboxOn(formData, "wrong_channel_name"),
      },
      user_id: scope.billingUserId,
    });
  } catch {
    redirect(`${base}/tickets/create?error=db`);
  }
  revalidatePath(`${base}/tickets`);
  redirect(`${base}/tickets?ok=created`);
}

export async function markPortalTicketCompleteAction(formData: FormData) {
  const { session: s, role } = await requirePortalTicketsSession();
  const base = portalBasePathByType(s.type);
  const id = Number(formData.get("ticket_id"));
  if (!Number.isFinite(id) || id <= 0) redirect(`${base}/tickets?error=ticket`);
  await assertPortalTicketAccessOrRedirect(s.username, role, id, `${base}/tickets?error=ticket`);
  const scope = await ticketRepo.getPortalTicketScope(s.username, role);
  if (!scope) redirect(`${base}/tickets?error=ticket`);
  await ticketRepo.markTicketCompleted(id, scope.billingUserId);
  revalidatePath(`${base}/tickets`);
  revalidatePath(`${base}/tickets/complete`);
  revalidatePath(`${base}/tickets/${id}`);
  redirect(`${base}/tickets?ok=complete`);
}

export async function addPortalTicketCommentAction(formData: FormData) {
  const { session: s, role } = await requirePortalTicketsSession();
  const base = portalBasePathByType(s.type);
  const ticket_id = Number(formData.get("ticket_id"));
  const comment = String(formData.get("comment") ?? "").trim();
  if (!Number.isFinite(ticket_id) || ticket_id <= 0) redirect(`${base}/tickets?error=ticket`);
  if (!comment) redirect(`${base}/tickets/${ticket_id}?error=comment`);
  await assertPortalTicketAccessOrRedirect(s.username, role, ticket_id, `${base}/tickets?error=ticket`);
  const scope = await ticketRepo.getPortalTicketScope(s.username, role);
  if (!scope) redirect(`${base}/tickets?error=ticket`);
  try {
    await ticketRepo.insertTicketComment(ticket_id, comment, scope.billingUserId);
  } catch {
    redirect(`${base}/tickets/${ticket_id}?error=db`);
  }
  revalidatePath(`${base}/tickets/${ticket_id}`);
  revalidatePath(`${base}/tickets`);
  redirect(`${base}/tickets/${ticket_id}?ok=comment`);
}

export async function reopenPortalTicketAction(formData: FormData) {
  const { session: s, role } = await requirePortalTicketsSession();
  const base = portalBasePathByType(s.type);
  const ticket_id = Number(formData.get("ticket_id"));
  if (!Number.isFinite(ticket_id) || ticket_id <= 0) redirect(`${base}/tickets?error=ticket`);
  await assertPortalTicketAccessOrRedirect(s.username, role, ticket_id, `${base}/tickets?error=ticket`);
  const scope = await ticketRepo.getPortalTicketScope(s.username, role);
  if (!scope) redirect(`${base}/tickets?error=ticket`);
  await ticketRepo.reopenTicket(ticket_id, scope.billingUserId);
  revalidatePath(`${base}/tickets`);
  revalidatePath(`${base}/tickets/complete`);
  revalidatePath(`${base}/tickets/${ticket_id}`);
  redirect(`${base}/tickets?ok=reopened`);
}

export async function updatePortalTicketAction(formData: FormData) {
  const { session: s, role } = await requirePortalTicketsSession();
  const base = portalBasePathByType(s.type);
  const ticket_id = Number(formData.get("ticket_id"));
  const priority = Number(formData.get("priority"));
  const status = Number(formData.get("status"));
  if (!Number.isFinite(ticket_id) || ticket_id <= 0) redirect(`${base}/tickets?error=ticket`);
  if (!Number.isFinite(priority) || priority < 1 || priority > 3) {
    redirect(`${base}/tickets/${ticket_id}?error=validation`);
  }
  if (!Number.isFinite(status) || status < 1 || status > 3) {
    redirect(`${base}/tickets/${ticket_id}?error=validation`);
  }
  await assertPortalTicketAccessOrRedirect(s.username, role, ticket_id, `${base}/tickets?error=ticket`);
  const scope = await ticketRepo.getPortalTicketScope(s.username, role);
  if (!scope) redirect(`${base}/tickets?error=ticket`);
  const ok = await ticketRepo.updateTicketPriorityAndStatus(ticket_id, priority, status, scope.billingUserId);
  if (!ok) redirect(`${base}/tickets/${ticket_id}?error=db`);
  revalidatePath(`${base}/tickets`);
  revalidatePath(`${base}/tickets/complete`);
  revalidatePath(`${base}/tickets/${ticket_id}`);
  redirect(`${base}/tickets?ok=updated`);
}

export async function deletePortalTicketAction(formData: FormData) {
  const { session: s, role } = await requirePortalTicketsSession();
  const base = portalBasePathByType(s.type);
  const ticket_id = Number(formData.get("ticket_id"));
  if (!Number.isFinite(ticket_id) || ticket_id <= 0) redirect(`${base}/tickets?error=ticket`);
  await assertPortalTicketAccessOrRedirect(s.username, role, ticket_id, `${base}/tickets?error=ticket`);
  const ok = await ticketRepo.deleteTicketById(ticket_id);
  if (!ok) redirect(`${base}/tickets/${ticket_id}?error=db`);
  revalidatePath(`${base}/tickets`);
  revalidatePath(`${base}/tickets/complete`);
  redirect(`${base}/tickets?ok=deleted`);
}

export async function changePasswordAction(formData: FormData) {
  const s = await requireRootSession();
  const returnTo = String(formData.get("return_to") ?? "").trim().toLowerCase();
  const securityBase = "/admin/settings?tab=security";
  const failPath = (code: string) => (returnTo === "settings" ? `${securityBase}&error=${encodeURIComponent(code)}` : `/admin/profile?error=${encodeURIComponent(code)}`);
  const old_password = String(formData.get("old_password") ?? "");
  const new_password = String(formData.get("new_password") ?? "");
  const new_confirm_passsword = String(formData.get("new_confirm_passsword") ?? "");
  if (old_password.length < 3 || old_password.length > 100) {
    redirect(failPath("old_len"));
  }
  if (new_password.length < 4 || new_password.length > 12 || new_confirm_passsword.length < 4 || new_confirm_passsword.length > 12) {
    redirect(failPath("new_len"));
  }
  if (new_password !== new_confirm_passsword) {
    redirect(failPath("match"));
  }
  const ok = await repo.verifyUserPassword(s.username, old_password);
  if (!ok) redirect(failPath("old"));
  await repo.setUserPassword(s.username, new_confirm_passsword);
  await clearSession();
  redirect("/login?ok=password");
}

/** Manager / reseller / dealer profile: same flow as PHP `Profile` controllers (session cleared after change). */
export async function changeOperatorPasswordAction(formData: FormData) {
  const s = await requirePortalSession();
  if (!(s.type === "MNGR" || s.type === "SRSLR" || s.type === "RSLR")) {
    redirect("/login?error=forbidden");
  }
  const base = portalBasePathByType(s.type);
  const old_password = String(formData.get("old_password") ?? "");
  const new_password = String(formData.get("new_password") ?? "");
  const new_confirm_passsword = String(formData.get("new_confirm_passsword") ?? "");

  if (old_password.length < 3 || old_password.length > 100) {
    redirect(`${base}/profile?error=old_len`);
  }
  if (new_password.length < 4 || new_password.length > 12 || new_confirm_passsword.length < 4 || new_confirm_passsword.length > 12) {
    redirect(`${base}/profile?error=new_len`);
  }
  if (new_password !== new_confirm_passsword) {
    redirect(`${base}/profile?error=match`);
  }
  const ok = await repo.verifyUserPassword(s.username, old_password);
  if (!ok) redirect(`${base}/profile?error=old`);
  await repo.setUserPassword(s.username, new_confirm_passsword);
  await clearSession();
  redirect("/login?ok=password");
}

function wantsReturnToStaff(formData: FormData): boolean {
  return String(formData.get("return_to_staff") ?? "") === "1";
}

function redirectStaffCreateMissing(formData: FormData, role: "manager" | "reseller" | "dealer") {
  if (wantsReturnToStaff(formData)) {
    redirect(`/admin/managers?error=missing&staff_new=${role}`);
  }
  if (role === "manager") redirect("/admin/managers/new?error=missing");
  if (role === "reseller") redirect("/admin/resellers/new?error=missing");
  redirect("/admin/dealers/new?error=missing");
}

function redirectStaffCreatePasswordMismatch(formData: FormData, role: "manager" | "reseller" | "dealer") {
  if (wantsReturnToStaff(formData)) {
    redirect(`/admin/managers?error=password_mismatch&staff_new=${role}`);
  }
  if (role === "manager") redirect("/admin/managers/new?error=password_mismatch");
  if (role === "reseller") redirect("/admin/resellers/new?error=password_mismatch");
  redirect("/admin/dealers/new?error=password_mismatch");
}

export async function saveManagerAction(formData: FormData) {
  await requireRootSession();
  const intent = String(formData.get("_intent") ?? "edit");
  if (intent === "new") {
    const name = String(formData.get("name") ?? "").trim();
    const username = String(formData.get("username") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const passwordConfirm = String(formData.get("password_confirm") ?? "");
    if (!name || !username || !password) redirectStaffCreateMissing(formData, "manager");
    if (password !== passwordConfirm) redirectStaffCreatePasswordMismatch(formData, "manager");
    await repo.insertManager({ name, username, password });
    revalidatePath("/admin/managers");
    redirect("/admin/managers?ok=created_manager");
  }
  const username = String(formData.get("username") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const status = normUserStatus(String(formData.get("status") ?? "A"));
  const comments = String(formData.get("comments") ?? "");
  const redirectPath = safeAdminManagersRedirectPath(String(formData.get("redirect") ?? ""));
  if (!username || !password) redirect(`/admin/managers/${encodeURIComponent(username)}?error=missing`);
  await repo.updateManager({ username, name, password, status, comments });
  revalidatePath("/admin/managers");
  if (redirectPath) {
    redirect(addSearchParamsToPath(redirectPath, { ok: "1" }));
  }
  redirect(`/admin/managers/${encodeURIComponent(username)}?ok=1`);
}

export async function saveResellerAction(formData: FormData) {
  await requireRootSession();
  const intent = String(formData.get("_intent") ?? "edit");
  if (intent === "new") {
    const name = String(formData.get("name") ?? "").trim();
    const username = String(formData.get("username") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const passwordConfirm = String(formData.get("password_confirm") ?? "");
    const manager = String(formData.get("manager") ?? "").trim();
    if (!name || !username || !password || !manager) redirectStaffCreateMissing(formData, "reseller");
    if (password !== passwordConfirm) redirectStaffCreatePasswordMismatch(formData, "reseller");
    await repo.insertReseller({ name, username, password, manager });
    revalidatePath("/admin/resellers");
    revalidatePath("/admin/managers");
    if (wantsReturnToStaff(formData)) redirect("/admin/managers?ok=created_reseller");
    redirect("/admin/resellers?ok=1");
  }
  const username = String(formData.get("username") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const status = normUserStatus(String(formData.get("status") ?? "A"));
  const manager = String(formData.get("manager") ?? "").trim();
  const comments = String(formData.get("comments") ?? "");
  const redirectPath = safeAdminResellersRedirectPath(String(formData.get("redirect") ?? ""));
  if (!username || !password || !manager) redirect(`/admin/resellers/${encodeURIComponent(username)}?error=missing`);
  await repo.updateReseller({ username, name, password, status, manager, comments });
  revalidatePath("/admin/resellers");
  if (redirectPath) {
    redirect(addSearchParamsToPath(redirectPath, { ok: "1" }));
  }
  redirect(`/admin/resellers/${encodeURIComponent(username)}?ok=1`);
}

function parseCreditOperation(raw: string): "ADD" | "RECOVER" | null {
  const v = raw.trim().toUpperCase();
  if (v === "ADD" || v === "CRDT") return "ADD";
  if (v === "RECOVER" || v === "DBIT") return "RECOVER";
  return null;
}

function creditRedirectPath(raw: string, fallbackDetailPath: string, role: "manager" | "reseller" | "dealer"): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return fallbackDetailPath;
  if (role === "manager") return safeAdminManagersRedirectPath(trimmed);
  if (role === "reseller") return safeAdminResellersRedirectPath(trimmed);
  return safeAdminDealersRedirectPath(trimmed);
}

export async function applyResellerCreditsAction(formData: FormData) {
  const s = await requireRootSession();
  const username = String(formData.get("username") ?? "").trim();
  const detailPath = `/admin/resellers/${encodeURIComponent(username)}`;
  const redirectPath = creditRedirectPath(String(formData.get("redirect") ?? ""), detailPath, "reseller");
  const op = parseCreditOperation(String(formData.get("type") ?? "ADD"));
  const credits = Number.parseInt(String(formData.get("credits") ?? "").trim(), 10);
  if (!username || !op || !Number.isFinite(credits)) {
    redirect(addSearchParamsToPath(redirectPath, { error: "credits_invalid", credit_modal: op === "RECOVER" ? "recover" : "add", credit_user: username }));
  }
  const r = await repo.adjustHierarchyCredits({
    targetUsername: username,
    targetType: "SRSLR",
    operation: op,
    credits,
    operatorUsername: s.username,
    portal: "admin_reseller",
  });
  if (!r.ok) {
    if (r.code === "insufficient_credits") {
      redirect(
        addSearchParamsToPath(redirectPath, {
          error: "credits_balance",
          bal: String(r.balance ?? 0),
          req: String(r.required ?? credits),
          credit_modal: op === "RECOVER" ? "recover" : "add",
          credit_user: username,
        }),
      );
    }
    const q = r.code === "invalid" ? "credits_invalid" : "credits_db";
    redirect(addSearchParamsToPath(redirectPath, { error: q, credit_modal: op === "RECOVER" ? "recover" : "add", credit_user: username }));
  }
  revalidatePath(`/admin/resellers/${encodeURIComponent(username)}`);
  revalidatePath("/admin/resellers");
  revalidatePath("/admin/managers");
  redirect(addSearchParamsToPath(redirectPath, { ok: `credits_${op === "ADD" ? "added" : "recovered"}` }));
}

export async function saveDealerAction(formData: FormData) {
  await requireRootSession();
  const intent = String(formData.get("_intent") ?? "edit");
  const ticketsRaw = String(formData.get("tickets_manager") ?? "No");
  const tickets = ticketsRaw === "Yes" || ticketsRaw === "1" ? 1 : 0;
  if (intent === "new") {
    const name = String(formData.get("name") ?? "").trim();
    const username = String(formData.get("username") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const passwordConfirm = String(formData.get("password_confirm") ?? "");
    const username_owner = String(formData.get("username_owner") ?? "").trim();
    if (!name || !username || !password || !username_owner) redirectStaffCreateMissing(formData, "dealer");
    if (password !== passwordConfirm) redirectStaffCreatePasswordMismatch(formData, "dealer");
    await repo.insertDealer({ name, username, password, username_owner, tickets_enable: tickets });
    revalidatePath("/admin/dealers");
    revalidatePath("/admin/managers");
    if (wantsReturnToStaff(formData)) redirect("/admin/managers?ok=created_dealer");
    redirect("/admin/dealers?ok=1");
  }
  const username = String(formData.get("username") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const status = normUserStatus(String(formData.get("status") ?? "A"));
  const username_owner = String(formData.get("username_owner") ?? "").trim();
  const comments = String(formData.get("comments") ?? "");
  const redirectPath = safeAdminDealersRedirectPath(String(formData.get("redirect") ?? ""));
  if (!username || !password || !username_owner) redirect(`/admin/dealers/${encodeURIComponent(username)}?error=missing`);
  await repo.updateDealer({
    username,
    name,
    password,
    status,
    username_owner,
    tickets_enable: tickets,
    comments,
  });
  revalidatePath("/admin/dealers");
  if (redirectPath) {
    redirect(addSearchParamsToPath(redirectPath, { ok: "1" }));
  }
  redirect(`/admin/dealers/${encodeURIComponent(username)}?ok=1`);
}

export async function resetStaffPasswordAction(formData: FormData) {
  await requireRootSession();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("password_confirm") ?? "");
  if (!username || !password || !confirmPassword) {
    redirect("/admin/managers?error=missing");
  }
  if (password !== confirmPassword) {
    redirect("/admin/managers?error=password_mismatch");
  }
  if (password.length < 4 || password.length > 12) {
    redirect("/admin/managers?error=new_len");
  }
  await repo.setUserPassword(username, password);
  revalidatePath("/admin/managers");
  redirect("/admin/managers?ok=password_reset");
}

export async function applyDealerCreditsAction(formData: FormData) {
  const s = await requireRootSession();
  const username = String(formData.get("username") ?? "").trim();
  const detailPath = `/admin/dealers/${encodeURIComponent(username)}`;
  const redirectPath = creditRedirectPath(String(formData.get("redirect") ?? ""), detailPath, "dealer");
  const op = parseCreditOperation(String(formData.get("type") ?? "ADD"));
  const credits = Number.parseInt(String(formData.get("credits") ?? "").trim(), 10);
  if (!username || !op || !Number.isFinite(credits)) {
    redirect(addSearchParamsToPath(redirectPath, { error: "credits_invalid", credit_modal: op === "RECOVER" ? "recover" : "add", credit_user: username }));
  }
  const r = await repo.adjustHierarchyCredits({
    targetUsername: username,
    targetType: "RSLR",
    operation: op,
    credits,
    operatorUsername: s.username,
    portal: "admin_dealer",
  });
  if (!r.ok) {
    if (r.code === "insufficient_credits") {
      redirect(
        addSearchParamsToPath(redirectPath, {
          error: "credits_balance",
          bal: String(r.balance ?? 0),
          req: String(r.required ?? credits),
          credit_modal: op === "RECOVER" ? "recover" : "add",
          credit_user: username,
        }),
      );
    }
    const q = r.code === "invalid" ? "credits_invalid" : "credits_db";
    redirect(addSearchParamsToPath(redirectPath, { error: q, credit_modal: op === "RECOVER" ? "recover" : "add", credit_user: username }));
  }
  revalidatePath(`/admin/dealers/${encodeURIComponent(username)}`);
  revalidatePath("/admin/dealers");
  revalidatePath("/admin/managers");
  redirect(addSearchParamsToPath(redirectPath, { ok: `credits_${op === "ADD" ? "added" : "recovered"}` }));
}

export async function applyManagerCreditsAction(formData: FormData) {
  const s = await requireRootSession();
  const username = String(formData.get("username") ?? "").trim();
  const detailPath = `/admin/managers/${encodeURIComponent(username)}`;
  const redirectPath = creditRedirectPath(String(formData.get("redirect") ?? ""), detailPath, "manager");
  const op = parseCreditOperation(String(formData.get("type") ?? "ADD"));
  const credits = Number.parseInt(String(formData.get("credits") ?? "").trim(), 10);
  if (!username || !op || !Number.isFinite(credits)) {
    redirect(addSearchParamsToPath(redirectPath, { error: "credits_invalid", credit_modal: op === "RECOVER" ? "recover" : "add", credit_user: username }));
  }
  const r = await repo.adjustManagerCredits({
    adminUsername: s.username,
    managerUsername: username,
    operation: op,
    credits,
    operatorUsername: s.username,
  });
  if (!r.ok) {
    if (r.code === "insufficient_credits") {
      redirect(
        addSearchParamsToPath(redirectPath, {
          error: "credits_balance",
          bal: String(r.balance ?? 0),
          req: String(r.required ?? credits),
          credit_modal: op === "RECOVER" ? "recover" : "add",
          credit_user: username,
        }),
      );
    }
    const q = r.code === "invalid" ? "credits_invalid" : "credits_db";
    redirect(addSearchParamsToPath(redirectPath, { error: q, credit_modal: op === "RECOVER" ? "recover" : "add", credit_user: username }));
  }
  revalidatePath(`/admin/managers/${encodeURIComponent(username)}`);
  revalidatePath("/admin/managers");
  redirect(addSearchParamsToPath(redirectPath, { ok: `credits_${op === "ADD" ? "added" : "recovered"}` }));
}

export async function loadDealersForResellerAction(resellerUsername: string) {
  await requireRootSession();
  const r = resellerUsername.trim();
  if (!r) return [];
  return repo.listDealersForReseller(r);
}

/** Dealers under a reseller, only if that reseller is owned by the logged-in manager (portal “add user” UX). */
export async function loadDealersForManagerResellerAction(resellerUsername: string) {
  const s = await requireManagerSession();
  const r = resellerUsername.trim();
  if (!r) return [];
  if (!(await managerPortal.managerOwnsReseller(s.username, r))) return [];
  return repo.listDealersForReseller(r);
}

function addonPackIdsFromForm(formData: FormData): number[] {
  const out: number[] = [];
  for (const v of formData.getAll("packs")) {
    const n = Number.parseInt(String(v), 10);
    if (Number.isFinite(n) && n > 0) out.push(n);
  }
  return out;
}

export async function createUserAction(formData: FormData) {
  await requireRootSession();
  const cfg = await repo.getDeductionsConfig();
  const full_name = String(formData.get("name") ?? "").trim();
  const account = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const mac = String(formData.get("mac") ?? "").trim();
  const note = String(formData.get("note") ?? "");
  const validity = String(formData.get("validity") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "0");
  const status = statusRaw === "1" ? 1 : 0;
  const reseller = String(formData.get("reseller") ?? "").trim();
  const dealer = String(formData.get("dealer") ?? "").trim();
  const returnToRaw = String(formData.get("returnTo") ?? "").trim();
  const returnTo = returnToRaw.startsWith("/admin/users") ? returnToRaw : "";
  const packageRaw = String(formData.get("package") ?? "0");
  const tariff_plan_id = Number.parseInt(packageRaw, 10);

  const result = await createEndUserAccount({
    full_name,
    account,
    password,
    mac,
    validity,
    status,
    reseller,
    dealer,
    tariff_plan_id,
    monthFreeEnabled: cfg.monthFree,
    addonPackageIds: addonPackIdsFromForm(formData),
  });

  if (!result.ok) {
    if (returnTo) {
      if (result.code === "insufficient_credits") {
        redirect(
          addSearchParamsToPath(returnTo, {
            addUser: "1",
            error: "insufficient_credits",
            bal: String(result.balance ?? 0),
            req: String(result.required ?? 0),
          }),
        );
      }
      redirect(addSearchParamsToPath(returnTo, { addUser: "1", error: result.code }));
    }
    if (result.code === "insufficient_credits") {
      redirect(
        `/admin/users/new?error=insufficient_credits&bal=${encodeURIComponent(String(result.balance ?? 0))}&req=${encodeURIComponent(String(result.required ?? 0))}`,
      );
    }
    redirect(`/admin/users/new?error=${encodeURIComponent(result.code)}`);
  }
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${encodeURIComponent(result.account)}`);
  if (note.trim()) {
    await repo.updateAccountWithStalkerSync({
      account: result.account,
      full_name,
      mac,
      phone: "",
      note,
      status,
      password,
      tariff_plan_id: Number.isFinite(tariff_plan_id) && tariff_plan_id > 0 ? tariff_plan_id : undefined,
    });
  }
  if (returnTo) {
    redirect(addSearchParamsToPath(returnTo, { ok: "created" }));
  }
  redirect(`/admin/users/${encodeURIComponent(result.account)}?ok=1`);
}

/** PHP `dealer/Users::add` — owner reseller + dealer come from session; debits dealer credits. */
export async function createDealerEndUserAction(formData: FormData) {
  const s = await requireDealerSession();
  const cfg = await repo.getDeductionsConfig();
  const reseller = await repo.getResellerUsernameForDealer(s.username);
  if (!reseller) redirect("/dealer/users/new?error=bad_owner");

  const full_name = String(formData.get("name") ?? "").trim();
  const account = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const mac = String(formData.get("mac") ?? "").trim();
  const validity = String(formData.get("validity") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "0");
  const status = statusRaw === "1" ? 1 : 0;
  const packageRaw = String(formData.get("package") ?? "0");
  const tariff_plan_id = Number.parseInt(packageRaw, 10);

  const result = await createEndUserAccount({
    full_name,
    account,
    password,
    mac,
    validity,
    status,
    reseller,
    dealer: s.username,
    tariff_plan_id,
    monthFreeEnabled: cfg.monthFree,
    addonPackageIds: addonPackIdsFromForm(formData),
  });

  if (!result.ok) {
    if (result.code === "insufficient_credits") {
      redirect(
        `/dealer/users/new?error=insufficient_credits&bal=${encodeURIComponent(String(result.balance ?? 0))}&req=${encodeURIComponent(String(result.required ?? 0))}`,
      );
    }
    redirect(`/dealer/users/new?error=${encodeURIComponent(result.code)}`);
  }
  revalidatePath("/dealer/users");
  revalidatePath(`/dealer/users/${encodeURIComponent(result.account)}`);
  redirect("/dealer/users?ok=created");
}

/** PHP `reseller/Users::add` — `accounts.username` is the reseller; new users are active (PHP ignores status on add). */
export async function createResellerEndUserAction(formData: FormData) {
  const s = await requireResellerSession();
  const cfg = await repo.getDeductionsConfig();

  const full_name = String(formData.get("name") ?? "").trim();
  const account = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const mac = String(formData.get("mac") ?? "").trim();
  const validity = String(formData.get("validity") ?? "").trim();
  const packageRaw = String(formData.get("package") ?? "0");
  const tariff_plan_id = Number.parseInt(packageRaw, 10);

  const result = await createEndUserAccount({
    full_name,
    account,
    password,
    mac,
    validity,
    status: 0,
    reseller: s.username,
    dealer: "",
    tariff_plan_id,
    monthFreeEnabled: cfg.monthFree,
    addonPackageIds: addonPackIdsFromForm(formData),
  });

  if (!result.ok) {
    if (result.code === "insufficient_credits") {
      redirect(
        `/reseller/users/new?error=insufficient_credits&bal=${encodeURIComponent(String(result.balance ?? 0))}&req=${encodeURIComponent(String(result.required ?? 0))}`,
      );
    }
    redirect(`/reseller/users/new?error=${encodeURIComponent(result.code)}`);
  }
  revalidatePath("/reseller/users");
  revalidatePath(`/reseller/users/${encodeURIComponent(result.account)}`);
  redirect("/reseller/users?ok=created");
}

/**
 * PHP parity: end users owned by a dealer under this reseller (`accounts.username` = dealer).
 * Used from `/reseller/dealers/[dealer]/users/new` (not reseller-direct `/reseller/users/new`).
 */
export async function createResellerDealerEndUserAction(formData: FormData) {
  const s = await requireResellerSession();
  const dealer = String(formData.get("dealer") ?? "").trim();
  const dealerSeg = encodeURIComponent(dealer);
  const newPath = `/reseller/dealers/${dealerSeg}/users/new`;
  if (!dealer) redirect(`${newPath}?error=missing_dealer`);
  if (!(await resellerPortal.resellerOwnsDealer(s.username, dealer))) {
    redirect("/reseller/dealers?error=forbidden");
  }

  const cfg = await repo.getDeductionsConfig();
  const full_name = String(formData.get("name") ?? "").trim();
  const account = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const mac = String(formData.get("mac") ?? "").trim();
  const validity = String(formData.get("validity") ?? "").trim();
  const packageRaw = String(formData.get("package") ?? "0");
  const tariff_plan_id = Number.parseInt(packageRaw, 10);

  const result = await createEndUserAccount({
    full_name,
    account,
    password,
    mac,
    validity,
    status: 0,
    reseller: s.username,
    dealer,
    tariff_plan_id,
    monthFreeEnabled: cfg.monthFree,
    addonPackageIds: addonPackIdsFromForm(formData),
  });

  if (!result.ok) {
    if (result.code === "insufficient_credits") {
      redirect(
        `${newPath}?error=insufficient_credits&bal=${encodeURIComponent(String(result.balance ?? 0))}&req=${encodeURIComponent(String(result.required ?? 0))}`,
      );
    }
    redirect(`${newPath}?error=${encodeURIComponent(result.code)}`);
  }
  revalidatePath(`/reseller/dealers/${dealerSeg}/users`);
  revalidatePath("/reseller/dealers");
  revalidatePath(`/reseller/dealers/${dealerSeg}`);
  revalidatePath(`/reseller/users/${encodeURIComponent(result.account)}`);
  redirect(`/reseller/dealers/${dealerSeg}/users?ok=created`);
}

/**
 * Manager portal create end-user: pick reseller (and optional dealer) in the manager’s tree.
 * Credits debit the dealer if set, otherwise the reseller (`createEndUserAccount`), matching the admin hierarchy model.
 */
export async function createManagerEndUserAction(formData: FormData) {
  const s = await requireManagerSession();
  const cfg = await repo.getDeductionsConfig();

  const reseller = String(formData.get("reseller") ?? "").trim();
  const dealer = String(formData.get("dealer") ?? "").trim();
  if (!reseller) redirect("/manager/users/new?error=missing_hierarchy");
  if (!(await managerPortal.managerOwnsReseller(s.username, reseller))) {
    redirect("/manager/users/new?error=forbidden");
  }
  if (dealer) {
    if (!(await managerPortal.managerOwnsDealer(s.username, dealer))) {
      redirect("/manager/users/new?error=forbidden");
    }
    if (!(await resellerPortal.resellerOwnsDealer(reseller, dealer))) {
      redirect("/manager/users/new?error=forbidden_dealer");
    }
  }

  const full_name = String(formData.get("name") ?? "").trim();
  const account = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const mac = String(formData.get("mac") ?? "").trim();
  const validity = String(formData.get("validity") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "0");
  const status = statusRaw === "1" ? 1 : 0;
  const packageRaw = String(formData.get("package") ?? "0");
  const tariff_plan_id = Number.parseInt(packageRaw, 10);

  const result = await createEndUserAccount({
    full_name,
    account,
    password,
    mac,
    validity,
    status,
    reseller,
    dealer,
    tariff_plan_id,
    monthFreeEnabled: cfg.monthFree,
    addonPackageIds: addonPackIdsFromForm(formData),
  });

  if (!result.ok) {
    if (result.code === "insufficient_credits") {
      redirect(
        `/manager/users/new?error=insufficient_credits&bal=${encodeURIComponent(String(result.balance ?? 0))}&req=${encodeURIComponent(String(result.required ?? 0))}`,
      );
    }
    redirect(`/manager/users/new?error=${encodeURIComponent(result.code)}`);
  }
  revalidatePath("/manager/users");
  revalidatePath(`/manager/users/${encodeURIComponent(result.account)}`);
  redirect("/manager/users?ok=created");
}

/** Manager portal: create end-user under a fixed dealer (PHP hierarchy; same as {@link createManagerEndUserAction} with known reseller). */
export async function createManagerDealerEndUserAction(formData: FormData) {
  const s = await requireManagerSession();
  const dealer = String(formData.get("dealer") ?? "").trim();
  const dealerSeg = encodeURIComponent(dealer);
  const newPath = `/manager/dealers/${dealerSeg}/users/new`;
  if (!dealer) redirect(`${newPath}?error=missing_dealer`);
  if (!(await managerPortal.managerOwnsDealer(s.username, dealer))) {
    redirect("/manager/dealers?error=forbidden");
  }
  const reseller = await repo.getResellerUsernameForDealer(dealer);
  if (!reseller) redirect(`${newPath}?error=forbidden`);
  if (!(await managerPortal.managerOwnsReseller(s.username, reseller))) {
    redirect(`${newPath}?error=forbidden`);
  }
  if (!(await resellerPortal.resellerOwnsDealer(reseller, dealer))) {
    redirect(`${newPath}?error=forbidden_dealer`);
  }

  const cfg = await repo.getDeductionsConfig();
  const full_name = String(formData.get("name") ?? "").trim();
  const account = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const mac = String(formData.get("mac") ?? "").trim();
  const validity = String(formData.get("validity") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "0");
  const status = statusRaw === "1" ? 1 : 0;
  const packageRaw = String(formData.get("package") ?? "0");
  const tariff_plan_id = Number.parseInt(packageRaw, 10);

  const result = await createEndUserAccount({
    full_name,
    account,
    password,
    mac,
    validity,
    status,
    reseller,
    dealer,
    tariff_plan_id,
    monthFreeEnabled: cfg.monthFree,
    addonPackageIds: addonPackIdsFromForm(formData),
  });

  if (!result.ok) {
    if (result.code === "insufficient_credits") {
      redirect(
        `${newPath}?error=insufficient_credits&bal=${encodeURIComponent(String(result.balance ?? 0))}&req=${encodeURIComponent(String(result.required ?? 0))}`,
      );
    }
    redirect(`${newPath}?error=${encodeURIComponent(result.code)}`);
  }
  revalidatePath(`/manager/dealers/${dealerSeg}/users`);
  revalidatePath("/manager/dealers");
  revalidatePath(`/manager/dealers/${dealerSeg}`);
  revalidatePath("/manager/users");
  revalidatePath(`/manager/users/${encodeURIComponent(result.account)}`);
  redirect(`/manager/dealers/${dealerSeg}/users?ok=created`);
}

export async function bulkRenewAccountsAction(
  accounts: string[],
  validity: string,
): Promise<{ ok: true; results: repo.BulkRenewAccountResult[] } | { ok: false; error: string }> {
  await requireRootSession();
  if (!Array.isArray(accounts)) return { ok: false, error: "invalid_payload" };
  const ids = [...new Set(accounts.map((x) => String(x ?? "").trim()).filter(Boolean))].slice(0, 250);
  if (!ids.length) return { ok: false, error: "no_accounts" };
  const v = String(validity ?? "").trim();
  if (!v) return { ok: false, error: "no_validity" };
  const results = await repo.bulkRenewAccountsByOperator({ accounts: ids, validity: v });
  revalidatePath("/admin/users");
  return { ok: true, results };
}

export async function recoverAccountCreditsAction(
  account: string,
  credits: number,
): Promise<{ ok: true } | { ok: false; error: string; balance?: number; required?: number }> {
  await requireRootSession();
  const acc = String(account ?? "").trim();
  const cr = Math.floor(Number(credits));
  if (!acc) return { ok: false, error: "no_account" };
  if (!Number.isFinite(cr) || cr < 1 || cr > 2000) return { ok: false, error: "invalid" };

  await repo.creditSummarizeBeforeUpdate(acc);
  const result = await repo.recoverAccountCreditsByOperator({ account: acc, credits: cr });
  if (!result.ok) {
    return {
      ok: false,
      error: result.code,
      balance: result.balance,
      required: result.required,
    };
  }

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${encodeURIComponent(acc)}`);
  return { ok: true };
}

export async function getAccountRenewRecoveryAvailabilityAction(account: string): Promise<{
  ok: true;
  expiresAt: string | null;
  recoverableCredits: number | null;
  debitUsername: string | null;
  debitCredits: number | null;
} | {
  ok: false;
  error: string;
}> {
  await requireRootSession();
  const acc = String(account ?? "").trim();
  if (!acc) return { ok: false, error: "no_account" };
  await repo.creditSummarizeBeforeUpdate(acc);
  const data = await repo.getAccountRenewRecoveryAvailability(acc);
  return { ok: true, ...data };
}

export async function bulkSendAccountsMessageAction(input: {
  accounts: string[];
  message: string;
  priority?: number;
}): Promise<{ ok: true; queued: number; unresolvedAccounts: string[] } | { ok: false; error: string }> {
  await requireRootSession();
  const accountsRaw = Array.isArray(input.accounts) ? input.accounts : [];
  const ids = [...new Set(accountsRaw.map((x) => String(x ?? "").trim()).filter(Boolean))].slice(0, 500);
  if (!ids.length) return { ok: false, error: "no_accounts" };
  const message = String(input.message ?? "").trim();
  if (!message) return { ok: false, error: "empty" };
  const pr = Number(input.priority);
  const priority = Number.isFinite(pr) && pr >= 1 && pr <= 3 ? Math.floor(pr) : 2;

  const uids: number[] = [];
  const unresolvedAccounts: string[] = [];
  for (const account of ids) {
    const uid = await getStalkerUserDbIdByLogin(account);
    if (uid == null || uid <= 0) {
      unresolvedAccounts.push(account);
      continue;
    }
    uids.push(uid);
  }
  if (!uids.length) return { ok: false, error: "no_recipients" };

  const queued = await repo.sendStalkerMessageToUserIds(uids, message, priority);
  if (queued === 0) {
    const ready = await repo.stalkerEventsMessagingReady();
    if (ready === "no_events") return { ok: false, error: "events_table" };
    return { ok: false, error: "stalker" };
  }

  revalidatePath("/admin/message");
  return { ok: true, queued, unresolvedAccounts };
}

export async function bulkDeleteAccountsAction(
  accounts: string[],
): Promise<{ ok: true; results: { account: string; ok: boolean; message: string }[] } | { ok: false; error: string }> {
  await requireRootSession();
  if (!Array.isArray(accounts)) return { ok: false, error: "invalid_payload" };
  const ids = [...new Set(accounts.map((x) => String(x ?? "").trim()).filter(Boolean))].slice(0, 250);
  if (!ids.length) return { ok: false, error: "no_accounts" };

  const results: { account: string; ok: boolean; message: string }[] = [];
  const deleteFailureMessage = (code: string) => {
    switch (code) {
      case "invalid":
        return "Invalid account value.";
      case "no_account":
      case "no_account_del":
        return "Account not found in billing.";
      case "no_stalker":
        return "Stalker DB is not configured.";
      case "no_stalker_user":
        return "No matching Stalker user for this account.";
      case "stalker_db":
        return "Stalker DB error while deleting user.";
      case "billing_db":
        return "Billing DB error while deleting account.";
      default:
        return `Delete failed (${code}).`;
    }
  };

  for (const account of ids) {
    const r = await repo.deleteAdminEndUserAccount(account);
    if (r.ok) {
      results.push({ account, ok: true, message: `${account}: deleted` });
    } else {
      results.push({ account, ok: false, message: `${account}: ${deleteFailureMessage(r.code)}` });
    }
  }

  revalidatePath("/admin/users");
  return { ok: true, results };
}

/** PHP `manager|reseller|dealer/Users::renew_one_month_bulk` — scoped accounts, debit portal operator credits. */
export async function bulkRenewPortalAccountsAction(
  accounts: string[],
  validity: string,
): Promise<{ ok: true; results: repo.BulkRenewAccountResult[] } | { ok: false; error: string }> {
  const s = await requirePortalSession();
  if (!(s.type === "MNGR" || s.type === "SRSLR" || s.type === "RSLR")) {
    return { ok: false, error: "forbidden" };
  }
  if (!Array.isArray(accounts)) return { ok: false, error: "invalid_payload" };
  const ids = [...new Set(accounts.map((x) => String(x ?? "").trim()).filter(Boolean))].slice(0, 250);
  if (!ids.length) return { ok: false, error: "no_accounts" };
  const v = String(validity ?? "").trim();
  if (!v) return { ok: false, error: "no_validity" };
  const results = await repo.bulkRenewPortalAccountsByOperator({
    accounts: ids,
    validity: v,
    ownerType: s.type,
    ownerUsername: s.username,
  });
  const base = portalBasePathByType(s.type);
  revalidatePath(`${base}/users`);
  if (base === "/manager" || base === "/reseller") {
    revalidatePath(`${base}/dealers`, "layout");
  }
  return { ok: true, results };
}

/** PHP `admin/Users::renewOneMonth` — `creditSummarize` pre-update + `renew(..., 1)` from the users grid. */
export async function renewAdminUserQuickOneMonthAction(formData: FormData) {
  await requireRootSession();
  const account = String(formData.get("account") ?? "").trim();
  const redirectPath = safeAdminUsersRedirectPath(String(formData.get("redirect") ?? ""));
  if (!account) redirect(addSearchParamsToPath(redirectPath, { error: "renew_quick_invalid" }));

  await repo.creditSummarizeBeforeUpdate(account);
  const r = await repo.renewAccountByOperatorValidity({ account, validity: "1" });
  if (!r.ok) {
    if (r.code === "insufficient_recoverable") {
      redirect(
        addSearchParamsToPath(redirectPath, {
          error: "renew_recover_credits",
          bal: String(r.balance ?? 0),
          req: String(r.required ?? 0),
        }),
      );
    }
    if (r.code === "insufficient_credits") {
      redirect(
        addSearchParamsToPath(redirectPath, {
          error: "renew_credits",
          bal: String(r.balance ?? 0),
          req: String(r.required ?? 1),
        }),
      );
    }
    const err = renewFailureQueryError(r.code);
    const updates: Record<string, string> = { error: err };
    if (r.code === "no_stalker_user") updates.renew_acc = account;
    redirect(addSearchParamsToPath(redirectPath, updates));
  }
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${encodeURIComponent(account)}`);
  const okKey = r.mode === "trial" ? "renew_trial" : r.mode === "recover" ? "renew_recover" : "renew";
  redirect(addSearchParamsToPath(redirectPath, { ok: okKey }));
}

export async function renewUserAction(formData: FormData) {
  await requireRootSession();
  const account = String(formData.get("account") ?? "").trim();
  const type = String(formData.get("type") ?? "RENEW").trim().toUpperCase();
  const validityRaw = String(formData.get("validity") ?? formData.get("months") ?? "").trim();
  const months = Number.parseInt(validityRaw, 10);
  const creditsRaw = String(formData.get("credits") ?? "").trim();
  const credits = Number.parseInt(creditsRaw, 10);
  if (!account) redirect("/admin/users?error=missing");
  await repo.creditSummarizeBeforeUpdate(account);
  const r =
    type === "RCDT"
      ? await repo.recoverAccountCreditsByOperator({ account, credits })
      : await repo.renewAccountByOperatorValidity({ account, validity: validityRaw });
  if (!r.ok) {
    if (r.code === "insufficient_recoverable") {
      redirect(
        `/admin/users/${encodeURIComponent(account)}?error=renew_recover_credits&bal=${encodeURIComponent(String(r.balance ?? 0))}&req=${encodeURIComponent(String(r.required ?? credits))}`,
      );
    }
    if (r.code === "insufficient_credits") {
      redirect(
        `/admin/users/${encodeURIComponent(account)}?error=renew_credits&bal=${encodeURIComponent(String(r.balance ?? 0))}&req=${encodeURIComponent(String(r.required ?? months))}`,
      );
    }
    const err = renewFailureQueryError(r.code);
    const updates: Record<string, string> = { error: err };
    if (r.code === "no_stalker_user") updates.renew_acc = account;
    redirect(addSearchParamsToPath(`/admin/users/${encodeURIComponent(account)}`, updates));
  }
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${encodeURIComponent(account)}`);
  redirect(
    `/admin/users/${encodeURIComponent(account)}?ok=${
      r.mode === "trial" ? "renew_trial" : r.mode === "recover" ? "renew_recover" : "renew"
    }`,
  );
}

/** Manager / reseller / dealer user detail: same renew/recover as admin, but debit logged-in operator (PHP `renew(..., $this->userinfo['username'])`). */
export async function renewOperatorUserAction(formData: FormData) {
  const s = await requirePortalSession();
  if (!(s.type === "MNGR" || s.type === "SRSLR" || s.type === "RSLR")) {
    redirect("/login?error=forbidden");
  }
  const base = portalBasePathByType(s.type) as "/manager" | "/reseller" | "/dealer";
  const listRevalidate = safePortalUsersRedirectPath(String(formData.get("redirect") ?? ""), base);
  const account = String(formData.get("account") ?? "").trim();
  const type = String(formData.get("type") ?? "RENEW").trim().toUpperCase();
  const validityRaw = String(formData.get("validity") ?? formData.get("months") ?? "").trim();
  const months = Number.parseInt(validityRaw, 10);
  const creditsRaw = String(formData.get("credits") ?? "").trim();
  const credits = Number.parseInt(creditsRaw, 10);
  if (!account) redirect(`${base}/users?error=missing`);
  await assertAccountAccessOrRedirect(s, account);
  await repo.creditSummarizeBeforeUpdate(account);

  let r: repo.RenewAccountResult;
  if (type === "RCDT") {
    if (!Number.isFinite(credits) || credits < 1 || credits > 2000) {
      redirect(`${base}/users/${encodeURIComponent(account)}?error=renew_invalid`);
    }
    const pre = await repo.portalOperatorRcdtPrecheckLikePhp({
      ownerType: s.type,
      account,
      credits,
    });
    if (!pre.ok) {
      if (pre.code === "reseller_months") {
        redirect(
          `${base}/users/${encodeURIComponent(account)}?error=renew_rcdt_reseller&max=${encodeURIComponent(String(pre.maxMonths))}&req=${encodeURIComponent(String(pre.required))}`,
        );
      }
      if (pre.code === "insufficient_recoverable") {
        redirect(
          `${base}/users/${encodeURIComponent(account)}?error=renew_recover_credits&bal=${encodeURIComponent(String(pre.balance))}&req=${encodeURIComponent(String(pre.required))}`,
        );
      }
      if (pre.code === "no_summarize") {
        redirect(`${base}/users/${encodeURIComponent(account)}?error=renew_no_summarize`);
      }
      redirect(`${base}/users/${encodeURIComponent(account)}?error=renew_invalid`);
    }
    r = await repo.recoverAccountCreditsByOperator({ account, credits });
  } else {
    if (!repo.operatorRenewValidityFormatLikePhp(validityRaw)) {
      redirect(`${base}/users/${encodeURIComponent(account)}?error=renew_invalid`);
    }
    r = await repo.renewAccountByOperatorValidity({ account, validity: validityRaw, debitUsername: s.username });
  }
  if (!r.ok) {
    if (r.code === "insufficient_recoverable") {
      redirect(
        `${base}/users/${encodeURIComponent(account)}?error=renew_recover_credits&bal=${encodeURIComponent(String(r.balance ?? 0))}&req=${encodeURIComponent(String(r.required ?? credits))}`,
      );
    }
    if (r.code === "insufficient_credits") {
      redirect(
        `${base}/users/${encodeURIComponent(account)}?error=renew_credits&bal=${encodeURIComponent(String(r.balance ?? 0))}&req=${encodeURIComponent(String(r.required ?? months))}`,
      );
    }
    const err = renewFailureQueryError(r.code);
    const updates: Record<string, string> = { error: err };
    if (r.code === "no_stalker_user") updates.renew_acc = account;
    redirect(addSearchParamsToPath(`${base}/users/${encodeURIComponent(account)}`, updates));
  }
  revalidatePortalUsersListCaches(base, listRevalidate);
  revalidatePath(`${base}/users/${encodeURIComponent(account)}`);
  redirect(
    `${base}/users/${encodeURIComponent(account)}?ok=${
      r.mode === "trial" ? "renew_trial" : r.mode === "recover" ? "renew_recover" : "renew"
    }`,
  );
}

/** PHP `manager|reseller|dealer/Users::renewOneMonth` — grid +1, debits logged-in portal operator. */
export async function renewOperatorUserQuickOneMonthAction(formData: FormData) {
  const s = await requirePortalSession();
  if (!(s.type === "MNGR" || s.type === "SRSLR" || s.type === "RSLR")) {
    redirect("/login?error=forbidden");
  }
  const baseRaw = portalBasePathByType(s.type);
  if (baseRaw === "/admin") redirect("/login?error=forbidden");
  const base = baseRaw as "/manager" | "/reseller" | "/dealer";

  const account = String(formData.get("account") ?? "").trim();
  const redirectPath = safePortalUsersRedirectPath(String(formData.get("redirect") ?? ""), base);
  if (!account) redirect(addSearchParamsToPath(redirectPath, { error: "renew_quick_invalid" }));

  await assertAccountAccessOrRedirect(s, account);
  await repo.creditSummarizeBeforeUpdate(account);
  const r = await repo.renewAccountByOperatorValidity({ account, validity: "1", debitUsername: s.username });
  if (!r.ok) {
    if (r.code === "insufficient_recoverable") {
      redirect(
        addSearchParamsToPath(redirectPath, {
          error: "renew_recover_credits",
          bal: String(r.balance ?? 0),
          req: String(r.required ?? 0),
        }),
      );
    }
    if (r.code === "insufficient_credits") {
      redirect(
        addSearchParamsToPath(redirectPath, {
          error: "renew_credits",
          bal: String(r.balance ?? 0),
          req: String(r.required ?? 1),
        }),
      );
    }
    const err = renewFailureQueryError(r.code);
    const updates: Record<string, string> = { error: err };
    if (r.code === "no_stalker_user") updates.renew_acc = account;
    redirect(addSearchParamsToPath(redirectPath, updates));
  }
  revalidatePortalUsersListCaches(base, redirectPath);
  revalidatePath(`${base}/users/${encodeURIComponent(account)}`);
  const okKey = r.mode === "trial" ? "renew_trial" : r.mode === "recover" ? "renew_recover" : "renew";
  redirect(addSearchParamsToPath(redirectPath, { ok: okKey }));
}

export async function saveUserAction(formData: FormData) {
  await requireRootSession();
  const account = String(formData.get("account") ?? "").trim();
  const full_name = String(formData.get("name") ?? "").trim();
  const mac = String(formData.get("mac") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const note = String(formData.get("note") ?? "");
  const password = String(formData.get("password") ?? "");
  const statusRaw = String(formData.get("status") ?? "0");
  const status = statusRaw === "1" ? 1 : 0;
  const reseller = String(formData.get("reseller") ?? "").trim();
  const dealer = String(formData.get("dealer") ?? "").trim();
  const returnToRaw = String(formData.get("returnTo") ?? "").trim();
  const returnTo = returnToRaw.startsWith("/admin/users") ? returnToRaw : "";
  const packageRaw = String(formData.get("package") ?? "").trim();
  const tariffParsed = Number.parseInt(packageRaw, 10);
  const parent_password = String(formData.get("parent_password") ?? "").trim();
  const applyPacksRaw = formData.get("apply_packs");
  const applyPacks = applyPacksRaw == null ? true : String(applyPacksRaw) === "1";
  if (!account) redirect("/admin/users?error=missing");
  if (!/^\d{4}$/.test(parent_password)) {
    if (returnTo) redirect(addSearchParamsToPath(returnTo, { error: "pin", editAccount: account }));
    redirect(`/admin/users/${encodeURIComponent(account)}?error=pin`);
  }
  const owner = await repo.resolveValidatedAccountOwner(reseller, dealer);
  if (!owner) {
    if (returnTo) redirect(addSearchParamsToPath(returnTo, { error: "owner", editAccount: account }));
    redirect(`/admin/users/${encodeURIComponent(account)}?error=owner`);
  }
  const ok = await repo.updateAccountWithStalkerSync({
    account,
    full_name,
    mac,
    phone,
    note,
    status,
    password,
    owner_username: owner,
    tariff_plan_id: Number.isFinite(tariffParsed) && tariffParsed > 0 ? tariffParsed : undefined,
    parent_password,
  });
  if (!ok) {
    if (returnTo) redirect(addSearchParamsToPath(returnTo, { error: "save", editAccount: account }));
    redirect(`/admin/users/${encodeURIComponent(account)}?error=save`);
  }

  const customPid = await getStalkerCustomPackagePlanId();
  if (applyPacks && customPid !== null && Number.isFinite(tariffParsed) && tariffParsed === customPid) {
    const uid = await getStalkerUserDbIdByLogin(account);
    if (uid) {
      const packs = formData
        .getAll("packs")
        .map((v) => Number(String(v)))
        .filter((n) => Number.isFinite(n) && n > 0);
      const okPacks = await setStalkerUserPackageSubscriptions(uid, packs);
      if (!okPacks) {
        if (returnTo) redirect(addSearchParamsToPath(returnTo, { error: "packages", editAccount: account }));
        redirect(`/admin/users/${encodeURIComponent(account)}?error=packages`);
      }
    }
  }

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${encodeURIComponent(account)}`);
  if (returnTo) redirect(addSearchParamsToPath(returnTo, { ok: "user_saved" }));
  redirect(`/admin/users/${encodeURIComponent(account)}?ok=1`);
}

export async function saveOperatorUserAction(formData: FormData) {
  const s = await requirePortalSession();
  if (!(s.type === "MNGR" || s.type === "SRSLR" || s.type === "RSLR")) {
    redirect("/login?error=forbidden");
  }
  const base = portalBasePathByType(s.type) as "/manager" | "/reseller" | "/dealer";
  const listRevalidate = safePortalUsersRedirectPath(String(formData.get("redirect") ?? ""), base);
  const account = String(formData.get("account") ?? "").trim();
  const full_name = String(formData.get("name") ?? "").trim();
  const mac = String(formData.get("mac") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const note = String(formData.get("note") ?? "");
  const password = String(formData.get("password") ?? "");
  const statusRaw = String(formData.get("status") ?? "0");
  const status = statusRaw === "1" ? 1 : 0;
  if (!account) redirect(`${base}/users?error=missing`);
  await assertAccountAccessOrRedirect(s, account);
  const ok = await repo.updateAccountWithStalkerSync({
    account,
    full_name,
    mac,
    phone,
    note,
    status,
    password,
  });
  if (!ok) redirect(`${base}/users/${encodeURIComponent(account)}?error=save`);
  revalidatePortalUsersListCaches(base, listRevalidate);
  revalidatePath(`${base}/users/${encodeURIComponent(account)}`);
  redirect(`${base}/users/${encodeURIComponent(account)}?ok=1`);
}

/** PHP `manager/Users::activate` and `manager/Users::block` quick actions from user detail. */
export async function setManagerUserStatusQuickAction(formData: FormData) {
  const s = await requireManagerSession();
  const base: "/manager" = "/manager";
  const account = String(formData.get("account") ?? "").trim();
  const mode = String(formData.get("mode") ?? "").trim().toLowerCase();
  const redirectPath = safePortalUsersRedirectPath(String(formData.get("redirect") ?? ""), base);
  if (!account) redirect(addSearchParamsToPath(redirectPath, { error: "status_invalid" }));
  if (mode !== "activate" && mode !== "block") {
    redirect(addSearchParamsToPath(redirectPath, { error: "status_invalid" }));
  }

  await assertAccountAccessOrRedirect(s, account);
  const r = await repo.setManagerEndUserStatusLikePhp({
    account,
    mode: mode as "activate" | "block",
  });
  if (!r.ok) {
    const q =
      r.code === "expired_activate"
        ? "activate_expired"
        : r.code === "expired_change"
          ? "block_expired"
          : r.code === "already_active"
            ? "activate_already"
            : r.code === "already_blocked"
              ? "block_already"
              : r.code === "no_account"
                ? "status_no_account"
                : r.code === "no_stalker"
                  ? "status_no_stalker"
                  : r.code === "no_stalker_user"
                    ? "status_no_stalker_user"
                    : "status_db";
    redirect(addSearchParamsToPath(redirectPath, { error: q }));
  }

  revalidatePortalUsersListCaches(base, redirectPath);
  revalidatePath(`/manager/users/${encodeURIComponent(account)}`);
  redirect(addSearchParamsToPath(redirectPath, { ok: mode === "activate" ? "activated" : "blocked" }));
}

/** PHP `reseller/Dealers_users::activate` / `::block` — list-level quick toggle (reseller portal). */
export async function setResellerEndUserStatusQuickAction(formData: FormData) {
  const s = await requireResellerSession();
  const base: "/reseller" = "/reseller";
  const account = String(formData.get("account") ?? "").trim();
  const mode = String(formData.get("mode") ?? "").trim().toLowerCase();
  const redirectPath = safePortalUsersRedirectPath(String(formData.get("redirect") ?? ""), base);
  if (!account) redirect(addSearchParamsToPath(redirectPath, { error: "status_invalid" }));
  if (mode !== "activate" && mode !== "block") {
    redirect(addSearchParamsToPath(redirectPath, { error: "status_invalid" }));
  }

  await assertAccountAccessOrRedirect(s, account);
  const r = await repo.setManagerEndUserStatusLikePhp({
    account,
    mode: mode as "activate" | "block",
  });
  if (!r.ok) {
    const q =
      r.code === "expired_activate"
        ? "activate_expired"
        : r.code === "expired_change"
          ? "block_expired"
          : r.code === "already_active"
            ? "activate_already"
            : r.code === "already_blocked"
              ? "block_already"
              : r.code === "no_account"
                ? "status_no_account"
                : r.code === "no_stalker"
                  ? "status_no_stalker"
                  : r.code === "no_stalker_user"
                    ? "status_no_stalker_user"
                    : "status_db";
    redirect(addSearchParamsToPath(redirectPath, { error: q }));
  }

  revalidatePortalUsersListCaches(base, redirectPath);
  revalidatePath(`/reseller/users/${encodeURIComponent(account)}`);
  redirect(addSearchParamsToPath(redirectPath, { ok: mode === "activate" ? "activated" : "blocked" }));
}

function validManagerPortalUsername(u: string) {
  return /^[a-zA-Z0-9]{3,50}$/.test(u);
}

/** PHP `manager/Resellers::add` — requires manager credit balance ≥ 1. */
export async function createManagerResellerAction(formData: FormData) {
  const s = await requireManagerSession();
  const name = String(formData.get("name") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!name || !username || !password) redirect("/manager/resellers/new?error=missing");
  if (!validManagerPortalUsername(username)) redirect("/manager/resellers/new?error=username");
  if (password.length < 3 || password.length > 50) redirect("/manager/resellers/new?error=password");
  const bal = await repo.getCreditBalance(s.username);
  if (bal < 1) redirect("/manager/resellers/new?error=credits");
  if (await managerPortal.usernameExistsInUsers(username)) redirect("/manager/resellers/new?error=taken");
  const ok = await repo.insertReseller({ name, username, password, manager: s.username });
  if (!ok) redirect("/manager/resellers/new?error=db");
  revalidatePath("/manager/resellers");
  redirect("/manager/resellers?ok=created");
}

/** PHP `manager/Resellers::edit` — manager is fixed to session user. */
export async function saveManagerResellerAction(formData: FormData) {
  const s = await requireManagerSession();
  const username = String(formData.get("username") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const status = normUserStatus(String(formData.get("status") ?? "A"));
  const comments = String(formData.get("comments") ?? "");
  if (!username || !password) redirect(`/manager/resellers/${encodeURIComponent(username)}?error=missing`);
  if (!(await managerPortal.managerOwnsReseller(s.username, username))) redirect("/manager/resellers?error=forbidden");
  await repo.updateReseller({ username, name, password, status, manager: s.username, comments });
  revalidatePath("/manager/resellers");
  redirect(`/manager/resellers/${encodeURIComponent(username)}?ok=1`);
}

export async function deleteManagerResellerAction(formData: FormData) {
  const s = await requireManagerSession();
  const username = String(formData.get("username") ?? "").trim();
  if (!username) redirect("/manager/resellers?error=missing");
  const ok = await managerPortal.deleteResellerOwnedByManager(s.username, username);
  if (!ok) redirect(`/manager/resellers/${encodeURIComponent(username)}?error=delete`);
  revalidatePath("/manager/resellers");
  redirect("/manager/resellers?ok=deleted");
}

export async function applyManagerResellerCreditsAction(formData: FormData) {
  const s = await requireManagerSession();
  const username = String(formData.get("username") ?? "").trim();
  const op = parseCreditOperation(String(formData.get("type") ?? "ADD"));
  const credits = Number.parseInt(String(formData.get("credits") ?? "").trim(), 10);
  if (!username || !op || !Number.isFinite(credits)) {
    redirect(`/manager/resellers/${encodeURIComponent(username)}?error=credits_invalid`);
  }
  if (!(await managerPortal.managerOwnsReseller(s.username, username))) redirect("/manager/resellers?error=forbidden");
  const r = await repo.adjustHierarchyCredits({
    targetUsername: username,
    targetType: "SRSLR",
    operation: op,
    credits,
    operatorUsername: s.username,
    portal: "manager_reseller",
  });
  if (!r.ok) {
    if (r.code === "insufficient_credits") {
      redirect(
        `/manager/resellers/${encodeURIComponent(username)}?error=credits_balance&bal=${encodeURIComponent(String(r.balance ?? 0))}&req=${encodeURIComponent(String(r.required ?? credits))}`,
      );
    }
    const q = r.code === "invalid" ? "credits_invalid" : "credits_db";
    redirect(`/manager/resellers/${encodeURIComponent(username)}?error=${q}`);
  }
  revalidatePath(`/manager/resellers/${encodeURIComponent(username)}`);
  revalidatePath("/manager/resellers");
  redirect(`/manager/resellers/${encodeURIComponent(username)}?ok=credits_${op === "ADD" ? "added" : "recovered"}`);
}

/** PHP `manager/Dealers::edit` — reseller must belong to this manager; preserve `tickets_enable`. */
export async function saveManagerDealerAction(formData: FormData) {
  const s = await requireManagerSession();
  const username = String(formData.get("username") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const status = normUserStatus(String(formData.get("status") ?? "A"));
  const reseller = String(formData.get("reseller") ?? "").trim();
  const comments = String(formData.get("comments") ?? "");
  if (!username || !password || !reseller) redirect(`/manager/dealers/${encodeURIComponent(username)}?error=missing`);
  if (!(await managerPortal.managerOwnsDealer(s.username, username))) redirect("/manager/dealers?error=forbidden");
  if (!(await managerPortal.managerOwnsReseller(s.username, reseller))) redirect(`/manager/dealers/${encodeURIComponent(username)}?error=reseller`);
  const existing = await repo.getDealerByUsername(username);
  if (!existing) redirect("/manager/dealers?error=forbidden");
  await repo.updateDealer({
    username,
    name,
    password,
    status,
    username_owner: reseller,
    tickets_enable: existing.tickets_enable,
    comments,
  });
  revalidatePath("/manager/dealers");
  redirect(`/manager/dealers/${encodeURIComponent(username)}?ok=1`);
}

export async function deleteManagerDealerAction(formData: FormData) {
  const s = await requireManagerSession();
  const username = String(formData.get("username") ?? "").trim();
  if (!username) redirect("/manager/dealers?error=missing");
  const ok = await managerPortal.deleteDealerOwnedByManager(s.username, username);
  if (!ok) redirect("/manager/dealers?error=delete");
  revalidatePath("/manager/dealers");
  redirect("/manager/dealers?ok=deleted");
}

/** PHP `manager/Dealers::add` — parent reseller must belong to this manager. */
export async function createManagerDealerAction(formData: FormData) {
  const s = await requireManagerSession();
  const name = String(formData.get("name") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const reseller = String(formData.get("reseller") ?? "").trim();
  if (!name || !username || !password || !reseller) redirect("/manager/dealers/new?error=missing");
  if (!validManagerPortalUsername(username)) redirect("/manager/dealers/new?error=username");
  if (password.length < 3 || password.length > 50) redirect("/manager/dealers/new?error=password");
  if (!(await managerPortal.managerOwnsReseller(s.username, reseller))) redirect("/manager/dealers/new?error=reseller");
  if (await managerPortal.usernameExistsInUsers(username)) redirect("/manager/dealers/new?error=taken");
  const ok = await repo.insertDealer({
    name,
    username,
    password,
    username_owner: reseller,
    tickets_enable: 0,
  });
  if (!ok) redirect("/manager/dealers/new?error=db");
  revalidatePath("/manager/dealers");
  redirect("/manager/dealers?ok=created");
}

export async function applyManagerDealerCreditsAction(formData: FormData) {
  const s = await requireManagerSession();
  const username = String(formData.get("username") ?? "").trim();
  const op = parseCreditOperation(String(formData.get("type") ?? "ADD"));
  const credits = Number.parseInt(String(formData.get("credits") ?? "").trim(), 10);
  if (!username || !op || !Number.isFinite(credits)) {
    redirect(`/manager/dealers/${encodeURIComponent(username)}?error=credits_invalid`);
  }
  if (!(await managerPortal.managerOwnsDealer(s.username, username))) redirect("/manager/dealers?error=forbidden");
  const r = await repo.adjustHierarchyCredits({
    targetUsername: username,
    targetType: "RSLR",
    operation: op,
    credits,
    operatorUsername: s.username,
    portal: "manager_dealer",
  });
  if (!r.ok) {
    if (r.code === "insufficient_credits") {
      redirect(
        `/manager/dealers/${encodeURIComponent(username)}?error=credits_balance&bal=${encodeURIComponent(String(r.balance ?? 0))}&req=${encodeURIComponent(String(r.required ?? credits))}`,
      );
    }
    const q = r.code === "invalid" ? "credits_invalid" : "credits_db";
    redirect(`/manager/dealers/${encodeURIComponent(username)}?error=${q}`);
  }
  revalidatePath(`/manager/dealers/${encodeURIComponent(username)}`);
  revalidatePath("/manager/dealers");
  redirect(`/manager/dealers/${encodeURIComponent(username)}?ok=credits_${op === "ADD" ? "added" : "recovered"}`);
}

/** PHP `manager/Dealers::status` — activate / block. */
export async function setManagerDealerStatusAction(formData: FormData) {
  const s = await requireManagerSession();
  const username = String(formData.get("username") ?? "").trim();
  const action = String(formData.get("status_action") ?? "").trim();
  if (!username || (action !== "activate" && action !== "block")) redirect("/manager/dealers?error=missing");
  if (!(await managerPortal.managerOwnsDealer(s.username, username))) redirect("/manager/dealers?error=forbidden");
  const status = action === "activate" ? "A" : "S";
  const ok = await managerPortal.setDealerStatus(username, status);
  if (!ok) redirect("/manager/dealers?error=db");
  revalidatePath("/manager/dealers");
  redirect(`/manager/dealers?ok=status_${action}`);
}

const ACCOUNT_STATUS_ON_PORTAL = 0;
const ACCOUNT_STATUS_OFF_PORTAL = 1;

function validPortalHierarchyUsername(u: string) {
  return /^[a-zA-Z0-9]{3,50}$/.test(u);
}

/** PHP `reseller/Dealers::add` */
export async function createResellerDealerAction(formData: FormData) {
  const s = await requireResellerSession();
  const name = String(formData.get("name") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!name || !username || !password) redirect("/reseller/dealers/new?error=missing");
  if (!validPortalHierarchyUsername(username)) redirect("/reseller/dealers/new?error=username");
  if (password.length < 3 || password.length > 50) redirect("/reseller/dealers/new?error=password");
  if (await managerPortal.usernameExistsInUsers(username)) redirect("/reseller/dealers/new?error=taken");
  const ok = await repo.insertDealer({
    name,
    username,
    password,
    username_owner: s.username,
    tickets_enable: 0,
  });
  if (!ok) redirect("/reseller/dealers/new?error=db");
  revalidatePath("/reseller/dealers");
  redirect("/reseller/dealers?ok=created");
}

/** PHP `reseller/Dealers::edit` — owner stays this reseller. */
export async function saveResellerDealerAction(formData: FormData) {
  const s = await requireResellerSession();
  const username = String(formData.get("username") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const status = normUserStatus(String(formData.get("status") ?? "A"));
  const comments = String(formData.get("comments") ?? "");
  const ticketsRaw = String(formData.get("tickets_manager") ?? "No");
  const tickets = ticketsRaw === "Yes" || ticketsRaw === "1" ? 1 : 0;
  if (!username || !password) redirect(`/reseller/dealers/${encodeURIComponent(username)}?error=missing`);
  if (!(await resellerPortal.resellerOwnsDealer(s.username, username))) redirect("/reseller/dealers?error=forbidden");
  const existing = await repo.getDealerByUsername(username);
  if (!existing) redirect("/reseller/dealers?error=forbidden");
  await repo.updateDealer({
    username,
    name,
    password,
    status,
    username_owner: s.username,
    tickets_enable: tickets,
    comments,
  });
  revalidatePath("/reseller/dealers");
  redirect(`/reseller/dealers/${encodeURIComponent(username)}?ok=1`);
}

export async function deleteResellerDealerAction(formData: FormData) {
  const s = await requireResellerSession();
  const username = String(formData.get("username") ?? "").trim();
  const fromList = String(formData.get("_from") ?? "").trim() === "list";
  if (!username) redirect("/reseller/dealers?error=missing");
  const ok = await resellerPortal.deleteDealerOwnedByReseller(s.username, username);
  if (!ok) {
    if (fromList) redirect("/reseller/dealers?error=delete");
    redirect(`/reseller/dealers/${encodeURIComponent(username)}?error=delete`);
  }
  revalidatePath("/reseller/dealers");
  redirect("/reseller/dealers?ok=deleted");
}

/** PHP `reseller/Dealers::transactions` — uses `adjustHierarchyCredits` for reseller → dealer (RSLR) legs. */
export async function applyResellerDealerCreditsAction(formData: FormData) {
  const s = await requireResellerSession();
  const username = String(formData.get("username") ?? "").trim();
  const op = parseCreditOperation(String(formData.get("type") ?? "ADD"));
  const credits = Number.parseInt(String(formData.get("credits") ?? "").trim(), 10);
  if (!username || !op || !Number.isFinite(credits)) {
    redirect(`/reseller/dealers/${encodeURIComponent(username)}?error=credits_invalid`);
  }
  if (!(await resellerPortal.resellerOwnsDealer(s.username, username))) redirect("/reseller/dealers?error=forbidden");
  const r = await repo.adjustHierarchyCredits({
    targetUsername: username,
    targetType: "RSLR",
    operation: op,
    credits,
    operatorUsername: s.username,
    portal: "reseller_dealer",
  });
  if (!r.ok) {
    if (r.code === "insufficient_credits") {
      redirect(
        `/reseller/dealers/${encodeURIComponent(username)}?error=credits_balance&bal=${encodeURIComponent(String(r.balance ?? 0))}&req=${encodeURIComponent(String(r.required ?? credits))}`,
      );
    }
    const q = r.code === "invalid" ? "credits_invalid" : "credits_db";
    redirect(`/reseller/dealers/${encodeURIComponent(username)}?error=${q}`);
  }
  revalidatePath(`/reseller/dealers/${encodeURIComponent(username)}`);
  revalidatePath("/reseller/dealers");
  redirect(`/reseller/dealers/${encodeURIComponent(username)}?ok=credits_${op === "ADD" ? "added" : "recovered"}`);
}

/** PHP `reseller/Dealers_users::activate` / `::block` */
export async function setResellerDealerEndUserStatusAction(formData: FormData) {
  const s = await requireResellerSession();
  const dealer = String(formData.get("dealer_username") ?? "").trim();
  const account = String(formData.get("account") ?? "").trim();
  const mode = String(formData.get("mode") ?? "").trim();
  const base = `/reseller/dealers/${encodeURIComponent(dealer)}/users`;
  if (!dealer || !account || (mode !== "activate" && mode !== "block")) redirect(`${base}?error=missing`);
  if (!(await resellerPortal.resellerOwnsDealer(s.username, dealer))) redirect(`${base}?error=forbidden`);
  const allowed = await repo.canAccessAccountByRole({ ownerType: "SRSLR", ownerUsername: s.username, account });
  if (!allowed) redirect(`${base}?error=forbidden`);
  const row = await repo.getUserForEditScoped({ ownerType: "SRSLR", ownerUsername: s.username, account });
  if (!row) redirect(`${base}?error=forbidden`);
  const newStatus = mode === "activate" ? ACCOUNT_STATUS_ON_PORTAL : ACCOUNT_STATUS_OFF_PORTAL;
  if (mode === "activate" && row.statusCode === ACCOUNT_STATUS_ON_PORTAL) redirect(`${base}?error=already_on`);
  if (mode === "block" && row.statusCode === ACCOUNT_STATUS_OFF_PORTAL) redirect(`${base}?error=already_off`);
  const ok = await repo.updateAccountWithStalkerSync({
    account: row.id,
    full_name: row.name,
    mac: row.mac,
    phone: row.phone,
    note: row.comments,
    status: newStatus,
    password: row.password,
    owner_username: row.username,
    tariff_plan_id: row.tariffPlanId,
    parent_password: row.parentPin,
  });
  if (!ok) redirect(`${base}?error=save`);
  revalidatePath(base);
  revalidatePath("/reseller/dealers");
  redirect(`${base}?ok=status_${mode}`);
}

/** PHP `reseller/Dealers_users::delete` — expired end users only. */
export async function deleteResellerDealerExpiredUserAction(formData: FormData) {
  const s = await requireResellerSession();
  const dealer = String(formData.get("dealer_username") ?? "").trim();
  const account = String(formData.get("account") ?? "").trim();
  const base = `/reseller/dealers/${encodeURIComponent(dealer)}/users`;
  if (!dealer || !account) redirect(`${base}?error=missing`);
  if (!(await resellerPortal.resellerOwnsDealer(s.username, dealer))) redirect(`${base}?error=forbidden`);
  const allowed = await repo.canAccessAccountByRole({ ownerType: "SRSLR", ownerUsername: s.username, account });
  if (!allowed) redirect(`${base}?error=forbidden`);
  const r = await repo.deleteExpiredEndUserAccount(account);
  if (!r.ok) {
    const q =
      r.code === "not_expired"
        ? "not_expired"
        : r.code === "no_stalker_user"
          ? "no_stalker"
          : r.code === "no_stalker"
            ? "no_stalker_cfg"
            : "db";
    redirect(`${base}?error=${q}`);
  }
  revalidatePath(base);
  redirect(`${base}?ok=deleted_user`);
}

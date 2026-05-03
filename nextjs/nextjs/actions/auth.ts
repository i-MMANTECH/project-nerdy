"use server";

import { redirect } from "next/navigation";
import { authenticateBillingLogin, touchUserLogin } from "@/lib/repos/billing";
import { createSession, clearSession } from "@/lib/session";

function formatLastLogin(v: string | null): string {
  if (!v || v === "0000-00-00 00:00:00") return "—";
  return String(v).replace("T", " ").slice(0, 19);
}

function defaultHomeForType(type: string): string | null {
  switch (type) {
    case "ROOT":
      return "/admin/dashboard";
    case "MNGR":
      return "/manager";
    case "SRSLR":
      return "/reseller";
    case "RSLR":
      return "/dealer";
    default:
      return null;
  }
}

/** Same-origin path only; must stay under the portal for that user type (no open redirects). */
function safeNextForType(type: string, raw: string | null | undefined): string | null {
  const next = String(raw ?? "").trim();
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("..")) return null;
  const prefixByType: Record<string, string> = {
    ROOT: "/admin",
    MNGR: "/manager",
    SRSLR: "/reseller",
    RSLR: "/dealer",
  };
  const prefix = prefixByType[type];
  if (!prefix) return null;
  if (next === prefix || next.startsWith(`${prefix}/`)) return next;
  return null;
}

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nextRaw = String(formData.get("next") ?? "").trim();

  if (!username || !password) {
    redirect("/login?error=missing");
  }

  let auth: Awaited<ReturnType<typeof authenticateBillingLogin>>;
  try {
    auth = await authenticateBillingLogin(username, password);
  } catch {
    redirect("/login?error=db");
  }
  if (!auth.ok) {
    redirect("/login?error=credentials");
  }

  const home = defaultHomeForType(auth.user.type);
  if (!home) {
    redirect("/login?error=forbidden");
  }

  await touchUserLogin(auth.user.id);

  await createSession({
    userid: auth.user.id,
    displayName: auth.user.name?.trim() || auth.user.username,
    username: auth.user.username,
    type: auth.user.type,
    owner: auth.user.username_owner ?? "",
    lastLogin: formatLastLogin(auth.previousLogin),
  });

  const sn = safeNextForType(auth.user.type, nextRaw || undefined);
  redirect(sn ?? home);
}

export async function logoutAction() {
  await clearSession();
  redirect("/login?logout=1");
}

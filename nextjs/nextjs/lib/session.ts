import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { BILLING_SESSION_COOKIE_NAME } from "@/lib/billingCookies";

const COOKIE = BILLING_SESSION_COOKIE_NAME;
const MAX_AGE = 60 * 60 * 24 * 7;

export type SessionPayload = {
  userid: number;
  displayName: string;
  username: string;
  type: string;
  owner: string;
  lastLogin: string;
};

/** Default landing path for a billing user type (same-origin). Used when redirecting away from the wrong portal. */
export function homePathForUserType(type: string): string | null {
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

function secret(): string {
  return process.env.BILLING_SESSION_SECRET || "dev-change-me";
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const token = `${body}.${sign(body)}`;
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function getSession(): Promise<SessionPayload | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = sign(body);
  try {
    if (sig.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (typeof parsed.userid !== "number" || typeof parsed.username !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

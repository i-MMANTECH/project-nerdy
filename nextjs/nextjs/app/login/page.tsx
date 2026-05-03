import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loginAction } from "@/actions/auth";
import { getSession } from "@/lib/session";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FlashToastsBoundary } from "@/components/FlashToasts";
import { LoginClient } from "@/components/auth/LoginClient";

export const metadata: Metadata = {
  title: "Sign in — IPTV Billing",
  description: "Sign in to the IPTV billing management system",
};

type Props = { searchParams?: Promise<{ error?: string; ok?: string; next?: string; logout?: string }> };

function homeForSessionType(type: string): string | null {
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

export default async function LoginPage({ searchParams }: Props) {
  const session = await getSession();
  if (session) {
    const h = homeForSessionType(session.type);
    redirect(h ?? "/login?error=forbidden");
  }

  const sp = (await searchParams) ?? {};
  const err =
    sp.error === "missing"
      ? "Enter username and password."
      : sp.error === "credentials"
        ? "Invalid credentials: no matching active user in the billing users table, or password does not match (not your DATABASE_USER from .env)."
        : sp.error === "db"
          ? "Database error: check DATABASE_* in .env.local and that MySQL is reachable."
          : sp.error === "forbidden"
            ? "That account is not allowed here, or your session does not match this portal."
            : null;
  const ok =
    sp.ok === "password"
      ? "Password changed. Sign in again."
      : sp.logout === "1"
        ? "You have been signed out."
        : null;

  const nextPath = sp.next?.trim() || undefined;
  const isDevelopment = process.env.NODE_ENV === "development";
  const appVersion = process.env.npm_package_version?.trim() || "0.1.0";

  const loginFlashes = [
    ...(err ? [{ type: "error" as const, message: err }] : []),
    ...(ok ? [{ type: "success" as const, message: ok }] : []),
  ];

  return (
    <main className="relative flex min-h-dvh flex-1 flex-col">
      {loginFlashes.length ? <FlashToastsBoundary items={loginFlashes} stripParams={["error", "ok", "logout"]} /> : null}
      <div className="fixed right-4 top-4 z-50 sm:right-6 sm:top-6">
        <ThemeToggle variant="fab" />
      </div>
      <LoginClient loginAction={loginAction} nextPath={nextPath} isDevelopment={isDevelopment} appVersion={appVersion} />
    </main>
  );
}

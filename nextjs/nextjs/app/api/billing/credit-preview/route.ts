import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import * as repo from "@/lib/repos/billing";
import * as managerPortal from "@/lib/repos/managerPortal";
import * as resellerPortal from "@/lib/repos/resellerPortal";

type BillingRole = "MNGR" | "SRSLR" | "RSLR";

async function assertRecoverPreviewAllowed(
  session: { type: string; username: string },
  targetUsername: string,
  role: BillingRole,
): Promise<boolean> {
  if (session.type === "ROOT") return true;
  if (session.type === "MNGR") {
    if (role === "MNGR" && targetUsername === session.username) return true;
    if (role === "SRSLR") return managerPortal.managerOwnsReseller(session.username, targetUsername);
    if (role === "RSLR") return managerPortal.managerOwnsDealer(session.username, targetUsername);
    return false;
  }
  if (session.type === "SRSLR") {
    if (role === "SRSLR" && targetUsername === session.username) return true;
    if (role === "RSLR") return resellerPortal.resellerOwnsDealer(session.username, targetUsername);
    return false;
  }
  if (session.type === "RSLR") {
    return role === "RSLR" && targetUsername === session.username;
  }
  return false;
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const mode = (url.searchParams.get("mode") ?? "").toLowerCase();
  if (mode !== "recover") {
    return NextResponse.json({ error: "invalid_mode" }, { status: 400 });
  }

  const targetUsername = (url.searchParams.get("username") ?? "").trim();
  const principal = Math.floor(Number(url.searchParams.get("principal") ?? ""));
  const roleRaw = (url.searchParams.get("role") ?? "").toUpperCase();
  const role = roleRaw === "MNGR" || roleRaw === "SRSLR" || roleRaw === "RSLR" ? (roleRaw as BillingRole) : null;

  if (!targetUsername || principal < 1 || !role) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const allowed = await assertRecoverPreviewAllowed(session, targetUsername, role);
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const preview = await repo.previewHierarchyRecoverDebit({ creditUsername: targetUsername, principal });
  return NextResponse.json(preview);
}

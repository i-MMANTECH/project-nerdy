import { NextResponse } from "next/server";
import { getDealers, getResellers } from "@/lib/data";
import { getSession } from "@/lib/session";

type BranchRow = {
  type: "RESELLER" | "DEALER";
  username: string;
  name: string;
  parent: string;
  status: string;
  stateCurrentLogin: string;
  stateLastLogin: string;
  branchCount: number;
  activeUsers: number;
  expiredUsers: number;
  totalUsers: number;
  credits: number;
};

function normalizeStatus(v: string) {
  const s = String(v ?? "").toUpperCase();
  return s === "A" || s === "ACTIVE" ? "Active" : "Inactive";
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session || session.type !== "ROOT") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const rowType = (url.searchParams.get("rowType") ?? "").toUpperCase();
  const username = (url.searchParams.get("username") ?? "").trim();
  if (!username || (rowType !== "MANAGER" && rowType !== "RESELLER")) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  let rows: BranchRow[] = [];
  if (rowType === "MANAGER") {
    const resellers = await getResellers();
    rows = resellers
      .filter((r) => (r.manager ?? "").trim().toLowerCase() === username.toLowerCase())
      .map((r) => ({
        type: "RESELLER",
        username: r.username,
        name: r.name ?? "",
        parent: r.manager ?? "—",
        status: normalizeStatus(r.status),
        stateCurrentLogin: r.currentLoginTime ?? "",
        stateLastLogin: r.lastLoginTime ?? "",
        branchCount: Number(r.dealerCount ?? 0),
        activeUsers: Number(r.activeUserCount ?? 0),
        expiredUsers: Number(r.expiredUserCount ?? 0),
        totalUsers: Number(r.userCount ?? 0),
        credits: Number(r.credits ?? 0),
      }));
  } else {
    const dealers = await getDealers();
    rows = dealers
      .filter((d) => (d.reseller ?? "").trim().toLowerCase() === username.toLowerCase())
      .map((d) => ({
        type: "DEALER",
        username: d.username,
        name: d.name ?? "",
        parent: d.reseller ?? "—",
        status: normalizeStatus(d.status),
        stateCurrentLogin: d.currentLoginTime ?? "",
        stateLastLogin: d.lastLoginTime ?? "",
        branchCount: 0,
        activeUsers: Number(d.activeUserCount ?? 0),
        expiredUsers: Number(d.expiredUserCount ?? 0),
        totalUsers: Number(d.userCount ?? 0),
        credits: Number(d.credits ?? 0),
      }));
  }

  return NextResponse.json({
    title: rowType === "MANAGER" ? "Resellers" : "Dealers",
    subtitle: username,
    rows,
  });
}

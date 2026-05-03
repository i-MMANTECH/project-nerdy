import { NextResponse } from "next/server";
import { listAccountsPaged } from "@/lib/repos/billing";
import { getSession } from "@/lib/session";

export async function GET(req: Request, ctx: { params: Promise<{ username: string }> }) {
  try {
    const s = await getSession();
    if (!s || s.type !== "ROOT") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { username: rawParam } = await ctx.params;
    const dealerLogin = decodeURIComponent(rawParam ?? "").trim();
    if (!dealerLogin) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }

    const u = new URL(req.url);
    const page = Math.max(1, Number.parseInt(u.searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(5, Number.parseInt(u.searchParams.get("pageSize") ?? "25", 10) || 25));
    const query = u.searchParams.get("query")?.trim() || undefined;
    const statusRaw = u.searchParams.get("status")?.toLowerCase() ?? "";
    const status =
      statusRaw === "active" || statusRaw === "expired" || statusRaw === "inactive" || statusRaw === "expiring"
        ? statusRaw
        : undefined;

    const { rows, total } = await listAccountsPaged({
      dealerLogin,
      status,
      search: query,
      page,
      pageSize,
      sort: "account",
      dir: "asc",
    });

    const rowsOut = rows.map((r) => ({
      account: r.account,
      username: r.username,
      full_name: r.full_name,
      password: r.password,
      manager: r.manager,
      packageName: r.packageName,
      mac: r.mac,
      ip: r.ip,
      autoRenew: r.autoRenew,
      expires: r.expires,
      status: r.status,
      reseller: r.reseller,
      dealer: r.dealer,
      receiverOnline: r.receiverOnline,
      lastActive: r.lastActive,
    }));

    return NextResponse.json({ rows: rowsOut, total, page, pageSize, dealerLogin });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

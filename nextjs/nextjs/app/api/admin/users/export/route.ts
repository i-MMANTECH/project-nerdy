import { NextResponse } from "next/server";
import { isBillingAccountExpired } from "@/lib/billingAccountExpiry";
import { listAccountsPaged } from "@/lib/repos/billing";
import type { AccountListRow } from "@/lib/repos/billing";
import { getSession } from "@/lib/session";

const ACCOUNT_OFF = 1;

function csvCell(v: string | number | boolean | null | undefined) {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowStatusLabel(r: AccountListRow): string {
  if (r.status === ACCOUNT_OFF) return "Inactive";
  if (isBillingAccountExpired(r.expires)) return "Expired";
  if (r.expires) {
    const exp = new Date(String(r.expires).replace(" ", "T"));
    if (!Number.isNaN(exp.getTime()) && exp.getTime() > Date.now() && exp.getTime() - Date.now() <= 7 * 24 * 60 * 60 * 1000) {
      return "Expiring soon";
    }
  }
  return "Active";
}

function rowOnlineLabel(r: AccountListRow): string {
  if (r.receiverOnline === true) return "Online";
  if (r.receiverOnline === false) return "Offline";
  return "";
}

function rowOwner(r: AccountListRow) {
  return r.dealer?.trim() || r.reseller?.trim() || r.manager?.trim() || "";
}

export async function GET(req: Request) {
  const s = await getSession();
  if (!s || s.type !== "ROOT") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const u = new URL(req.url);
  const raw = u.searchParams.get("status")?.toLowerCase() ?? "";
  const status =
    raw === "active" ||
    raw === "expired" ||
    raw === "inactive" ||
    raw === "expiring" ||
    raw === "expiry" ||
    raw === "activity"
      ? raw
      : undefined;
  const query = u.searchParams.get("query")?.trim() || undefined;
  const managerLogin = u.searchParams.get("manager")?.trim() || undefined;
  const resellerLogin = u.searchParams.get("reseller")?.trim() || undefined;
  const dealerLogin = u.searchParams.get("dealer")?.trim() || undefined;

  const collected: AccountListRow[] = [];
  let page = 1;
  const pageSize = 500;
  for (;;) {
    const chunk = await listAccountsPaged({
      status,
      search: query,
      managerLogin,
      resellerLogin,
      dealerLogin,
      page,
      pageSize,
      sort: "account",
      dir: "asc",
    });
    collected.push(...chunk.rows);
    if (chunk.rows.length < pageSize || collected.length >= chunk.total) break;
    page += 1;
    if (page > 400) break;
  }

  const header = ["Account", "Subscriber", "Owner", "Package", "MAC", "Status", "Expiry", "Device online"];
  const lines = [
    header.map(csvCell).join(","),
    ...collected.map((r) =>
      [
        csvCell(r.account),
        csvCell(r.full_name ?? ""),
        csvCell(rowOwner(r)),
        csvCell(r.packageName ?? ""),
        csvCell(r.mac ?? ""),
        csvCell(rowStatusLabel(r)),
        csvCell(r.expires ? String(r.expires).slice(0, 10) : ""),
        csvCell(rowOnlineLabel(r)),
      ].join(","),
    ),
  ];
  const body = lines.join("\r\n");
  const filename = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

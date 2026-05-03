import { NextResponse } from "next/server";
import { loadAdminReportsPayload, parseAdminReportRange } from "@/lib/repos/adminReports";
import { getSession } from "@/lib/session";

function cell(v: string | number | null | undefined) {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  const s = await getSession();
  if (!s || s.type !== "ROOT") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const u = new URL(req.url);
  const range = parseAdminReportRange(u.searchParams.get("range"));
  let data;
  try {
    data = await loadAdminReportsPayload(range);
  } catch {
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }

  const lines: string[] = [];
  lines.push(["section", "metric", "value", "previous", "pct_vs_prior"].join(","));
  const k = data.kpis;
  lines.push(["kpi", "revenue_usd", k.revenueUsd.value, k.revenueUsd.previous, k.revenueUsd.pctVsPrevious ?? ""].map(cell).join(","));
  lines.push(["kpi", "new_subscribers", k.newSubscribers.value, k.newSubscribers.previous, k.newSubscribers.pctVsPrevious ?? ""].map(cell).join(","));
  lines.push(["kpi", "churn_pct", k.churnRatePct.value, k.churnRatePct.previous, k.churnRatePct.pctVsPrevious ?? ""].map(cell).join(","));
  lines.push(["kpi", "arpu_usd", k.arpuUsd.value, k.arpuUsd.previous, k.arpuUsd.pctVsPrevious ?? ""].map(cell).join(","));
  lines.push(["kpi", "active_users", k.activeUsers, "", ""].map(cell).join(","));
  lines.push("");
  lines.push(["dealer_rank", "dealer", "subscribers", "revenue", "growth_pct"].join(","));
  for (const r of data.topDealers) {
    lines.push([r.rank, r.dealer, r.subscribers, r.revenue, r.growthPct ?? ""].map(cell).join(","));
  }
  lines.push("");
  lines.push(["expiring_period", "count", "potential_usd"].join(","));
  for (const r of data.expiring) {
    lines.push([r.label, r.count, r.potentialUsd].map(cell).join(","));
  }
  lines.push("");
  lines.push(["day", "new_subscribers", "revenue_usd"].join(","));
  for (const g of data.growth) {
    lines.push([g.key, g.newAccounts, g.revenue].map(cell).join(","));
  }
  lines.push("");
  lines.push(["package", "users"].join(","));
  for (const p of data.packages) {
    lines.push([p.name, p.count].map(cell).join(","));
  }

  const body = lines.join("\n");
  const filename = `billing-reports-${range}d-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

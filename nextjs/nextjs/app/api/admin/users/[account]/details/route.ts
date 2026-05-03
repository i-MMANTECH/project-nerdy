import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUserById } from "@/lib/data";
import { secureJson } from "@/lib/api/respond";

type Params = { params: Promise<{ account: string }> };

function txSummary(transactions: Array<{ type: string; periods: number; timestamp: string | null }>) {
  const creditRows = transactions.filter((t) => String(t.type).toUpperCase() === "CRDT");
  const debitRows = transactions.filter((t) => String(t.type).toUpperCase() === "DBIT");
  return {
    total: transactions.length,
    creditCount: creditRows.length,
    debitCount: debitRows.length,
    netPeriods: transactions.reduce((acc, t) => acc + (Number(t.periods) || 0), 0),
    creditPeriods: creditRows.reduce((acc, t) => acc + Math.abs(Number(t.periods) || 0), 0),
    debitPeriods: debitRows.reduce((acc, t) => acc + Math.abs(Number(t.periods) || 0), 0),
    lastTransactionAt: transactions[0]?.timestamp ?? null,
  };
}

export async function GET(request: Request, { params }: Params) {
  const s = await getSession();
  if (!s || s.type !== "ROOT") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { account } = await params;
  const decoded = decodeURIComponent(account ?? "").trim();
  if (!decoded) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const u = await getUserById(decoded);
  if (!u) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return secureJson(
    {
      ok: true,
      user: {
        id: u.id,
        name: u.name,
        username: u.username,
        password: u.password,
        mac: u.mac,
        phone: u.phone,
        status: u.status,
        statusCode: u.statusCode,
        reseller: u.reseller,
        dealer: u.dealer,
        tariffPlanId: u.tariffPlanId,
        subscribedPackageIds: u.subscribedPackageIds ?? [],
        parentPin: u.parentPin,
        packageLabel: u.packageLabel,
        stalkerUserId: u.stalkerUserId,
        comments: u.comments,
        stb: u.stb,
        transactionSummary: txSummary(u.transactions ?? []),
        recentTransactions: (u.transactions ?? []).slice(0, 5).map((t) => ({
          type: t.type,
          periods: t.periods,
          timestamp: t.timestamp,
        })),
      },
    },
    request,
  );
}

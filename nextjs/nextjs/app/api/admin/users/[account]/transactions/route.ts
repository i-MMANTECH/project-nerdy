import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getTransactionsForAccount } from "@/lib/repos/billing";

type Params = { params: Promise<{ account: string }> };

export async function GET(_: Request, { params }: Params) {
  const s = await getSession();
  if (!s || s.type !== "ROOT") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { account } = await params;
  const decoded = decodeURIComponent(account ?? "").trim();
  if (!decoded) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const rows = await getTransactionsForAccount(decoded);
  return NextResponse.json({ ok: true, rows });
}

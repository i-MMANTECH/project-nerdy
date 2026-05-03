import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { findItvByChannelNumber } from "@/lib/repos/tickets";

function canReadTicketChannels(s: NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  return s.type === "ROOT" || s.type === "MNGR" || s.type === "RSLR";
}

export async function GET(req: Request) {
  const s = await getSession();
  if (!s || !canReadTicketChannels(s)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const n = Number(new URL(req.url).searchParams.get("number"));
  if (!Number.isFinite(n) || n <= 0) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const row = await findItvByChannelNumber(n);
  if (!row) return NextResponse.json([]);
  return NextResponse.json([row]);
}

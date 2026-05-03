import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { RowDataPacket } from "mysql2/promise";
import { getSession } from "@/lib/session";
import { getBillingPool } from "@/lib/db/pool";
import { getUserForEdit, updateAccountWithStalkerSync } from "@/lib/repos/billing";

type EditableField = "user" | "password" | "mac" | "status";

function isField(v: string): v is EditableField {
  return v === "user" || v === "password" || v === "mac" || v === "status";
}

function toCanonicalMac(raw: string): string | null {
  const hexOnly = raw.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  if (hexOnly.length !== 12) return null;
  const parts = hexOnly.match(/.{1,2}/g);
  if (!parts || parts.length !== 6) return null;
  return parts.join(":");
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s || s.type !== "ROOT") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { account?: string; field?: string; value?: string } | null;
  if (!body) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const account = String(body.account ?? "").trim();
  const field = String(body.field ?? "");
  const value = String(body.value ?? "").trim();
  if (!account || !isField(field) || !value) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (field === "status" && value !== "0" && value !== "1") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const macValue = field === "mac" ? toCanonicalMac(value) : null;
  if (field === "mac" && !macValue) {
    return NextResponse.json({ error: "invalid_mac" }, { status: 400 });
  }

  const cur = await getUserForEdit(account);
  if (!cur) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (field === "mac" && macValue) {
    const pool = getBillingPool();
    const [dupRows] = await pool.execute<RowDataPacket[]>(
      `SELECT account
       FROM accounts
       WHERE UPPER(REPLACE(TRIM(COALESCE(mac, '')), '-', ':')) = :m
         AND account <> :a
       LIMIT 1`,
      { m: macValue, a: account },
    );
    if (dupRows.length) {
      return NextResponse.json({ error: "duplicate_mac" }, { status: 409 });
    }
  }

  const status = field === "status" ? Number(value) : cur.statusCode;
  const ok = await updateAccountWithStalkerSync({
    account,
    full_name: field === "user" ? value : cur.name,
    password: field === "password" ? value : cur.password,
    mac: field === "mac" ? (macValue as string) : cur.mac,
    phone: cur.phone,
    note: cur.comments,
    status,
  });

  if (!ok) return NextResponse.json({ error: "update_failed" }, { status: 500 });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${encodeURIComponent(account)}`);
  return NextResponse.json({ ok: true });
}

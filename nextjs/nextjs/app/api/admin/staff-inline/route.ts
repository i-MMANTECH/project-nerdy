import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { getDealerByUsername, getManagerByUsername, getResellerByUsername, updateDealer, updateManager, updateReseller } from "@/lib/repos/billing";

type StaffType = "MANAGER" | "RESELLER" | "DEALER";
type EditableField = "name" | "password" | "status";

function isStaffType(v: string): v is StaffType {
  return v === "MANAGER" || v === "RESELLER" || v === "DEALER";
}

function isField(v: string): v is EditableField {
  return v === "name" || v === "password" || v === "status";
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s || s.type !== "ROOT") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as
    | { rowType?: string; username?: string; field?: string; value?: string }
    | null;
  if (!body) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const rowType = String(body.rowType ?? "");
  const username = String(body.username ?? "").trim();
  const field = String(body.field ?? "");
  const value = String(body.value ?? "").trim();
  if (!isStaffType(rowType) || !isField(field) || !username || !value) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (field === "status" && value !== "A" && value !== "S") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  if (rowType === "MANAGER") {
    const cur = await getManagerByUsername(username);
    if (!cur) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await updateManager({
      username,
      name: field === "name" ? value : cur.name,
      password: field === "password" ? value : cur.password,
      status: field === "status" ? value : cur.status,
      comments: cur.comments ?? "",
    });
  } else if (rowType === "RESELLER") {
    const cur = await getResellerByUsername(username);
    if (!cur) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await updateReseller({
      username,
      name: field === "name" ? value : cur.name,
      password: field === "password" ? value : cur.password,
      status: field === "status" ? value : cur.status,
      manager: cur.manager,
      comments: cur.comments ?? "",
    });
  } else {
    const cur = await getDealerByUsername(username);
    if (!cur) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await updateDealer({
      username,
      name: field === "name" ? value : cur.name,
      password: field === "password" ? value : cur.passwordPlaceholder,
      status: field === "status" ? value : cur.status,
      username_owner: cur.reseller,
      tickets_enable: cur.tickets_enable,
      comments: cur.comments ?? "",
    });
  }

  revalidatePath("/admin/managers");
  return NextResponse.json({ ok: true });
}

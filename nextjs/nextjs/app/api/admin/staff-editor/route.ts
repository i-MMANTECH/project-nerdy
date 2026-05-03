import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getDealerById, getManagerById, getResellerById, getSettings, listManagersForSelect, listResellersForSelect } from "@/lib/data";
import { HIERARCHY_ADD_CREDITS_MAX } from "@/lib/constants/hierarchyCredits";
import * as repo from "@/lib/repos/billing";
import { getSession } from "@/lib/session";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session || session.type !== "ROOT") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const type = (url.searchParams.get("type") ?? "").toUpperCase();
  const username = (url.searchParams.get("username") ?? "").trim();
  if (!username || (type !== "MANAGER" && type !== "RESELLER" && type !== "DEALER")) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const settings = await getSettings().catch(() => null);
  const hierarchyAddMaxRaw = settings?.hierarchyAddCreditMax ?? String(HIERARCHY_ADD_CREDITS_MAX);
  const hierarchyAddMax = Math.min(
    HIERARCHY_ADD_CREDITS_MAX,
    Math.max(1, Number.parseInt(String(hierarchyAddMaxRaw).trim(), 10) || HIERARCHY_ADD_CREDITS_MAX),
  );
  const managerAddMin = settings ? repo.hierarchyAddCreditsMin("admin_manager", settings) : 1;
  const resellerAddMin = settings ? repo.hierarchyAddCreditsMin("admin_reseller", settings) : 1;
  const dealerAddMin = settings ? repo.hierarchyAddCreditsMin("admin_dealer", settings) : 1;

  if (type === "MANAGER") {
    const row = await getManagerById(username);
    if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const promo = await promoPreviewPayload("MANAGER", row.username);
    return NextResponse.json({
      type,
      username: row.username,
      name: row.name ?? "",
      password: row.password ?? "",
      status: row.status ?? "A",
      comments: row.comments ?? "",
      credits: Number(row.credits ?? 0),
      hierarchyAddMax,
      hierarchyAddMin: managerAddMin,
      ...promo,
    });
  }

  if (type === "RESELLER") {
    const row = await getResellerById(username);
    if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const managers = await listManagersForSelect();
    const promo = await promoPreviewPayload("RESELLER", row.username);
    return NextResponse.json({
      type,
      username: row.username,
      name: row.name ?? "",
      password: row.password ?? "",
      status: row.status ?? "ACTIVE",
      comments: row.comments ?? "",
      credits: Number(row.credits ?? 0),
      hierarchyAddMax,
      hierarchyAddMin: resellerAddMin,
      manager: row.manager ?? "",
      managerOptions: managers.map((m) => ({ value: m.username, label: `${m.name} (${m.username})` })),
      ...promo,
    });
  }

  const row = await getDealerById(username);
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const resellers = await listResellersForSelect();
  const promo = await promoPreviewPayload("DEALER", row.username);
  return NextResponse.json({
    type,
    username: row.username,
    name: row.name ?? "",
    password: row.passwordPlaceholder ?? "",
    status: row.status ?? "ACTIVE",
    comments: row.comments ?? "",
    credits: Number(row.credits ?? 0),
    hierarchyAddMax,
    hierarchyAddMin: dealerAddMin,
    username_owner: row.reseller ?? "",
    tickets_manager: row.ticketsManager === "Yes" ? "Yes" : "No",
    resellerOptions: resellers.map((r) => ({ value: r.username, label: `${r.name} (${r.username})` })),
    ...promo,
  });
}

async function promoPreviewPayload(type: "MANAGER" | "RESELLER" | "DEALER", username: string) {
  const rules = await repo.getPromoBonusRules();
  const kind = type === "MANAGER" ? "MNGR" : type === "RESELLER" ? "SRSLR" : "RSLR";
  const activeClientsForPromo2 = await repo.countActiveClientsForPromo2({ kind, username });
  return { promoP1: rules.p1, promoP2: rules.p2, activeClientsForPromo2 };
}

function normUserStatus(v: string) {
  const u = v.toUpperCase();
  if (u === "S" || u === "INACTIVE") return "S";
  return "A";
}

function parseCreditOperation(raw: string): "ADD" | "RECOVER" | null {
  const v = raw.trim().toUpperCase();
  if (v === "ADD" || v === "CRDT") return "ADD";
  if (v === "RECOVER" || v === "DBIT") return "RECOVER";
  return null;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.type !== "ROOT") {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        mode?: "profile" | "credits";
        type?: "MANAGER" | "RESELLER" | "DEALER";
        username?: string;
        name?: string;
        password?: string;
        status?: string;
        comments?: string;
        manager?: string;
        username_owner?: string;
        tickets_manager?: string;
        operation?: string;
        credits?: number;
      }
    | null;

  if (!body?.mode || !body?.type || !body?.username) {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  const type = body.type;
  const username = String(body.username).trim();

  if (body.mode === "profile") {
    const name = String(body.name ?? "").trim();
    const password = String(body.password ?? "");
    const status = normUserStatus(String(body.status ?? "A"));
    const comments = String(body.comments ?? "");
    if (!username || !password) {
      return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
    }

    if (type === "MANAGER") {
      await repo.updateManager({ username, name, password, status, comments });
      revalidatePath("/admin/managers");
      revalidatePath(`/admin/managers/${encodeURIComponent(username)}`);
      return NextResponse.json({ ok: true });
    }

    if (type === "RESELLER") {
      const manager = String(body.manager ?? "").trim();
      if (!manager) return NextResponse.json({ ok: false, error: "missing_manager" }, { status: 400 });
      await repo.updateReseller({ username, name, password, status, manager, comments });
      revalidatePath("/admin/resellers");
      revalidatePath("/admin/managers");
      revalidatePath(`/admin/resellers/${encodeURIComponent(username)}`);
      return NextResponse.json({ ok: true });
    }

    const username_owner = String(body.username_owner ?? "").trim();
    if (!username_owner) return NextResponse.json({ ok: false, error: "missing_owner" }, { status: 400 });
    const tickets_enable = String(body.tickets_manager ?? "No") === "Yes" ? 1 : 0;
    await repo.updateDealer({
      username,
      name,
      password,
      status,
      username_owner,
      tickets_enable,
      comments,
    });
    revalidatePath("/admin/dealers");
    revalidatePath("/admin/managers");
    revalidatePath(`/admin/dealers/${encodeURIComponent(username)}`);
    return NextResponse.json({ ok: true });
  }

  if (body.mode === "credits") {
    const op = parseCreditOperation(String(body.operation ?? ""));
    const credits = Number.parseInt(String(body.credits ?? ""), 10);
    if (!op || !Number.isFinite(credits) || credits < 1) {
      return NextResponse.json({ ok: false, error: "invalid_credits" }, { status: 400 });
    }

    if (type === "MANAGER") {
      const r = await repo.adjustManagerCredits({
        adminUsername: session.username,
        managerUsername: username,
        operation: op,
        credits,
        operatorUsername: session.username,
      });
      if (!r.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: r.code ?? "credits_error",
            ...(typeof r.balance === "number" ? { balance: r.balance } : {}),
            ...(typeof r.required === "number" ? { required: r.required } : {}),
          },
          { status: 400 },
        );
      }
      revalidatePath("/admin/managers");
      revalidatePath(`/admin/managers/${encodeURIComponent(username)}`);
      return NextResponse.json({ ok: true });
    }

    const r = await repo.adjustHierarchyCredits({
      targetUsername: username,
      targetType: type === "RESELLER" ? "SRSLR" : "RSLR",
      operation: op,
      credits,
      operatorUsername: session.username,
      portal: type === "RESELLER" ? "admin_reseller" : "admin_dealer",
    });
    if (!r.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: r.code ?? "credits_error",
          ...(typeof r.balance === "number" ? { balance: r.balance } : {}),
          ...(typeof r.required === "number" ? { required: r.required } : {}),
        },
        { status: 400 },
      );
    }
    revalidatePath("/admin/managers");
    revalidatePath(type === "RESELLER" ? "/admin/resellers" : "/admin/dealers");
    revalidatePath(type === "RESELLER" ? `/admin/resellers/${encodeURIComponent(username)}` : `/admin/dealers/${encodeURIComponent(username)}`);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "invalid_mode" }, { status: 400 });
}

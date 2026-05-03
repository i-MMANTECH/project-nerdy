import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import {
  assertPortalTicketAccess,
  deleteTicketById,
  getPortalTicketScope,
  type PortalTicketRole,
  updateTicketPriorityAndStatus,
} from "@/lib/repos/tickets";

type Params = { id: string };
type Ctx = { params: Promise<Params> | Params };

async function resolveAccess(ticketId: number) {
  const session = await getSession();
  if (!session) return { ok: false as const, status: 401, error: "forbidden" };
  if (session.type === "ROOT") return { ok: true as const, agentUserId: 0 };

  const role: PortalTicketRole | null = session.type === "MNGR" ? "MNGR" : session.type === "RSLR" ? "RSLR" : null;
  if (!role) return { ok: false as const, status: 403, error: "forbidden" };
  const allowed = await assertPortalTicketAccess(session.username, role, ticketId);
  if (!allowed) return { ok: false as const, status: 403, error: "forbidden" };
  const scope = await getPortalTicketScope(session.username, role);
  if (!scope) return { ok: false as const, status: 403, error: "forbidden" };
  return { ok: true as const, agentUserId: scope.billingUserId };
}

export async function POST(req: Request, ctx: Ctx) {
  const rawParams = await Promise.resolve(ctx.params);
  const ticketId = Number(rawParams.id);
  if (!Number.isFinite(ticketId) || ticketId <= 0) {
    return NextResponse.json({ error: "bad_ticket_id" }, { status: 400 });
  }
  const access = await resolveAccess(ticketId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = (await req.json().catch(() => null)) as
    | { action?: "delete" | "update"; status?: number; priority?: number }
    | null;
  const action = body?.action;

  if (action === "delete") {
    const ok = await deleteTicketById(ticketId);
    if (!ok) return NextResponse.json({ error: "delete_failed" }, { status: 400 });
  } else if (action === "update") {
    const status = Number(body?.status);
    const priority = Number(body?.priority);
    if (!Number.isFinite(status) || status < 1 || status > 3) {
      return NextResponse.json({ error: "bad_status" }, { status: 400 });
    }
    if (!Number.isFinite(priority) || priority < 1 || priority > 3) {
      return NextResponse.json({ error: "bad_priority" }, { status: 400 });
    }
    const ok = await updateTicketPriorityAndStatus(ticketId, priority, status, access.agentUserId);
    if (!ok) return NextResponse.json({ error: "update_failed" }, { status: 400 });
  } else {
    return NextResponse.json({ error: "bad_action" }, { status: 400 });
  }

  revalidatePath("/admin/tickets");
  revalidatePath("/admin/tickets/dashboard");
  revalidatePath("/manager/tickets");
  revalidatePath("/manager/tickets/dashboard");
  revalidatePath("/dealer/tickets");
  revalidatePath("/dealer/tickets/dashboard");

  return NextResponse.json({ ok: true });
}


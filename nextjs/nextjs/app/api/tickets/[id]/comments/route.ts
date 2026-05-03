import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  assertPortalTicketAccess,
  getPortalTicketScope,
  getTicketOwnerUsername,
  insertTicketComment,
  listTicketComments,
  type PortalTicketRole,
} from "@/lib/repos/tickets";

type Params = { id: string };
type Ctx = { params: Promise<Params> | Params };

async function resolveAccess(ticketId: number) {
  const session = await getSession();
  if (!session) return { ok: false as const, status: 401, error: "forbidden" };

  let commentUserId = 0;
  if (session.type !== "ROOT") {
    const role: PortalTicketRole | null = session.type === "MNGR" ? "MNGR" : session.type === "RSLR" ? "RSLR" : null;
    if (!role) return { ok: false as const, status: 403, error: "forbidden" };
    const allowed = await assertPortalTicketAccess(session.username, role, ticketId);
    if (!allowed) return { ok: false as const, status: 403, error: "forbidden" };
    const scope = await getPortalTicketScope(session.username, role);
    if (!scope) return { ok: false as const, status: 403, error: "forbidden" };
    commentUserId = scope.billingUserId;
  }
  return { ok: true as const, commentUserId };
}

export async function GET(_req: Request, ctx: Ctx) {
  const rawParams = await Promise.resolve(ctx.params);
  const ticketId = Number(rawParams.id);
  if (!Number.isFinite(ticketId) || ticketId <= 0) {
    return NextResponse.json({ error: "bad_ticket_id" }, { status: 400 });
  }
  const access = await resolveAccess(ticketId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const comments = await listTicketComments(ticketId);
  const rows = await Promise.all(
    comments.map(async (c) => ({
      id: c.id,
      html: c.html,
      author: await getTicketOwnerUsername(c.user_id),
      updated_at: c.updated_at,
    })),
  );

  return NextResponse.json({ comments: rows });
}

export async function POST(req: Request, ctx: Ctx) {
  const rawParams = await Promise.resolve(ctx.params);
  const ticketId = Number(rawParams.id);
  if (!Number.isFinite(ticketId) || ticketId <= 0) {
    return NextResponse.json({ error: "bad_ticket_id" }, { status: 400 });
  }
  const access = await resolveAccess(ticketId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = (await req.json().catch(() => null)) as { comment?: string } | null;
  const comment = String(body?.comment ?? "").trim();
  if (!comment) return NextResponse.json({ error: "comment_required" }, { status: 400 });

  await insertTicketComment(ticketId, comment, access.commentUserId);
  return NextResponse.json({ ok: true });
}


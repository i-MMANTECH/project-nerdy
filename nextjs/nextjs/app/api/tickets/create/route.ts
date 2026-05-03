import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { getPortalTicketScope, insertTicket, type PortalTicketRole } from "@/lib/repos/tickets";

type CreateBody = {
  subject?: string;
  description?: string;
  priority?: number;
  category_id?: number;
  channel_id?: number;
  channel_number?: number;
  flags?: {
    no_audio?: boolean;
    no_video?: boolean;
    stream_error?: boolean;
    no_epg?: boolean;
    catch_up_needed?: boolean;
    epg_needed?: boolean;
    file_missing?: boolean;
    wrong_channel_name?: boolean;
  };
};

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 401 });

  let userId = 0;
  if (session.type !== "ROOT") {
    const role: PortalTicketRole | null = session.type === "MNGR" ? "MNGR" : session.type === "RSLR" ? "RSLR" : null;
    if (!role) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const scope = await getPortalTicketScope(session.username, role);
    if (!scope) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    userId = scope.billingUserId;
  }

  const body = (await req.json().catch(() => null)) as CreateBody | null;
  const subject = String(body?.subject ?? "").trim();
  const descriptionHtml = String(body?.description ?? "");
  const priority = Number(body?.priority);
  const category_id = Number(body?.category_id);
  const channel_id = Number(body?.channel_id);
  const channel_number = Number(body?.channel_number);

  if (!subject || !Number.isFinite(priority) || priority < 1 || priority > 3) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }
  if (!Number.isFinite(category_id) || category_id <= 0 || !Number.isFinite(channel_id) || channel_id <= 0) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }
  if (!Number.isFinite(channel_number) || channel_number <= 0) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  try {
    const id = await insertTicket({
      subject,
      descriptionHtml,
      priority_id: priority,
      channel_number,
      category_id,
      channel_id,
      flags: {
        no_audio: Boolean(body?.flags?.no_audio),
        no_video: Boolean(body?.flags?.no_video),
        stream_error: Boolean(body?.flags?.stream_error),
        no_epg: Boolean(body?.flags?.no_epg),
        catch_up_needed: Boolean(body?.flags?.catch_up_needed),
        epg_needed: Boolean(body?.flags?.epg_needed),
        file_missing: Boolean(body?.flags?.file_missing),
        wrong_channel_name: Boolean(body?.flags?.wrong_channel_name),
      },
      user_id: userId,
    });

    revalidatePath("/admin/tickets");
    revalidatePath("/admin/tickets/dashboard");
    revalidatePath("/manager/tickets");
    revalidatePath("/manager/tickets/dashboard");
    revalidatePath("/dealer/tickets");
    revalidatePath("/dealer/tickets/dashboard");

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("POST /api/tickets/create failed:", error);
    return NextResponse.json({ error: "db", detail: message }, { status: 500 });
  }
}

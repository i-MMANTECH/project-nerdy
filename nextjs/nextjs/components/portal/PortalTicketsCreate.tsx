import type { FlashToastItem } from "@/components/FlashToasts";
import { FlashToastsBoundary } from "@/components/FlashToasts";
import { PageHeader } from "@/components/admin/PageHeader";
import { Panel } from "@/components/admin/Panel";
import { CreateTicketForm } from "@/components/admin/CreateTicketForm";
import { createPortalTicketAction } from "@/actions/forms";
import { listTvGenres } from "@/lib/repos/tickets";

export async function PortalTicketsCreate({ flashItems }: { flashItems: FlashToastItem[] }) {
  const genres = await listTvGenres();

  return (
    <div>
      <PageHeader title="Tickets" breadcrumb="Portal › Tickets › Create" showBack={false} />
      {flashItems.length ? <FlashToastsBoundary items={flashItems} stripParams={["error"]} /> : null}
      <Panel title="Create New Ticket">
        {genres.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No categories found. Set <span className="font-mono">STALKER_DATABASE_*</span> in <span className="font-mono">.env.local</span> so Stalker{" "}
            <span className="font-mono">tv_genre</span> and <span className="font-mono">itv</span> can be read (same as PHP tickets).
          </p>
        ) : (
          <CreateTicketForm genres={genres} action={createPortalTicketAction} ticketsApiBase="/api/admin/tickets" />
        )}
      </Panel>
    </div>
  );
}

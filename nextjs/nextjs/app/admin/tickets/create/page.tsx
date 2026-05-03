import Link from "next/link";
import { FlashToastsBoundary } from "@/components/FlashToasts";
import { portalTicketCreateFlashItems } from "@/lib/urlFlashToasts";
import { PageHeader } from "@/components/admin/PageHeader";
import { Panel } from "@/components/admin/Panel";
import { CreateTicketForm } from "@/components/admin/CreateTicketForm";
import { createTicketAction } from "@/actions/forms";
import { listTvGenres } from "@/lib/repos/tickets";
import { buttonOutlineLinkClassName } from "@/components/ui/button";

type Props = { searchParams?: Promise<{ error?: string }> };

export default async function CreateTicketPage({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const genres = await listTvGenres();
  const createTicketFlashes = portalTicketCreateFlashItems(sp);

  return (
    <div className="space-y-6 pb-10">
      {createTicketFlashes.length ? <FlashToastsBoundary items={createTicketFlashes} stripParams={["error"]} /> : null}
      <PageHeader
        title="Create ticket"
        breadcrumb={
          <span className="text-muted-foreground">
            <Link href="/admin/tickets" className="text-muted-foreground transition-colors hover:text-foreground">
              Home › Tickets
            </Link>{" "}
            › Create
          </span>
        }
        actions={
          <Link href="/admin/tickets" className={buttonOutlineLinkClassName("bg-card shadow-sm")}>
            Back to tickets
          </Link>
        }
      />
      <Panel
        title="Create New Ticket"
        className="overflow-hidden rounded-2xl border-border/70 shadow-md ring-1 ring-black/[0.06] dark:bg-[hsl(222_47%_8%/0.92)] dark:ring-white/[0.08]"
      >
        {genres.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            No categories found. Set <span className="font-mono text-foreground/90">STALKER_DATABASE_*</span> in <span className="font-mono text-foreground/90">.env.local</span> so Stalker{" "}
            <span className="font-mono text-foreground/90">tv_genre</span> and <span className="font-mono text-foreground/90">itv</span> can be read (same as PHP admin tickets).
          </p>
        ) : (
          <CreateTicketForm genres={genres} action={createTicketAction} />
        )}
      </Panel>
    </div>
  );
}

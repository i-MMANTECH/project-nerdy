"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { MoreVertical, Pencil, Users } from "lucide-react";
import { ResellerDeleteDealerForm } from "@/components/portal/ResellerDeleteDealerForm";
import { Button } from "@/components/ui/button";
import { FloatingMenuPortal } from "@/components/ui/FloatingMenuPortal";

export function ResellerDealerRowActions({
  username,
  displayName,
  canDelete,
}: {
  username: string;
  displayName: string;
  canDelete: boolean;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  const editHref = `/reseller/dealers/${encodeURIComponent(username)}`;
  const subscribersHref = `/reseller/dealers/${encodeURIComponent(username)}/users`;

  return (
    <div className="relative flex justify-center">
      <div ref={anchorRef} className="inline-flex">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 w-9 shrink-0 border border-border/80 bg-card p-0 text-foreground/85 shadow-sm hover:bg-muted/70 hover:text-foreground dark:border-border/60 dark:bg-muted/30 dark:hover:bg-muted/50"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={`Actions for ${displayName || username}`}
          onClick={() => setOpen((o) => !o)}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </div>
      <FloatingMenuPortal open={open} onOpenChange={setOpen} anchorRef={anchorRef} menuClassName="min-w-56 w-56">
        <Link
          href={subscribersHref}
          role="menuitem"
          className="flex items-center gap-2 px-3 py-2 text-foreground hover:bg-muted/60"
          onClick={() => setOpen(false)}
        >
          <Users className="h-4 w-4 shrink-0 opacity-70" />
          View users
        </Link>
        <Link
          href={editHref}
          role="menuitem"
          className="flex items-center gap-2 px-3 py-2 text-foreground hover:bg-muted/60"
          onClick={() => setOpen(false)}
        >
          <Pencil className="h-4 w-4 shrink-0 opacity-70" />
          Edit
        </Link>
        <div className="border-t border-border/60" onClick={(e) => e.stopPropagation()}>
          <ResellerDeleteDealerForm
            username={username}
            canDelete={canDelete}
            fromList
            menuItem
            onPanelOpenChange={(o) => o && setOpen(false)}
          />
        </div>
      </FloatingMenuPortal>
    </div>
  );
}

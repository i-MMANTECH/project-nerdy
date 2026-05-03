"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { MoreVertical, Pencil, Store, Users } from "lucide-react";
import { ManagerDeleteDealerForm } from "@/components/portal/ManagerDeleteDealerForm";
import { Button } from "@/components/ui/button";
import { FloatingMenuPortal } from "@/components/ui/FloatingMenuPortal";

export function ManagerDealerRowActions({
  username,
  displayName,
  resellerUsername,
  canDelete,
}: {
  username: string;
  displayName: string;
  resellerUsername: string;
  canDelete: boolean;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  const editHref = `/manager/dealers/${encodeURIComponent(username)}`;
  const subscribersHref = `/manager/dealers/${encodeURIComponent(username)}/users`;
  const resellerDealersHref = `/manager/dealers?reseller=${encodeURIComponent(resellerUsername)}`;

  return (
    <div className="relative flex justify-center">
      <div ref={anchorRef} className="inline-flex">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 w-9 shrink-0 p-0 text-muted-foreground hover:text-foreground"
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
          href={resellerDealersHref}
          role="menuitem"
          className="flex items-center gap-2 px-3 py-2 text-foreground hover:bg-muted/60"
          onClick={() => setOpen(false)}
        >
          <Store className="h-4 w-4 shrink-0 opacity-70" />
          Dealers under reseller
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
          <ManagerDeleteDealerForm
            username={username}
            canDelete={canDelete}
            menuItem
            onPanelOpenChange={(o) => o && setOpen(false)}
          />
        </div>
      </FloatingMenuPortal>
    </div>
  );
}

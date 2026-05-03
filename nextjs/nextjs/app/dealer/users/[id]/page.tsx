import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { OperatorUserEditPage } from "@/components/portal/OperatorUserEditPage";
import { OperatorUserEditQueryAlerts } from "@/components/portal/OperatorUserEditQueryAlerts";
import { getSession } from "@/lib/session";
import { getUserByIdScoped } from "@/lib/data";
import { safePortalUsersRedirectPath } from "@/lib/portalUsersRedirectPath";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    ok?: string;
    error?: string;
    bal?: string;
    req?: string;
    max?: string;
    renew_acc?: string;
    list?: string;
  }>;
};

export default async function DealerUserEditPage({ params, searchParams }: Props) {
  const s = await getSession();
  if (!s || s.type !== "RSLR") redirect("/login?error=forbidden");

  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const u = await getUserByIdScoped({ ownerType: "RSLR", ownerUsername: s.username, id: decodeURIComponent(id) });
  if (!u) notFound();

  const detailReturnPath = `/dealer/users/${encodeURIComponent(u.id)}`;
  const usersListReturnPath = safePortalUsersRedirectPath(String(sp.list ?? ""), "/dealer");

  const breadcrumb = (
    <nav className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
      <Link href="/dealer" className="transition-colors hover:text-foreground">
        Dashboard
      </Link>
      <span aria-hidden className="text-border">
        /
      </span>
      <Link href="/dealer/users" className="transition-colors hover:text-foreground">
        Users
      </Link>
      <span aria-hidden className="text-border">
        /
      </span>
      <span className="font-mono font-medium text-foreground">{u.username}</span>
    </nav>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <PageHeader
        title="Edit user"
        breadcrumb={breadcrumb}
        showBack
        backHref="/dealer/users"
        backLabel="Back to list"
      />
      <OperatorUserEditQueryAlerts ok={sp.ok} error={sp.error} bal={sp.bal} req={sp.req} max={sp.max} renew_acc={sp.renew_acc} />
      <OperatorUserEditPage
        u={u}
        portalBase="/dealer"
        portalRole="RSLR"
        detailReturnPath={detailReturnPath}
        usersListReturnPath={usersListReturnPath}
      />
    </div>
  );
}
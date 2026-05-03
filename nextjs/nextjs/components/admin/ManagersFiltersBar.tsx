"use client";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { FormSelect } from "@/components/forms/form-select";

function buildManagersHref(sp: {
  q?: string;
  ps?: number;
  type?: string;
  status?: string;
  sort?: string;
  dir?: string;
  cols?: string;
  quick?: string;
  bq?: string;
  bs?: string;
}) {
  const params = new URLSearchParams();
  const q = (sp.q ?? "").trim();
  if (q) params.set("q", q);
  if (sp.ps && [10, 25, 50, 100].includes(sp.ps)) params.set("ps", String(sp.ps));
  if (sp.type && ["manager", "reseller", "dealer"].includes(sp.type)) params.set("type", sp.type);
  if (sp.status && ["active", "inactive"].includes(sp.status)) params.set("status", sp.status);
  if (sp.sort) params.set("sort", sp.sort);
  if (sp.dir) params.set("dir", sp.dir);
  if (sp.cols) params.set("cols", sp.cols);
  if (sp.quick === "1") params.set("quick", "1");
  const bq = (sp.bq ?? "").trim();
  if (bq) params.set("bq", bq);
  if (sp.bs && ["active", "inactive"].includes(sp.bs)) params.set("bs", sp.bs);
  const query = params.toString();
  return query ? `/admin/managers?${query}` : "/admin/managers";
}

export function ManagersFiltersBar({
  q,
  type,
  status,
  ps,
  sort,
  dir,
  cols,
  quick,
  bq,
  bs,
}: {
  q?: string;
  type?: string;
  status?: string;
  ps: number;
  sort?: string;
  dir?: string;
  cols?: string;
  quick?: string;
  bq?: string;
  bs?: "active" | "inactive";
}) {
  const router = useRouter();
  const STATUS_ALL = "all";
  const statusForSelect = status === "active" || status === "inactive" ? status : STATUS_ALL;
  const [qInput, setQInput] = useState(q ?? "");
  const [typeValue, setTypeValue] = useState(type ?? "");
  const [statusValue, setStatusValue] = useState(statusForSelect);
  const [pageSizeValue, setPageSizeValue] = useState(String(ps));

  useEffect(() => {
    setQInput(q ?? "");
    setTypeValue(type ?? "");
    setStatusValue(status === "active" || status === "inactive" ? status : STATUS_ALL);
    setPageSizeValue(String(ps));
  }, [q, type, status, ps]);

  const apply = (next: { q?: string; type?: string; status?: string; ps?: number }) => {
    const parsedPageSize = Number.parseInt(pageSizeValue, 10);
    const href = buildManagersHref({
      q: next.q ?? qInput,
      ps: next.ps ?? ([10, 25, 50, 100].includes(parsedPageSize) ? parsedPageSize : ps),
      type: (next.type ?? typeValue) || "",
      status:
        (next.status ?? statusValue) === STATUS_ALL || (next.status ?? statusValue) === ""
          ? ""
          : (next.status ?? statusValue),
      sort,
      dir,
      cols,
      quick,
      bq,
      bs,
    });
    router.replace(href, { scroll: false });
  };

  return (
    <form
      method="get"
      action="/admin/managers"
      onSubmit={(e) => {
        e.preventDefault();
        apply({ q: qInput, type: typeValue, status: statusValue, ps: Number.parseInt(pageSizeValue, 10) || ps });
      }}
      className="flex w-full min-w-0 items-center gap-3 overflow-x-auto"
    >
      <label htmlFor="staff-mgr-search" className="sr-only">
        Search staff
      </label>
      <div className="relative min-w-[20rem] w-full max-w-[58rem] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/80" aria-hidden />
        <input
          id="staff-mgr-search"
          name="q"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder="Search by name, username, status, users, credits..."
          className="h-10 w-full min-w-0 rounded-lg border border-border/70 bg-background pl-10 pr-3 text-sm text-foreground outline-none ring-offset-background transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-primary/35 focus-visible:ring-1 focus-visible:ring-primary/35 focus-visible:shadow-[0_0_0_1px_rgba(14,165,233,0.18)]"
        />
      </div>
      <FormSelect
        id="staff-page-size"
        name="ps"
        value={pageSizeValue}
        onValueChange={(next) => {
          setPageSizeValue(next);
          const parsed = Number.parseInt(next, 10);
          apply({ ps: [10, 25, 50, 100].includes(parsed) ? parsed : ps, q: qInput, type: typeValue, status: statusValue });
        }}
        options={[
          { value: "10", label: "Show: 10" },
          { value: "25", label: "Show: 25" },
          { value: "50", label: "Show: 50" },
          { value: "100", label: "Show: 100" },
        ]}
        contentClassName="!w-max !min-w-0"
        className="h-10 !w-max min-w-[6.5rem] rounded-xl border border-border/70 bg-background px-3 font-medium text-foreground shadow-sm transition-colors hover:border-border hover:bg-muted/20 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/20"
      />
      <FormSelect
        id="staff-status-filter"
        name="status"
        value={statusValue}
        onValueChange={(next) => {
          setStatusValue(next);
          apply({ status: next, q: qInput, type: typeValue, ps: Number.parseInt(pageSizeValue, 10) || ps });
        }}
        options={[
          { value: STATUS_ALL, label: "All" },
          { value: "active", label: "Active" },
          { value: "inactive", label: "Inactive" },
        ]}
        contentClassName="!w-max !min-w-0"
        placeholder="Status"
        className="h-10 !w-max min-w-[6.25rem] rounded-xl border border-border/70 bg-background px-3 font-medium text-foreground shadow-sm transition-colors hover:border-border hover:bg-muted/20 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/20"
      />
    </form>
  );
}

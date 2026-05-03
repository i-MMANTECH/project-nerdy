import type { AdminTransactionRow } from "@/lib/repos/billing";
import { formatTransactionRemarksForDisplay } from "@/lib/formatTransactionRemarks";
import { dataTableStickyTh } from "@/lib/ui/dataTableSticky";

function padTxnId(raw: string) {
  return raw.padStart(8, "0");
}

function dash(v: string | null | undefined) {
  if (v == null || v === "") return "—";
  return v;
}

/** PHP `common/transactions.php` type column (CRDT or not, account empty or not). */
function portalTypeBadge(type: string, account: string | null) {
  const t = type.toUpperCase();
  const hasAcc = account != null && account.trim() !== "";
  if (t === "CRDT") {
    if (hasAcc) {
      return <span className="inline-block rounded bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">RECOVERED</span>;
    }
    return <span className="inline-block rounded bg-muted px-2 py-0.5 text-xs font-semibold text-accent-foreground">PURCHASED</span>;
  }
  if (hasAcc) {
    return <span className="inline-block rounded bg-muted px-2 py-0.5 text-xs font-semibold text-accent-foreground">TRANSFERRED</span>;
  }
  return <span className="inline-block rounded bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">REVERSED</span>;
}

export function OperatorTransactionsView({ rows }: { rows: AdminTransactionRow[] }) {
  const totalCredits = rows.reduce((sum, r) => sum + r.periods, 0);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No transactions found.</p>;
  }

  return (
    <div className="app-data-table-scroll thin-scrollbar">
      <table className="w-full min-w-[880px] border-collapse text-sm">
        <thead>
          <tr>
            <th className={dataTableStickyTh("whitespace-nowrap p-2")}>Transaction</th>
            <th className={dataTableStickyTh("whitespace-nowrap p-2")}>Type</th>
            <th className={dataTableStickyTh("whitespace-nowrap p-2")}>Credits</th>
            <th className={dataTableStickyTh("whitespace-nowrap p-2")}>Months</th>
            <th className={dataTableStickyTh("whitespace-nowrap p-2")}>Sub-account</th>
            <th className={dataTableStickyTh("whitespace-nowrap p-2")}>Coverage start</th>
            <th className={dataTableStickyTh("whitespace-nowrap p-2")}>Coverage end</th>
            <th className={dataTableStickyTh("p-2")}>Remarks</th>
            <th className={dataTableStickyTh("whitespace-nowrap p-2")}>Date / time</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.transaction}-${i}`} className="border-b border-border hover:bg-muted/50">
              <td className="whitespace-nowrap p-2 font-mono">{padTxnId(r.transaction)}</td>
              <td className="p-2">{portalTypeBadge(r.type, r.account)}</td>
              <td className="whitespace-nowrap p-2 font-mono">{r.periods}</td>
              <td className="whitespace-nowrap p-2">—</td>
              <td className="whitespace-nowrap p-2 font-mono">{dash(r.account)}</td>
              <td className="whitespace-nowrap p-2 text-foreground">{dash(r.coverage_start)}</td>
              <td className="whitespace-nowrap p-2 text-foreground">{dash(r.coverage_end)}</td>
              <td
                className="max-w-xs truncate p-2 text-foreground"
                title={formatTransactionRemarksForDisplay(r.remarks) || undefined}
              >
                {dash(formatTransactionRemarksForDisplay(r.remarks))}
              </td>
              <td className="whitespace-nowrap p-2 text-muted-foreground">{dash(r.timestamp)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-input bg-muted/50 font-medium">
            <td className="p-2">{rows.length}</td>
            <td className="p-2">—</td>
            <td className="p-2">
              Total <span className="font-mono">{totalCredits}</span>
            </td>
            <td className="p-2" colSpan={6}>
              —
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

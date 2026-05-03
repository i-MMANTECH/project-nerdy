/**
 * PHP `Transaction_model::add` stored markup in `remarks` (e.g. `Credit <strong>From</strong>: …`);
 * CI views output it unescaped so the browser rendered bold. React text nodes escape HTML, so the same DB
 * values show literal tags — strip tags for display. New rows use plain text from `accountCreate.ts`.
 */
export function formatTransactionRemarksForDisplay(raw: string | null | undefined): string {
  if (raw == null || raw === "") return "";
  return String(raw)
    // Hide internal ledger/debug tags from UI text.
    .replace(/\s*\[(?:promo_grant|recover_of_tx):[^\]]+\]/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

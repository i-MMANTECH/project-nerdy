/** Matches admin/hierarchy CRDT lines: `… (base 123)`. */
const HIERARCHY_GRANT_BASE_RE = /\(base (\d+)\)/;

export function parseHierarchyGrantBaseCredits(remarks: string | null | undefined): number | null {
  if (remarks == null || String(remarks).trim() === "") return null;
  const m = String(remarks).match(HIERARCHY_GRANT_BASE_RE);
  if (!m) return null;
  const n = Math.floor(Number(m[1]));
  return Number.isFinite(n) && n >= 1 ? n : null;
}

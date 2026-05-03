export function formatMysqlDateTime(d: Date) {
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Billing `accounts.expires` is expired (same idea as PHP `Users_model::check_expired`). */
export function isBillingAccountExpired(expires: string | null | undefined): boolean {
  if (expires == null || expires === "") return false;
  const s = String(expires);
  if (s <= "1970-01-01 00:00:00") return false;
  return s < formatMysqlDateTime(new Date());
}

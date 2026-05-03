/** Allow portal `/users` list, `/users/:account` (flashes), or nested `/dealers/:login/users` (MNGR/SRSLR). */
export function safePortalUsersRedirectPath(
  raw: string,
  base: "/manager" | "/reseller" | "/dealer",
): string {
  const s = String(raw ?? "").trim();
  if (s.startsWith("//") || s.includes("..")) return `${base}/users`;
  const prefix = `${base}/users`;
  if (s === prefix || s.startsWith(`${prefix}?`)) return s;
  if (s.startsWith(`${prefix}/`)) {
    const after = s.slice(prefix.length + 1);
    const firstSeg = (after.split(/[?#]/)[0] ?? "").trim();
    if (firstSeg.length > 0 && firstSeg.length <= 512 && !firstSeg.includes("/")) {
      return s;
    }
  }
  const dealerUsersPrefix = `${base}/dealers/`;
  if (s.startsWith(dealerUsersPrefix)) {
    const pathOnly = (s.split(/[?#]/)[0] ?? "").trim();
    const suffix = "/users";
    if (pathOnly.endsWith(suffix)) {
      const mid = pathOnly.slice(dealerUsersPrefix.length, pathOnly.length - suffix.length);
      if (mid.length > 0 && mid.length <= 256 && !mid.includes("/")) {
        return s;
      }
    }
  }
  return `${base}/users`;
}

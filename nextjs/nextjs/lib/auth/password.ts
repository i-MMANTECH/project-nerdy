import bcrypt from "bcryptjs";

/**
 * Matches legacy PHP `Auth_model::attempt` behavior: plain compare,
 * plus bcrypt when the stored value looks like a bcrypt hash.
 */
export async function verifyPassword(plain: string, stored: string | null | undefined): Promise<boolean> {
  if (!plain || stored == null || stored === "") return false;
  const s = String(stored);
  if (s.startsWith("$2a$") || s.startsWith("$2b$") || s.startsWith("$2y$")) {
    return bcrypt.compareSync(plain, s);
  }
  return plain === s;
}

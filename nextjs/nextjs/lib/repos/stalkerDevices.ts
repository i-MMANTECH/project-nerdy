import type { ResultSetHeader } from "mysql2";
import { getStalkerPool } from "@/lib/db/pool";

/** PHP `Stalker_model::reset_data` — `UPDATE stalker.users` where `login` = billing account id. */
export async function clearStalkerUserDeviceTokensByLogin(
  login: string,
): Promise<{ ok: true } | { ok: false; reason: "no_stalker_db" | "no_stalker_row" }> {
  const stalker = getStalkerPool();
  if (!stalker) return { ok: false, reason: "no_stalker_db" };
  const [res] = await stalker.execute<ResultSetHeader>(
    "UPDATE users SET device_id = NULL, device_id2 = NULL, access_token = NULL WHERE login = :l LIMIT 1",
    { l: login },
  );
  if (res.affectedRows < 1) return { ok: false, reason: "no_stalker_row" };
  return { ok: true };
}

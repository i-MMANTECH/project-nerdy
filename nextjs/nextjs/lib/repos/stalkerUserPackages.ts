import type { RowDataPacket } from "mysql2";
import { getStalkerPool } from "@/lib/db/pool";

/**
 * PHP `Stalker_model::get_custom_plan_id` — `tariff_plan.name = 'CUSTOM PACKAGE'`.
 * Many installs use a longer label (e.g. `CUSTOM PACKAGE SELECTION`); we fall back to a prefix match.
 */
export async function getStalkerCustomPackagePlanId(): Promise<number | null> {
  const stalker = getStalkerPool();
  if (!stalker) return null;
  const [exact] = await stalker.execute<RowDataPacket[]>(
    "SELECT id FROM tariff_plan WHERE TRIM(name) = 'CUSTOM PACKAGE' LIMIT 1",
  );
  if (exact.length) return Number(exact[0].id);
  const [prefix] = await stalker.execute<RowDataPacket[]>(
    "SELECT id FROM tariff_plan WHERE UPPER(TRIM(name)) LIKE 'CUSTOM PACKAGE%' ORDER BY id ASC LIMIT 1",
  );
  if (!prefix.length) return null;
  return Number(prefix[0].id);
}

export type StalkerPlanPackageRow = { package_id: number; name: string };

/** PHP `Stalker_model::get_package($plan_id)`. */
export async function listStalkerPackagesForPlan(planId: number): Promise<StalkerPlanPackageRow[]> {
  const stalker = getStalkerPool();
  if (!stalker || !Number.isFinite(planId) || planId <= 0) return [];
  const [rows] = await stalker.execute<RowDataPacket[]>(
    `SELECT pip.package_id, sp.name
     FROM package_in_plan pip
     INNER JOIN services_package sp ON sp.id = pip.package_id
     WHERE pip.plan_id = :planId
     ORDER BY sp.name ASC`,
    { planId },
  );
  return rows.map((r) => ({
    package_id: Number(r.package_id),
    name: String(r.name ?? ""),
  }));
}

/** PHP `Stalker_model::get_user_packages`. */
export async function listStalkerUserSubscribedPackageIds(userId: number): Promise<number[]> {
  const stalker = getStalkerPool();
  if (!stalker || !Number.isFinite(userId) || userId <= 0) return [];
  const [rows] = await stalker.execute<RowDataPacket[]>(
    "SELECT package_id FROM user_package_subscription WHERE user_id = :uid",
    { uid: userId },
  );
  return rows.map((r) => Number(r.package_id)).filter((n) => Number.isFinite(n) && n > 0);
}

/** PHP `Stalker_model::update_package`. */
export async function getStalkerUserDbIdByLogin(login: string): Promise<number | null> {
  const stalker = getStalkerPool();
  if (!stalker) return null;
  const [rows] = await stalker.execute<RowDataPacket[]>("SELECT id FROM users WHERE login = :l LIMIT 1", {
    l: login.trim(),
  });
  if (!rows.length) return null;
  return Number(rows[0].id);
}

export async function setStalkerUserPackageSubscriptions(userId: number, packageIds: number[]): Promise<boolean> {
  const stalker = getStalkerPool();
  if (!stalker) return true;
  if (!Number.isFinite(userId) || userId <= 0) return false;
  const ids = [...new Set(packageIds.filter((n) => Number.isFinite(n) && n > 0).map((n) => Math.floor(n)))].sort(
    (a, b) => a - b,
  );

  const conn = await stalker.getConnection();
  try {
    const [existing] = await conn.execute<RowDataPacket[]>(
      "SELECT package_id FROM user_package_subscription WHERE user_id = :uid",
      { uid: userId },
    );
    const prev = existing.map((r) => Number(r.package_id)).sort((a, b) => a - b);
    const same = prev.length === ids.length && prev.every((v, i) => v === ids[i]);
    if (same) return true;

    await conn.execute("DELETE FROM user_package_subscription WHERE user_id = :uid", { uid: userId });
    for (const pid of ids) {
      await conn.execute(
        "INSERT INTO user_package_subscription (user_id, package_id) VALUES (:uid, :pid)",
        { uid: userId, pid },
      );
    }
    return true;
  } catch {
    return false;
  } finally {
    conn.release();
  }
}

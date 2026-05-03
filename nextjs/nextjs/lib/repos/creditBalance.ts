import type { RowDataPacket } from "mysql2";
import { getBillingPool } from "@/lib/db/pool";

/** PHP `Transaction_model::get_credit_balance` — CRDT adds periods, other types subtract. */
export async function getCreditBalance(username: string): Promise<number> {
  const pool = getBillingPool();
  const u = username.trim();
  if (!u) return 0;
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COALESCE(SUM(CASE WHEN type = 'CRDT' THEN periods ELSE -periods END), 0) AS balance
     FROM transactions WHERE username = :user`,
    { user: u },
  );
  return Number(rows[0]?.balance ?? 0);
}

import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { getBillingPool } from "@/lib/db/pool";

const ACCOUNT_STATUS_ON = 0;
const ACCOUNT_STATUS_OFF = 1;

function mysqlNow(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Same rule as billing `accounts.expires` vs current time (PHP expired list). */
export function isBillingExpiresInPast(expires: string | null): boolean {
  if (expires == null || expires === "") return false;
  const s = String(expires);
  if (s <= "1970-01-01 00:00:00") return false;
  return s < mysqlNow();
}

/** PHP `reseller/dealers/index` — same credit balance rule as admin/manager dealer lists. */
export type ResellerPortalDealerRow = {
  username: string;
  name: string;
  password: string;
  status: string;
  userCount: number;
  credits: number;
  canDelete: boolean;
};

/** PHP `reseller/Dealers::index` — RSLR owned by this reseller. */
export async function listDealersOwnedByReseller(resellerUsername: string): Promise<ResellerPortalDealerRow[]> {
  const pool = getBillingPool();
  const r = resellerUsername.trim();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT u.username, u.name, u.password, u.status,
      (SELECT COUNT(*) FROM accounts a WHERE a.username = u.username) AS user_count
     FROM users u
     WHERE u.type = 'RSLR' AND u.username_owner = :r
     ORDER BY u.username ASC`,
    { r },
  );
  if (rows.length === 0) return [];

  const usernames = rows.map((row) => String(row.username));
  const ph = usernames.map(() => "?").join(",");
  const [balRows] = await pool.execute<RowDataPacket[]>(
    `SELECT username,
        COALESCE(SUM(CASE WHEN type = 'CRDT' THEN periods ELSE -periods END), 0) AS balance
     FROM transactions WHERE username IN (${ph}) GROUP BY username`,
    usernames,
  );
  const balMap = new Map(balRows.map((b) => [String(b.username), Number(b.balance)]));

  return rows.map((row) => {
    const username = String(row.username);
    const userCount = Number(row.user_count ?? 0);
    return {
      username,
      name: row.name != null ? String(row.name) : "",
      password: String(row.password ?? ""),
      status: String(row.status ?? "A"),
      userCount,
      credits: balMap.get(username) ?? 0,
      canDelete: userCount === 0,
    };
  });
}

export async function resellerOwnsDealer(resellerUsername: string, dealerUsername: string): Promise<boolean> {
  const pool = getBillingPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT 1 FROM users WHERE type = 'RSLR' AND username = :d AND username_owner = :r LIMIT 1`,
    { d: dealerUsername.trim(), r: resellerUsername.trim() },
  );
  return rows.length > 0;
}

/** PHP `Dealer_model::has_users` — any `accounts` row for this dealer login. */
export async function dealerHasEndUsers(dealerUsername: string): Promise<boolean> {
  const pool = getBillingPool();
  const [rows] = await pool.execute<RowDataPacket[]>("SELECT 1 FROM accounts WHERE username = :u LIMIT 1", {
    u: dealerUsername.trim(),
  });
  return rows.length > 0;
}

export type DealerAccountListRow = {
  account: string;
  full_name: string | null;
  mac: string | null;
  expires: string | null;
  status: number;
};

/**
 * PHP `Dealers_users::index` — `accounts.username` = dealer, dealer owned by reseller.
 * `status` query: active | inactive | expired (same semantics as {@link accountListWhereClause}).
 */
export async function listAccountsForDealerUnderReseller(
  resellerUsername: string,
  dealerUsername: string,
  status: string | null,
): Promise<DealerAccountListRow[]> {
  if (!(await resellerOwnsDealer(resellerUsername, dealerUsername))) return [];
  const pool = getBillingPool();
  const d = dealerUsername.trim();
  const parts: string[] = ["a.username = ?"];
  const params: unknown[] = [d];
  const s = status?.toLowerCase() ?? "";
  if (s === "active") {
    parts.push("a.status = ?");
    params.push(ACCOUNT_STATUS_ON);
  } else if (s === "inactive") {
    parts.push("a.status = ?");
    params.push(ACCOUNT_STATUS_OFF);
  } else if (s === "expired") {
    parts.push("(a.expires IS NOT NULL AND a.expires > ? AND a.expires < NOW())");
    params.push("1970-01-01 00:00:00");
  }
  const where = parts.join(" AND ");
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT a.account, a.full_name, a.mac, a.expires, a.status
     FROM accounts a
     WHERE ${where}
     ORDER BY a.account ASC`,
    params,
  );
  return rows.map((row) => ({
    account: String(row.account ?? ""),
    full_name: row.full_name != null ? String(row.full_name) : null,
    mac: row.mac != null ? String(row.mac) : null,
    expires: row.expires != null ? String(row.expires) : null,
    status: Number(row.status ?? 0),
  }));
}

export async function countAccountsForDealer(dealerUsername: string): Promise<number> {
  const pool = getBillingPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) AS c FROM accounts WHERE username = :u",
    { u: dealerUsername.trim() },
  );
  return Number(rows[0]?.c ?? 0);
}

export async function deleteDealerOwnedByReseller(resellerUsername: string, dealerUsername: string): Promise<boolean> {
  if (!(await resellerOwnsDealer(resellerUsername, dealerUsername))) return false;
  if (await dealerHasEndUsers(dealerUsername)) return false;
  const pool = getBillingPool();
  const [res] = await pool.execute<ResultSetHeader>(
    "DELETE FROM users WHERE username = :d AND type = 'RSLR' AND username_owner = :r LIMIT 1",
    { d: dealerUsername.trim(), r: resellerUsername.trim() },
  );
  return res.affectedRows === 1;
}

import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { getBillingPool } from "@/lib/db/pool";

/** PHP `manager/resellers/index` row — same counters as `Manager_model::count_resellers` + `Dealer_model::count_users` + balance. */
export type ManagerPortalResellerRow = {
  username: string;
  name: string;
  password: string;
  status: string;
  comments: string;
  dealerCount: number;
  userCount: number;
  credits: number;
  canDelete: boolean;
};

/** PHP `manager/dealers/index` row — same balance rule as `getDealers`; delete when no `accounts` for dealer. */
export type ManagerPortalDealerRow = {
  username: string;
  name: string;
  password: string;
  status: string;
  resellerUsername: string;
  userCount: number;
  credits: number;
  canDelete: boolean;
};

/** PHP `manager/Resellers::index` — SRSLR rows under this manager with dealer/user counts and credit balance. */
export async function listResellersOwnedByManager(managerUsername: string): Promise<ManagerPortalResellerRow[]> {
  const pool = getBillingPool();
  const m = managerUsername.trim();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT u.username, u.name, u.password, u.status, COALESCE(u.comments, '') AS comments,
      (SELECT COUNT(*) FROM users ch WHERE ch.username_owner = u.username) AS dealer_count,
      (SELECT COUNT(*) FROM accounts a WHERE a.username = u.username) AS user_count
     FROM users u
     WHERE u.type = 'SRSLR' AND u.username_owner = :m
     ORDER BY u.username ASC`,
    { m },
  );
  if (rows.length === 0) return [];

  const usernames = rows.map((r) => String(r.username));
  const ph = usernames.map(() => "?").join(",");
  const [balRows] = await pool.execute<RowDataPacket[]>(
    `SELECT username,
        COALESCE(SUM(CASE WHEN type = 'CRDT' THEN periods ELSE -periods END), 0) AS balance
     FROM transactions WHERE username IN (${ph}) GROUP BY username`,
    usernames,
  );
  const balMap = new Map(balRows.map((r) => [String(r.username), Number(r.balance)]));

  return rows.map((r) => {
    const username = String(r.username);
    const dealerCount = Number(r.dealer_count ?? 0);
    const userCount = Number(r.user_count ?? 0);
    return {
      username,
      name: r.name != null ? String(r.name) : "",
      password: String(r.password ?? ""),
      status: String(r.status ?? "A"),
      comments: r.comments != null ? String(r.comments) : "",
      dealerCount,
      userCount,
      credits: balMap.get(username) ?? 0,
      canDelete: dealerCount === 0 && userCount === 0,
    };
  });
}

/** PHP `Manager_model::get_all_dealers` — RSLR under SRSLR owned by this manager. */
export async function listDealersUnderManager(managerUsername: string): Promise<ManagerPortalDealerRow[]> {
  const pool = getBillingPool();
  const m = managerUsername.trim();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT d.username, d.name, d.password, d.status, d.username_owner AS reseller_username,
      (SELECT COUNT(*) FROM accounts a WHERE a.username = d.username) AS user_count
     FROM users d
     INNER JOIN users r ON r.username = d.username_owner AND r.type = 'SRSLR' AND r.username_owner = :m
     WHERE d.type = 'RSLR'
     ORDER BY d.username ASC`,
    { m },
  );
  if (rows.length === 0) return [];

  const usernames = rows.map((r) => String(r.username));
  const ph = usernames.map(() => "?").join(",");
  const [balRows] = await pool.execute<RowDataPacket[]>(
    `SELECT username,
        COALESCE(SUM(CASE WHEN type = 'CRDT' THEN periods ELSE -periods END), 0) AS balance
     FROM transactions WHERE username IN (${ph}) GROUP BY username`,
    usernames,
  );
  const balMap = new Map(balRows.map((r) => [String(r.username), Number(r.balance)]));

  return rows.map((r) => {
    const username = String(r.username);
    const userCount = Number(r.user_count ?? 0);
    return {
      username,
      name: r.name != null ? String(r.name) : "",
      password: String(r.password ?? ""),
      status: String(r.status ?? "A"),
      resellerUsername: String(r.reseller_username ?? ""),
      userCount,
      credits: balMap.get(username) ?? 0,
      canDelete: userCount === 0,
    };
  });
}

export async function managerOwnsReseller(managerUsername: string, resellerUsername: string): Promise<boolean> {
  const pool = getBillingPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT 1 FROM users WHERE type = 'SRSLR' AND username = :r AND username_owner = :m LIMIT 1`,
    { r: resellerUsername.trim(), m: managerUsername.trim() },
  );
  return rows.length > 0;
}

/** PHP `Manager_model::is_mydealer`. */
export async function managerOwnsDealer(managerUsername: string, dealerUsername: string): Promise<boolean> {
  const pool = getBillingPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT 1 FROM users d
     INNER JOIN users r ON r.username = d.username_owner AND r.type = 'SRSLR' AND r.username_owner = :m
     WHERE d.type = 'RSLR' AND d.username = :d LIMIT 1`,
    { m: managerUsername.trim(), d: dealerUsername.trim() },
  );
  return rows.length > 0;
}

/** PHP `Reseller_model::has_dealers` — any `users` row owned by this reseller. */
export async function resellerHasChildDealers(resellerUsername: string): Promise<boolean> {
  const pool = getBillingPool();
  const [rows] = await pool.execute<RowDataPacket[]>("SELECT 1 FROM users WHERE username_owner = :u LIMIT 1", {
    u: resellerUsername.trim(),
  });
  return rows.length > 0;
}

export async function resellerHasAccounts(resellerUsername: string): Promise<boolean> {
  const pool = getBillingPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT 1 FROM accounts WHERE username = :u LIMIT 1",
    { u: resellerUsername.trim() },
  );
  return rows.length > 0;
}

export async function resellerCanBeDeletedByManager(managerUsername: string, resellerUsername: string): Promise<boolean> {
  if (!(await managerOwnsReseller(managerUsername, resellerUsername))) return false;
  if (await resellerHasChildDealers(resellerUsername)) return false;
  if (await resellerHasAccounts(resellerUsername)) return false;
  return true;
}

export async function usernameExistsInUsers(username: string): Promise<boolean> {
  const pool = getBillingPool();
  const [rows] = await pool.execute<RowDataPacket[]>("SELECT 1 FROM users WHERE username = :u LIMIT 1", { u: username.trim() });
  return rows.length > 0;
}

export async function deleteResellerOwnedByManager(managerUsername: string, resellerUsername: string): Promise<boolean> {
  if (!(await resellerCanBeDeletedByManager(managerUsername, resellerUsername))) return false;
  const pool = getBillingPool();
  const [res] = await pool.execute<ResultSetHeader>(
    "DELETE FROM users WHERE username = :u AND type = 'SRSLR' AND username_owner = :m LIMIT 1",
    { u: resellerUsername.trim(), m: managerUsername.trim() },
  );
  return res.affectedRows === 1;
}

/** PHP `dealer_action_buttons` / `has_users` — manager may delete dealer only if no `accounts` rows. */
export async function dealerCanBeDeletedByManager(managerUsername: string, dealerUsername: string): Promise<boolean> {
  if (!(await managerOwnsDealer(managerUsername, dealerUsername))) return false;
  const pool = getBillingPool();
  const [[r]] = await pool.execute<RowDataPacket[]>("SELECT COUNT(*) AS c FROM accounts WHERE username = :u", {
    u: dealerUsername.trim(),
  });
  return Number(r?.c) === 0;
}

export async function deleteDealerOwnedByManager(managerUsername: string, dealerUsername: string): Promise<boolean> {
  if (!(await dealerCanBeDeletedByManager(managerUsername, dealerUsername))) return false;
  const pool = getBillingPool();
  const [res] = await pool.execute<ResultSetHeader>(
    "DELETE FROM users WHERE username = :u AND type = 'RSLR' LIMIT 1",
    { u: dealerUsername.trim() },
  );
  return res.affectedRows === 1;
}

export async function setDealerStatus(username: string, status: "A" | "S"): Promise<boolean> {
  const pool = getBillingPool();
  const [res] = await pool.execute<ResultSetHeader>(
    "UPDATE users SET status = :st WHERE username = :u AND type = 'RSLR' LIMIT 1",
    { st: status, u: username.trim() },
  );
  return res.affectedRows === 1;
}

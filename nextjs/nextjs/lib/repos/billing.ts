import type { RowDataPacket, ResultSetHeader } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { getBillingPool, getStalkerPool } from "@/lib/db/pool";
import { verifyPassword } from "@/lib/auth/password";
import {
  stalkerPasswordDigest,
  computeExpiryDatePhp,
  insertDebitLikePhp,
  buildMonthDeductionChargedMap,
} from "@/lib/repos/accountCreate";
import { getCreditBalance } from "@/lib/repos/creditBalance";
import {
  getStalkerCustomPackagePlanId,
  getStalkerUserDbIdByLogin,
  listStalkerPackagesForPlan,
  listStalkerUserSubscribedPackageIds,
} from "@/lib/repos/stalkerUserPackages";
import {
  HIERARCHY_ADD_CREDITS_MAX,
  HIERARCHY_RECOVER_CREDITS_MAX,
} from "@/lib/constants/hierarchyCredits";
import {
  computePromoBonusesForAdd,
  parsePromoTiersJson,
  PROMO_BONUS_P1_CONFIG_KEY,
  PROMO_BONUS_P2_CONFIG_KEY,
  type PromoTier,
  validatePromoTiers,
} from "@/lib/promoBonus";
import { randomUUID } from "node:crypto";
import { parseHierarchyGrantBaseCredits } from "@/lib/hierarchyGrantRemark";
import type { Pool } from "mysql2/promise";

export { getCreditBalance };
export { HIERARCHY_ADD_CREDITS_MAX, HIERARCHY_RECOVER_CREDITS_MAX };

const ACCOUNT_STATUS_ON = 0;
const ACCOUNT_STATUS_OFF = 1;

export type BillingUserRow = {
  id: number;
  name: string | null;
  username: string;
  password: string;
  type: string;
  username_owner: string | null;
  status: string;
  current_login_time: string | null;
};

function row<T extends RowDataPacket>(r: T[]): T | null {
  return r[0] ?? null;
}

import { formatMysqlDateTime, isBillingAccountExpired } from "@/lib/billingAccountExpiry";

export { formatMysqlDateTime, isBillingAccountExpired } from "@/lib/billingAccountExpiry";

function normalizeMacForStalker(mac: string) {
  return mac.trim().toUpperCase().replace(/-/g, ":");
}

async function stalkerCutOnOff(stalker: NonNullable<ReturnType<typeof getStalkerPool>>, uid: number, mode: "on" | "off") {
  const status = mode === "on" ? ACCOUNT_STATUS_ON : ACCOUNT_STATUS_OFF;
  const conn = await stalker.getConnection();
  try {
    await conn.execute("UPDATE users SET status = :s WHERE id = :id", { s: status, id: uid });
    const addtime = formatMysqlDateTime(new Date());
    const eventtime = formatMysqlDateTime(new Date(Date.now() + 4 * 60 * 1000));
    const event = mode === "on" ? "cut_on" : "cut_off";
    try {
      await conn.execute(
        `INSERT INTO events (uid, event, priority, addtime, eventtime) VALUES (:uid, :event, 1, :addtime, :eventtime)`,
        { uid, event, addtime, eventtime },
      );
    } catch {
      /* DBs without Ministra `events` table — `users.status` update still applies */
    }
  } finally {
    conn.release();
  }
}

export type AuthenticateRootResult =
  | { ok: true; user: BillingUserRow; previousLogin: string | null }
  | { ok: false; reason: "credentials" | "forbidden" };

export type AuthenticateBillingLoginResult =
  | { ok: true; user: BillingUserRow; previousLogin: string | null }
  | { ok: false; reason: "credentials" };

/**
 * Any active billing `users` row with password check (shared by admin + operator portals).
 */
export async function authenticateBillingLogin(username: string, password: string): Promise<AuthenticateBillingLoginResult> {
  const pool = getBillingPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, name, username, password, type, username_owner, status, current_login_time
     FROM users WHERE username = :u AND status = 'A' LIMIT 1`,
    { u: username },
  );
  const u = row(rows) as BillingUserRow | null;
  if (!u) return { ok: false, reason: "credentials" };
  if (!(await verifyPassword(password, u.password))) return { ok: false, reason: "credentials" };
  return { ok: true, user: u, previousLogin: u.current_login_time };
}

/**
 * ROOT-only check (e.g. server actions that must stay admin-only).
 * Non-ROOT accounts get `forbidden` so operators are not told "invalid credentials".
 */
export async function authenticateRoot(username: string, password: string): Promise<AuthenticateRootResult> {
  const r = await authenticateBillingLogin(username, password);
  if (!r.ok) return { ok: false, reason: "credentials" };
  if (r.user.type !== "ROOT") return { ok: false, reason: "forbidden" };
  return { ok: true, user: r.user, previousLogin: r.previousLogin };
}

export async function touchUserLogin(userId: number): Promise<void> {
  const pool = getBillingPool();
  await pool.execute(
    `UPDATE users SET last_login_time = current_login_time, current_login_time = NOW() WHERE id = :id`,
    { id: userId },
  );
}

export async function getDashboardStats() {
  const pool = getBillingPool();
  /** One round-trip — avoids grabbing many pool connections at once (MySQL “Too many connections” under dev/HMR). */
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT
       (SELECT COUNT(*) FROM accounts) AS total_users,
       (SELECT COUNT(*) FROM accounts WHERE status = ?) AS active_users,
       (SELECT COUNT(*) FROM accounts
         WHERE expires IS NOT NULL AND expires > '1970-01-01 00:00:00' AND expires < NOW()) AS expired_users,
       (SELECT COUNT(*) FROM users WHERE type = 'MNGR') AS total_mngr,
       (SELECT COUNT(*) FROM users WHERE type = 'SRSLR') AS total_srslr,
       (SELECT COUNT(*) FROM users WHERE type = 'RSLR') AS total_rslr`,
    [ACCOUNT_STATUS_ON],
  );
  const r = rows[0] ?? {};
  return {
    totalUsers: Number(r.total_users ?? 0),
    activeUsers: Number(r.active_users ?? 0),
    expiredUsers: Number(r.expired_users ?? 0),
    totalManagers: Number(r.total_mngr ?? 0),
    totalResellers: Number(r.total_srslr ?? 0),
    totalDealers: Number(r.total_rslr ?? 0),
  };
}

/** Admin managers index — PHP `admin/managers/index` table columns + delete eligibility. */
export type AdminManagerListRow = {
  username: string;
  name: string;
  password: string;
  status: string;
  resellerCount: number;
  /** RSLR rows under resellers owned by this manager. */
  dealerCount: number;
  /** Billing `accounts` rows owned by resellers or dealers in this manager’s tree. */
  subscriberCount: number;
  /** Active subscriber rows in manager tree (status on and not expired). */
  activeSubscriberCount: number;
  /** Expired subscriber rows in manager tree. */
  expiredSubscriberCount: number;
  credits: number;
  canDelete: boolean;
  /** Raw DB login timestamps (users.current_login_time / users.last_login_time). */
  currentLoginTime: string;
  lastLoginTime: string;
  /**
   * Latest activity: max of billing `users.last_login_time` / `current_login_time` (portal auth)
   * and newest `transactions.timestamp` anywhere under this manager (own login, resellers, dealers).
   */
  lastActive: string;
  /** Hover hint showing login vs billing sources. */
  lastActiveTitle?: string;
};

function parseBillingDateTime(raw: unknown): Date | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s === "0000-00-00 00:00:00" || s.startsWith("0000-00-00")) return null;
  const normalized = s.includes("T") ? s : s.replace(" ", "T");
  const t = Date.parse(normalized);
  if (Number.isNaN(t)) return null;
  return new Date(t);
}

function formatManagerLastActive(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const se = String(d.getSeconds()).padStart(2, "0");
  return `${y}-${mo}-${da} ${h}:${mi}:${se}`;
}

export async function getManagers(): Promise<AdminManagerListRow[]> {
  const pool = getBillingPool();
  /** One row per manager — avoids correlated subqueries (they time out on large hierarchies / serverless). */
  const [mgrRows] = await pool.execute<RowDataPacket[]>(
    `SELECT u.username, u.name, u.password, u.status, u.last_login_time, u.current_login_time
     FROM users u WHERE u.type = 'MNGR' ORDER BY u.username ASC`,
  );
  if (mgrRows.length === 0) return [];

  const usernames = mgrRows.map((r) => String(r.username));
  const ph = usernames.map(() => "?").join(",");

  const [resellerCountRows] = await pool.execute<RowDataPacket[]>(
    `SELECT username_owner AS manager_login, COUNT(*) AS c
     FROM users WHERE type = 'SRSLR' AND username_owner IN (${ph}) GROUP BY username_owner`,
    usernames,
  );
  const [dealerCountRows] = await pool.execute<RowDataPacket[]>(
    `SELECT r.username_owner AS manager_login, COUNT(*) AS c
     FROM users d
     INNER JOIN users r ON r.username = d.username_owner AND r.type = 'SRSLR'
     WHERE d.type = 'RSLR' AND r.username_owner IN (${ph}) GROUP BY r.username_owner`,
    usernames,
  );
  const [subResellerRows] = await pool.execute<RowDataPacket[]>(
    `SELECT sr.username_owner AS manager_login, COUNT(*) AS c
     FROM accounts a
     INNER JOIN users sr ON sr.username = a.username AND sr.type = 'SRSLR'
     WHERE sr.username_owner IN (${ph}) GROUP BY sr.username_owner`,
    usernames,
  );
  const [subDealerRows] = await pool.execute<RowDataPacket[]>(
    `SELECT r.username_owner AS manager_login, COUNT(*) AS c
     FROM accounts a
     INNER JOIN users d ON d.username = a.username AND d.type = 'RSLR'
     INNER JOIN users r ON r.username = d.username_owner AND r.type = 'SRSLR'
     WHERE r.username_owner IN (${ph}) GROUP BY r.username_owner`,
    usernames,
  );
  const [activeSubResellerRows] = await pool.execute<RowDataPacket[]>(
    `SELECT sr.username_owner AS manager_login, COUNT(*) AS c
     FROM accounts a
     INNER JOIN users sr ON sr.username = a.username AND sr.type = 'SRSLR'
     WHERE sr.username_owner IN (${ph})
       AND a.status = ?
       AND (a.expires IS NULL OR a.expires >= NOW())
     GROUP BY sr.username_owner`,
    [...usernames, ACCOUNT_STATUS_ON],
  );
  const [activeSubDealerRows] = await pool.execute<RowDataPacket[]>(
    `SELECT r.username_owner AS manager_login, COUNT(*) AS c
     FROM accounts a
     INNER JOIN users d ON d.username = a.username AND d.type = 'RSLR'
     INNER JOIN users r ON r.username = d.username_owner AND r.type = 'SRSLR'
     WHERE r.username_owner IN (${ph})
       AND a.status = ?
       AND (a.expires IS NULL OR a.expires >= NOW())
     GROUP BY r.username_owner`,
    [...usernames, ACCOUNT_STATUS_ON],
  );
  const [expiredSubResellerRows] = await pool.execute<RowDataPacket[]>(
    `SELECT sr.username_owner AS manager_login, COUNT(*) AS c
     FROM accounts a
     INNER JOIN users sr ON sr.username = a.username AND sr.type = 'SRSLR'
     WHERE sr.username_owner IN (${ph})
       AND a.expires IS NOT NULL
       AND a.expires < NOW()
     GROUP BY sr.username_owner`,
    usernames,
  );
  const [expiredSubDealerRows] = await pool.execute<RowDataPacket[]>(
    `SELECT r.username_owner AS manager_login, COUNT(*) AS c
     FROM accounts a
     INNER JOIN users d ON d.username = a.username AND d.type = 'RSLR'
     INNER JOIN users r ON r.username = d.username_owner AND r.type = 'SRSLR'
     WHERE r.username_owner IN (${ph})
       AND a.expires IS NOT NULL
       AND a.expires < NOW()
     GROUP BY r.username_owner`,
    usernames,
  );

  const [childRows] = await pool.execute<RowDataPacket[]>(
    `SELECT username_owner AS owner, COUNT(*) AS c FROM users WHERE username_owner IN (${ph}) GROUP BY username_owner`,
    usernames,
  );
  const [acctRows] = await pool.execute<RowDataPacket[]>(
    `SELECT username, COUNT(*) AS c FROM accounts WHERE username IN (${ph}) GROUP BY username`,
    usernames,
  );
  const [balRows] = await pool.execute<RowDataPacket[]>(
    `SELECT username,
        COALESCE(SUM(CASE WHEN type = 'CRDT' THEN periods ELSE -periods END), 0) AS balance
     FROM transactions WHERE username IN (${ph}) GROUP BY username`,
    usernames,
  );

  const resellerCountMap = new Map(resellerCountRows.map((r) => [String(r.manager_login), Number(r.c)]));
  const dealerCountMap = new Map(dealerCountRows.map((r) => [String(r.manager_login), Number(r.c)]));
  const subResellerMap = new Map(subResellerRows.map((r) => [String(r.manager_login), Number(r.c)]));
  const subDealerMap = new Map(subDealerRows.map((r) => [String(r.manager_login), Number(r.c)]));
  const activeSubResellerMap = new Map(activeSubResellerRows.map((r) => [String(r.manager_login), Number(r.c)]));
  const activeSubDealerMap = new Map(activeSubDealerRows.map((r) => [String(r.manager_login), Number(r.c)]));
  const expiredSubResellerMap = new Map(expiredSubResellerRows.map((r) => [String(r.manager_login), Number(r.c)]));
  const expiredSubDealerMap = new Map(expiredSubDealerRows.map((r) => [String(r.manager_login), Number(r.c)]));

  /** Latest billing txn time for manager + all SRSLR/RSLR in their tree (`transactions.username`). */
  let hierarchyTxRows: RowDataPacket[] = [];
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT x.manager_login, MAX(x.tx_time) AS last_tx
       FROM (
         SELECT m.username AS manager_login, t.\`timestamp\` AS tx_time
         FROM users m
         INNER JOIN transactions t ON t.username = m.username
         WHERE m.type = 'MNGR' AND m.username IN (${ph})
         UNION ALL
         SELECT sr.username_owner AS manager_login, t.\`timestamp\` AS tx_time
         FROM transactions t
         INNER JOIN users sr ON sr.username = t.username AND sr.type = 'SRSLR'
         WHERE sr.username_owner IN (${ph})
         UNION ALL
         SELECT r.username_owner AS manager_login, t.\`timestamp\` AS tx_time
         FROM transactions t
         INNER JOIN users d ON d.username = t.username AND d.type = 'RSLR'
         INNER JOIN users r ON r.username = d.username_owner AND r.type = 'SRSLR'
         WHERE r.username_owner IN (${ph})
       ) x
       GROUP BY x.manager_login`,
      [...usernames, ...usernames, ...usernames],
    );
    hierarchyTxRows = rows;
  } catch (err) {
    console.error("[getManagers] hierarchy last_tx query failed:", err);
  }

  const childMap = new Map(childRows.map((r) => [String(r.owner), Number(r.c)]));
  const acctMap = new Map(acctRows.map((r) => [String(r.username), Number(r.c)]));
  const balMap = new Map(balRows.map((r) => [String(r.username), Number(r.balance)]));
  const hierarchyLastTxMap = new Map(hierarchyTxRows.map((r) => [String(r.manager_login), r.last_tx]));

  return mgrRows.map((r) => {
    const username = String(r.username);
    const childCount = childMap.get(username) ?? 0;
    const acctCount = acctMap.get(username) ?? 0;
    const resellerCount = resellerCountMap.get(username) ?? 0;
    const dealerCount = dealerCountMap.get(username) ?? 0;
    const subscriberCount = (subResellerMap.get(username) ?? 0) + (subDealerMap.get(username) ?? 0);
    const activeSubscriberCount =
      (activeSubResellerMap.get(username) ?? 0) + (activeSubDealerMap.get(username) ?? 0);
    const expiredSubscriberCount =
      (expiredSubResellerMap.get(username) ?? 0) + (expiredSubDealerMap.get(username) ?? 0);

    const loginCandidates = [parseBillingDateTime(r.last_login_time), parseBillingDateTime(r.current_login_time)].filter(
      (d): d is Date => d != null,
    );
    const loginMax =
      loginCandidates.length > 0 ? new Date(Math.max(...loginCandidates.map((d) => d.getTime()))) : null;
    const billingActivity = parseBillingDateTime(hierarchyLastTxMap.get(username));

    const parts: Date[] = [];
    if (loginMax) parts.push(loginMax);
    if (billingActivity) parts.push(billingActivity);
    const overall = parts.length > 0 ? new Date(Math.max(...parts.map((d) => d.getTime()))) : null;

    let lastActive = "—";
    let lastActiveTitle: string | undefined;
    if (overall) {
      lastActive = formatManagerLastActive(overall);
      const hint: string[] = [];
      if (loginMax) hint.push(`Portal login: ${formatManagerLastActive(loginMax)}`);
      if (billingActivity) hint.push(`Billing (tree): ${formatManagerLastActive(billingActivity)}`);
      if (hint.length) lastActiveTitle = hint.join(" · ");
    }

    return {
      username,
      name: r.name != null ? String(r.name) : "",
      password: String(r.password ?? ""),
      status: String(r.status ?? "A"),
      resellerCount,
      dealerCount,
      subscriberCount,
      activeSubscriberCount,
      expiredSubscriberCount,
      credits: balMap.get(username) ?? 0,
      canDelete: childCount === 0 && acctCount === 0,
      currentLoginTime: r.current_login_time != null ? String(r.current_login_time) : "",
      lastLoginTime: r.last_login_time != null ? String(r.last_login_time) : "",
      lastActive,
      lastActiveTitle,
    };
  });
}

/** PHP `admin/Managers::delete` — block if any `users` child or `accounts` row references this username. */
export async function deleteAdminManager(username: string): Promise<boolean> {
  const pool = getBillingPool();
  const u = username.trim();
  if (!u) return false;
  const [[r1]] = await pool.execute<RowDataPacket[]>("SELECT COUNT(*) AS c FROM users WHERE username_owner = :u", { u });
  if (Number(r1?.c) > 0) return false;
  const [[r2]] = await pool.execute<RowDataPacket[]>("SELECT COUNT(*) AS c FROM accounts WHERE username = :u", { u });
  if (Number(r2?.c) > 0) return false;
  const [res] = await pool.execute<ResultSetHeader>(
    "DELETE FROM users WHERE username = :u AND type = 'MNGR' LIMIT 1",
    { u },
  );
  return res.affectedRows === 1;
}

export async function getManagerByUsername(username: string) {
  const pool = getBillingPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT username, name, password, status, comments FROM users WHERE type = 'MNGR' AND username = :u LIMIT 1`,
    { u: username },
  );
  const r = row(rows);
  if (!r) return null;
  const u = String(r.username);
  const [balRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COALESCE(SUM(CASE WHEN type = 'CRDT' THEN periods ELSE -periods END), 0) AS balance
     FROM transactions WHERE username = :u`,
    { u },
  );
  const credits = Number(balRows[0]?.balance ?? 0);
  const tx = await listTransactionsByUsername(u, 50);
  return {
    id: u,
    username: u,
    name: r.name != null ? String(r.name) : "",
    password: String(r.password ?? ""),
    status: String(r.status ?? "A"),
    comments: r.comments != null ? String(r.comments) : "",
    credits,
    transactions: tx,
  };
}

export async function insertManager(input: { name: string; username: string; password: string }) {
  const pool = getBillingPool();
  const [res] = await pool.execute<ResultSetHeader>(
    `INSERT INTO users (name, username, password, status, type) VALUES (:name, :username, :password, 'A', 'MNGR')`,
    { name: input.name, username: input.username, password: input.password },
  );
  return res.affectedRows === 1;
}

export async function updateManager(input: {
  username: string;
  name: string;
  password: string;
  status: string;
  comments: string;
}) {
  const pool = getBillingPool();
  const [res] = await pool.execute<ResultSetHeader>(
    `UPDATE users SET name = :name, password = :password, status = :status, comments = :comments, type = 'MNGR' WHERE username = :username AND type = 'MNGR'`,
    {
      username: input.username,
      name: input.name,
      password: input.password,
      status: input.status,
      comments: input.comments,
    },
  );
  return res.affectedRows === 1;
}

export async function listManagersForSelect() {
  const pool = getBillingPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT username, COALESCE(name, username) AS display_name FROM users WHERE type = 'MNGR' ORDER BY username ASC`,
  );
  return rows.map((r) => ({ username: String(r.username), name: String(r.display_name) }));
}

/** Admin resellers index — PHP `admin/resellers/index` + delete eligibility (`reseller_action_buttons`). */
export type AdminResellerListRow = {
  username: string;
  manager: string;
  name: string;
  password: string;
  status: string;
  dealerCount: number;
  activeUserCount: number;
  expiredUserCount: number;
  userCount: number;
  credits: number;
  canDelete: boolean;
  currentLoginTime: string;
  lastLoginTime: string;
  lastActive: string;
};

export async function getResellers(): Promise<AdminResellerListRow[]> {
  const pool = getBillingPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT u.username, u.name, u.password, u.status, u.username_owner AS manager, u.last_login_time, u.current_login_time,
      (SELECT COUNT(*) FROM users ch WHERE ch.username_owner = u.username AND ch.type = 'RSLR') AS dealer_count
     FROM users u WHERE u.type = 'SRSLR' ORDER BY u.username ASC`,
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

  const [subResellerRows] = await pool.execute<RowDataPacket[]>(
    `SELECT sr.username AS reseller_login, COUNT(*) AS c
     FROM accounts a
     INNER JOIN users sr ON sr.username = a.username AND sr.type = 'SRSLR'
     WHERE sr.username IN (${ph}) GROUP BY sr.username`,
    usernames,
  );
  const [subDealerRows] = await pool.execute<RowDataPacket[]>(
    `SELECT sr.username AS reseller_login, COUNT(*) AS c
     FROM accounts a
     INNER JOIN users d ON d.username = a.username AND d.type = 'RSLR'
     INNER JOIN users sr ON sr.username = d.username_owner AND sr.type = 'SRSLR'
     WHERE sr.username IN (${ph}) GROUP BY sr.username`,
    usernames,
  );
  const [activeSubResellerRows] = await pool.execute<RowDataPacket[]>(
    `SELECT sr.username AS reseller_login, COUNT(*) AS c
     FROM accounts a
     INNER JOIN users sr ON sr.username = a.username AND sr.type = 'SRSLR'
     WHERE sr.username IN (${ph})
       AND a.status = ?
       AND (a.expires IS NULL OR a.expires >= NOW())
     GROUP BY sr.username`,
    [...usernames, ACCOUNT_STATUS_ON],
  );
  const [activeSubDealerRows] = await pool.execute<RowDataPacket[]>(
    `SELECT sr.username AS reseller_login, COUNT(*) AS c
     FROM accounts a
     INNER JOIN users d ON d.username = a.username AND d.type = 'RSLR'
     INNER JOIN users sr ON sr.username = d.username_owner AND sr.type = 'SRSLR'
     WHERE sr.username IN (${ph})
       AND a.status = ?
       AND (a.expires IS NULL OR a.expires >= NOW())
     GROUP BY sr.username`,
    [...usernames, ACCOUNT_STATUS_ON],
  );
  const [expiredSubResellerRows] = await pool.execute<RowDataPacket[]>(
    `SELECT sr.username AS reseller_login, COUNT(*) AS c
     FROM accounts a
     INNER JOIN users sr ON sr.username = a.username AND sr.type = 'SRSLR'
     WHERE sr.username IN (${ph})
       AND a.expires IS NOT NULL
       AND a.expires < NOW()
     GROUP BY sr.username`,
    usernames,
  );
  const [expiredSubDealerRows] = await pool.execute<RowDataPacket[]>(
    `SELECT sr.username AS reseller_login, COUNT(*) AS c
     FROM accounts a
     INNER JOIN users d ON d.username = a.username AND d.type = 'RSLR'
     INNER JOIN users sr ON sr.username = d.username_owner AND sr.type = 'SRSLR'
     WHERE sr.username IN (${ph})
       AND a.expires IS NOT NULL
       AND a.expires < NOW()
     GROUP BY sr.username`,
    usernames,
  );

  const subResellerMap = new Map(subResellerRows.map((r) => [String(r.reseller_login), Number(r.c)]));
  const subDealerMap = new Map(subDealerRows.map((r) => [String(r.reseller_login), Number(r.c)]));
  const activeSubResellerMap = new Map(activeSubResellerRows.map((r) => [String(r.reseller_login), Number(r.c)]));
  const activeSubDealerMap = new Map(activeSubDealerRows.map((r) => [String(r.reseller_login), Number(r.c)]));
  const expiredSubResellerMap = new Map(expiredSubResellerRows.map((r) => [String(r.reseller_login), Number(r.c)]));
  const expiredSubDealerMap = new Map(expiredSubDealerRows.map((r) => [String(r.reseller_login), Number(r.c)]));

  return rows.map((r) => {
    const username = String(r.username);
    const dealerCount = Number(r.dealer_count ?? 0);
    const userCount = (subResellerMap.get(username) ?? 0) + (subDealerMap.get(username) ?? 0);
    const activeUserCount = (activeSubResellerMap.get(username) ?? 0) + (activeSubDealerMap.get(username) ?? 0);
    const expiredUserCount = (expiredSubResellerMap.get(username) ?? 0) + (expiredSubDealerMap.get(username) ?? 0);
    const loginCandidates = [parseBillingDateTime(r.last_login_time), parseBillingDateTime(r.current_login_time)].filter(
      (d): d is Date => d != null,
    );
    const loginMax =
      loginCandidates.length > 0 ? new Date(Math.max(...loginCandidates.map((d) => d.getTime()))) : null;
    return {
      username,
      manager: r.manager != null ? String(r.manager) : "",
      name: r.name != null ? String(r.name) : "",
      password: String(r.password ?? ""),
      status: String(r.status ?? "A"),
      dealerCount,
      activeUserCount,
      expiredUserCount,
      userCount,
      credits: balMap.get(username) ?? 0,
      canDelete: dealerCount === 0 && userCount === 0,
      currentLoginTime: r.current_login_time != null ? String(r.current_login_time) : "",
      lastLoginTime: r.last_login_time != null ? String(r.last_login_time) : "",
      lastActive: loginMax ? formatManagerLastActive(loginMax) : "—",
    };
  });
}

/** PHP `admin/Resellers::delete` — block if dealers under reseller or `accounts` rows owned by reseller. */
export async function deleteAdminReseller(username: string): Promise<boolean> {
  const pool = getBillingPool();
  const u = username.trim();
  if (!u) return false;
  const [r1Rows] = await pool.execute<RowDataPacket[]>("SELECT COUNT(*) AS c FROM users WHERE username_owner = :u", { u });
  if (Number(r1Rows[0]?.c ?? 0) > 0) return false;
  const [r2Rows] = await pool.execute<RowDataPacket[]>("SELECT COUNT(*) AS c FROM accounts WHERE username = :u", { u });
  if (Number(r2Rows[0]?.c ?? 0) > 0) return false;
  const [res] = await pool.execute<ResultSetHeader>(
    "DELETE FROM users WHERE username = :u AND type = 'SRSLR' LIMIT 1",
    { u },
  );
  return res.affectedRows === 1;
}

export async function getResellerByUsername(username: string) {
  const pool = getBillingPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT username, name, password, status, username_owner, comments FROM users WHERE type = 'SRSLR' AND username = :u LIMIT 1`,
    { u: username },
  );
  const r = row(rows);
  if (!r) return null;
  const un = String(r.username);
  const [balRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COALESCE(SUM(CASE WHEN type = 'CRDT' THEN periods ELSE -periods END), 0) AS balance
     FROM transactions WHERE username = :u`,
    { u: un },
  );
  const credits = Number(balRows[0]?.balance ?? 0);
  const tx = await listTransactionsByUsername(un, 50);
  return {
    id: un,
    name: r.name != null ? String(r.name) : "",
    username: un,
    password: String(r.password ?? ""),
    status: String(r.status ?? "A") as "A" | "S",
    manager: r.username_owner != null ? String(r.username_owner) : "",
    comments: r.comments != null ? String(r.comments) : "",
    credits,
    transactions: tx,
  };
}

export async function insertReseller(input: {
  name: string;
  username: string;
  password: string;
  manager: string;
}) {
  const pool = getBillingPool();
  const [res] = await pool.execute<ResultSetHeader>(
    `INSERT INTO users (name, username, password, status, type, username_owner) VALUES (:name, :username, :password, 'A', 'SRSLR', :manager)`,
    input,
  );
  return res.affectedRows === 1;
}

export async function updateReseller(input: {
  username: string;
  name: string;
  password: string;
  status: string;
  manager: string;
  comments: string;
}) {
  const pool = getBillingPool();
  const [res] = await pool.execute<ResultSetHeader>(
    `UPDATE users SET name = :name, password = :password, status = :status, comments = :comments, username_owner = :manager, type = 'SRSLR' WHERE username = :username AND type = 'SRSLR'`,
    input,
  );
  return res.affectedRows === 1;
}

/** Admin dealers index — PHP `admin/dealers/index` + `dealer_action_buttons` delete rule. */
export type AdminDealerListRow = {
  username: string;
  manager: string;
  reseller: string;
  name: string;
  password: string;
  status: string;
  activeUserCount: number;
  expiredUserCount: number;
  userCount: number;
  credits: number;
  canDelete: boolean;
  currentLoginTime: string;
  lastLoginTime: string;
  lastActive: string;
};

export async function getDealers(filter?: { resellerUsername?: string }): Promise<AdminDealerListRow[]> {
  const pool = getBillingPool();
  const reseller = filter?.resellerUsername?.trim();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT d.username, d.name, d.password, d.status, d.last_login_time, d.current_login_time, d.username_owner AS reseller_username,
            r.username_owner AS manager_username,
            (SELECT COUNT(*) FROM accounts a WHERE a.username = d.username) AS user_count
     FROM users d
     INNER JOIN users r ON r.username = d.username_owner AND r.type = 'SRSLR'
     WHERE d.type = 'RSLR'${reseller ? " AND r.username = :reseller" : ""}
     ORDER BY d.username ASC`,
    reseller ? { reseller } : {},
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

  const [activeRows] = await pool.execute<RowDataPacket[]>(
    `SELECT a.username AS dealer_login, COUNT(*) AS c
     FROM accounts a
     WHERE a.username IN (${ph})
       AND a.status = ?
       AND (a.expires IS NULL OR a.expires >= NOW())
     GROUP BY a.username`,
    [...usernames, ACCOUNT_STATUS_ON],
  );
  const [expiredRows] = await pool.execute<RowDataPacket[]>(
    `SELECT a.username AS dealer_login, COUNT(*) AS c
     FROM accounts a
     WHERE a.username IN (${ph})
       AND a.expires IS NOT NULL
       AND a.expires < NOW()
     GROUP BY a.username`,
    usernames,
  );
  const activeMap = new Map(activeRows.map((r) => [String(r.dealer_login), Number(r.c)]));
  const expiredMap = new Map(expiredRows.map((r) => [String(r.dealer_login), Number(r.c)]));

  return rows.map((r) => {
    const username = String(r.username);
    const userCount = Number(r.user_count ?? 0);
    const activeUserCount = activeMap.get(username) ?? 0;
    const expiredUserCount = expiredMap.get(username) ?? 0;
    const loginCandidates = [parseBillingDateTime(r.last_login_time), parseBillingDateTime(r.current_login_time)].filter(
      (d): d is Date => d != null,
    );
    const loginMax =
      loginCandidates.length > 0 ? new Date(Math.max(...loginCandidates.map((d) => d.getTime()))) : null;
    return {
      username,
      manager: r.manager_username != null ? String(r.manager_username) : "",
      reseller: r.reseller_username != null ? String(r.reseller_username) : "",
      name: r.name != null ? String(r.name) : "",
      password: String(r.password ?? ""),
      status: String(r.status ?? "A"),
      activeUserCount,
      expiredUserCount,
      userCount,
      credits: balMap.get(username) ?? 0,
      canDelete: userCount === 0,
      currentLoginTime: r.current_login_time != null ? String(r.current_login_time) : "",
      lastLoginTime: r.last_login_time != null ? String(r.last_login_time) : "",
      lastActive: loginMax ? formatManagerLastActive(loginMax) : "—",
    };
  });
}

/** PHP `admin/Dealers::delete` — block if any `accounts` rows owned by this dealer (`has_users`). */
export async function deleteAdminDealer(username: string): Promise<boolean> {
  const pool = getBillingPool();
  const u = username.trim();
  if (!u) return false;
  const [cntRows] = await pool.execute<RowDataPacket[]>("SELECT COUNT(*) AS c FROM accounts WHERE username = :u", { u });
  if (Number(cntRows[0]?.c ?? 0) > 0) return false;
  const [res] = await pool.execute<ResultSetHeader>(
    "DELETE FROM users WHERE username = :u AND type = 'RSLR' LIMIT 1",
    { u },
  );
  return res.affectedRows === 1;
}

export async function getDealerByUsername(username: string) {
  const pool = getBillingPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT d.username, d.name, d.password, d.status, d.username_owner AS reseller_username, d.comments, d.tickets_enable,
            sr.username_owner AS manager_username
     FROM users d
     LEFT JOIN users sr ON sr.username = d.username_owner AND sr.type = 'SRSLR'
     WHERE d.type = 'RSLR' AND d.username = :u LIMIT 1`,
    { u: username },
  );
  const r = row(rows);
  if (!r) return null;
  const un = String(r.username);
  const [balRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COALESCE(SUM(CASE WHEN type = 'CRDT' THEN periods ELSE -periods END), 0) AS balance
     FROM transactions WHERE username = :u`,
    { u: un },
  );
  const credits = Number(balRows[0]?.balance ?? 0);
  const tx = await listTransactionsByUsername(un, 50);
  const te = r.tickets_enable != null ? Number(r.tickets_enable) : 0;
  return {
    id: un,
    name: r.name != null ? String(r.name) : "",
    username: un,
    passwordPlaceholder: String(r.password ?? ""),
    status: String(r.status ?? "A") as "A" | "S",
    reseller: r.reseller_username != null ? String(r.reseller_username) : "",
    manager: r.manager_username != null ? String(r.manager_username) : "",
    ticketsManager: te ? "Yes" : "No",
    tickets_enable: te,
    comments: r.comments != null ? String(r.comments) : "",
    credits,
    transactions: tx,
  };
}

export async function listResellersForSelect() {
  const pool = getBillingPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT username, COALESCE(name, username) AS display_name FROM users WHERE type = 'SRSLR' ORDER BY username ASC`,
  );
  return rows.map((r) => ({ username: String(r.username), name: String(r.display_name) }));
}

export async function listDealersForReseller(resellerUsername: string) {
  const pool = getBillingPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT username, COALESCE(name, username) AS display_name FROM users WHERE type = 'RSLR' AND username_owner = :r ORDER BY username ASC`,
    { r: resellerUsername },
  );
  return rows.map((r) => ({ username: String(r.username), name: String(r.display_name) }));
}

/** Parent reseller login for a dealer (`users.username_owner` where `type = 'RSLR'`). */
export async function getResellerUsernameForDealer(dealerUsername: string): Promise<string | null> {
  const pool = getBillingPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT username_owner AS r FROM users WHERE type = 'RSLR' AND username = :d LIMIT 1`,
    { d: dealerUsername.trim() },
  );
  const v = rows[0]?.r;
  return v != null && String(v).trim() !== "" ? String(v).trim() : null;
}

export async function insertDealer(input: {
  name: string;
  username: string;
  password: string;
  username_owner: string;
  tickets_enable: number;
}) {
  const pool = getBillingPool();
  const [res] = await pool.execute<ResultSetHeader>(
    `INSERT INTO users (name, username, password, status, type, username_owner, tickets_enable) VALUES (:name, :username, :password, 'A', 'RSLR', :username_owner, :tickets_enable)`,
    input,
  );
  return res.affectedRows === 1;
}

export async function updateDealer(input: {
  username: string;
  name: string;
  password: string;
  status: string;
  username_owner: string;
  tickets_enable: number;
  comments: string;
}) {
  const pool = getBillingPool();
  const [res] = await pool.execute<ResultSetHeader>(
    `UPDATE users SET name = :name, password = :password, status = :status, username_owner = :username_owner, tickets_enable = :tickets_enable, comments = :comments, type = 'RSLR' WHERE username = :username AND type = 'RSLR'`,
    input,
  );
  return res.affectedRows === 1;
}

export type AdjustHierarchyCreditsResult =
  | { ok: true }
  | {
      ok: false;
      code: "invalid" | "no_target" | "no_owner" | "insufficient_credits" | "db";
      balance?: number;
      required?: number;
    };

async function nextTransactionNumber(conn: PoolConnection, username: string): Promise<number> {
  const [[row]] = await conn.execute<RowDataPacket[]>(
    "SELECT COALESCE(MAX(`transaction`), 0) + 1 AS n FROM transactions WHERE username = :u",
    { u: username },
  );
  return Number(row?.n ?? 1);
}

function mysqlErrno(err: unknown): number | undefined {
  return (err as { errno?: number })?.errno;
}

function mysqlMessage(err: unknown): string {
  return String((err as Error)?.message ?? err ?? "");
}

/** 1054 — column missing (strict mode). */
function isMysqlUnknownColumn(err: unknown, column: string): boolean {
  if (mysqlErrno(err) !== 1054) return false;
  return mysqlMessage(err).includes(column);
}

/** 1364 — NOT NULL column with no default on INSERT. */
function isMysqlNoDefaultForField(err: unknown, column: string): boolean {
  if (mysqlErrno(err) !== 1364) return false;
  return mysqlMessage(err).includes(column);
}

/** 1406 — value longer than column allows (`configs.value` often VARCHAR in legacy billing DBs). */
function isMysqlDataTooLongForColumn(err: unknown): boolean {
  const n = mysqlErrno(err);
  if (n === 1406) return true;
  const msg = mysqlMessage(err).toLowerCase();
  return msg.includes("data too long for column") || msg.includes("too long for column");
}

/** Set once after a successful widen so we do not ALTER on every request. */
let configsValueColumnKnownWide = false;

async function widenConfigsValueColumnToMediumText(conn: PoolConnection): Promise<boolean> {
  if (configsValueColumnKnownWide) return true;
  try {
    await conn.execute("ALTER TABLE configs MODIFY COLUMN `value` MEDIUMTEXT");
    configsValueColumnKnownWide = true;
    return true;
  } catch (e) {
    console.error("[billing] ALTER configs.value → MEDIUMTEXT failed:", mysqlMessage(e));
    return false;
  }
}

/** 1146 — referenced table does not exist (e.g. stripped Ministra / backup DB without `events`). */
function isMysqlNoSuchTable(err: unknown): boolean {
  return mysqlErrno(err) === 1146;
}

/** Ministra device messaging uses `events`; some DB dumps omit it. */
async function stalkerHasEventsTable(stalker: NonNullable<ReturnType<typeof getStalkerPool>>): Promise<boolean> {
  try {
    await stalker.execute("SELECT 1 FROM `events` LIMIT 1");
    return true;
  } catch (e) {
    if (isMysqlNoSuchTable(e)) return false;
    return true;
  }
}

/** For admin/portal message UX when `broadcastStalkerMessage` returns 0. */
export async function stalkerEventsMessagingReady(): Promise<"no_pool" | "no_events" | "ok"> {
  const stalker = getStalkerPool();
  if (!stalker) return "no_pool";
  if (!(await stalkerHasEventsTable(stalker))) return "no_events";
  return "ok";
}

/**
 * Admin / hierarchy credit lines (`credit_manage_admin` parity). Many billing DBs require
 * `user_transaction` (and sometimes `amount`) on `transactions`; legacy schemas omit them.
 */
async function insertHierarchyCreditTransaction(
  conn: PoolConnection,
  input: {
    username: string;
    type: "CRDT" | "DBIT";
    periods: number;
    remarks: string;
    account?: string;
  },
) {
  const tx = await nextTransactionNumber(conn, input.username);
  const account =
    input.account != null && String(input.account).trim() !== "" ? String(input.account).trim() : null;
  const base = {
    username: input.username,
    type: input.type,
    transaction: tx,
    periods: input.periods,
    timestamp: formatMysqlDateTime(new Date()),
    remarks: input.remarks,
    account,
  };

  const legacySql = `INSERT INTO transactions (username, type, \`transaction\`, periods, \`timestamp\`, coverage_start, coverage_end, remarks, free_month, account)
     VALUES (:username, :type, :transaction, :periods, :timestamp, NULL, NULL, :remarks, 0, :account)`;

  const withUserTxSql = `INSERT INTO transactions (username, type, \`transaction\`, periods, \`timestamp\`, coverage_start, coverage_end, remarks, free_month, user_transaction, account)
     VALUES (:username, :type, :transaction, :periods, :timestamp, NULL, NULL, :remarks, 0, :user_transaction, :account)`;

  const withUserTxAmountSql = `INSERT INTO transactions (username, type, \`transaction\`, periods, \`timestamp\`, coverage_start, coverage_end, remarks, free_month, user_transaction, amount, account)
     VALUES (:username, :type, :transaction, :periods, :timestamp, NULL, NULL, :remarks, 0, :user_transaction, :amount, :account)`;

  try {
    await conn.execute(withUserTxSql, { ...base, user_transaction: 0 });
    return;
  } catch (e) {
    if (isMysqlUnknownColumn(e, "user_transaction") || isMysqlUnknownColumn(e, "'user_transaction'")) {
      await conn.execute(legacySql, base);
      return;
    }
    if (isMysqlNoDefaultForField(e, "amount") || isMysqlNoDefaultForField(e, "'amount'")) {
      try {
        await conn.execute(withUserTxAmountSql, { ...base, user_transaction: 0, amount: 0 });
        return;
      } catch (e2) {
        if (isMysqlUnknownColumn(e2, "amount") || isMysqlUnknownColumn(e2, "'amount'")) throw e;
        throw e2;
      }
    }
    throw e;
  }
}

async function loadRecoverConsumedGrantIds(conn: Pool | PoolConnection, username: string): Promise<Set<number>> {
  const [rows] = await conn.execute<RowDataPacket[]>(
    `SELECT remarks FROM transactions WHERE username = :u AND type = 'DBIT' AND remarks LIKE :hint`,
    { u: username, hint: "%recover_of_tx:%" },
  );
  const out = new Set<number>();
  for (const row of rows) {
    const text = String(row.remarks ?? "");
    const re = /\[recover_of_tx:(\d+)\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const n = Math.floor(Number(m[1]));
      if (Number.isFinite(n) && n >= 1) out.add(n);
    }
  }
  return out;
}

/**
 * Oldest unconsumed hierarchy CRDT grant whose `(base P)` matches principal; debit full `periods` (principal + promos).
 */
async function findFifoHierarchyGrantMatch(
  conn: Pool | PoolConnection,
  creditUsername: string,
  principal: number,
): Promise<{ periods: number; grantTransactionId: number } | null> {
  const consumed = await loadRecoverConsumedGrantIds(conn, creditUsername);
  const [rows] = await conn.execute<RowDataPacket[]>(
    `SELECT \`transaction\` AS txno, periods, remarks FROM transactions
     WHERE username = :u AND type = 'CRDT' AND remarks LIKE :hint
     ORDER BY \`timestamp\` ASC`,
    { u: creditUsername, hint: "%(base %" },
  );
  for (const row of rows) {
    const tid = Math.floor(Number(row.txno));
    if (!Number.isFinite(tid) || tid < 1) continue;
    if (consumed.has(tid)) continue;
    const base = parseHierarchyGrantBaseCredits(row.remarks != null ? String(row.remarks) : "");
    if (base !== principal) continue;
    const p = Math.floor(Number(row.periods));
    if (!Number.isFinite(p) || p < principal) continue;
    return { periods: p, grantTransactionId: tid };
  }
  return null;
}

/** Recover debit for UI preview: FIFO grant total if `(base principal)` matches, else principal only. */
export async function previewHierarchyRecoverDebit(input: {
  creditUsername: string;
  principal: number;
}): Promise<{ debitTotal: number; matchedGrantTxId: number | null }> {
  const pool = getBillingPool();
  const principal = Math.floor(Number(input.principal));
  const u = input.creditUsername.trim();
  if (!u || !Number.isFinite(principal) || principal < 1) {
    return { debitTotal: 0, matchedGrantTxId: null };
  }
  const match = await findFifoHierarchyGrantMatch(pool, u, principal);
  if (match) return { debitTotal: match.periods, matchedGrantTxId: match.grantTransactionId };
  return { debitTotal: principal, matchedGrantTxId: null };
}

/**
 * Admin → manager credit posting (`Managers::transactions` + `credit_manage_admin` with sender = logged-in admin).
 * ADD: no balance check on admin (PHP `check_credits` returns true for CRDT).
 * RECOVER: manager balance must cover the debit (PHP `check_credits` for DBIT).
 */
export async function adjustManagerCredits(input: {
  adminUsername: string;
  managerUsername: string;
  operation: "ADD" | "RECOVER";
  credits: number;
  operatorUsername: string;
}): Promise<AdjustHierarchyCreditsResult> {
  const manager = input.managerUsername.trim();
  const admin = input.adminUsername.trim();
  const credits = Math.floor(Number(input.credits));
  const settings = await getSettings();
  const addMax = hierarchyAddCreditsMax(settings);
  const addMin = hierarchyAddCreditsMin("admin_manager", settings);
  if (!manager) return { ok: false, code: "no_target" };
  if (!admin) return { ok: false, code: "no_owner" };
  if (input.operation === "ADD") {
    if (!Number.isFinite(credits) || credits < addMin || credits > addMax) return { ok: false, code: "invalid" };
  } else if (!Number.isFinite(credits) || credits < 1 || credits > HIERARCHY_RECOVER_CREDITS_MAX) {
    return { ok: false, code: "invalid" };
  }

  const pool = getBillingPool();
  const [targets] = await pool.execute<RowDataPacket[]>(
    "SELECT username FROM users WHERE username = :u AND type = 'MNGR' LIMIT 1",
    { u: manager },
  );
  if (!targets.length) return { ok: false, code: "no_target" };

  let recoverDebitTotal = credits;
  let recoverGrantTxId: number | null = null;
  if (input.operation === "RECOVER") {
    const match = await findFifoHierarchyGrantMatch(pool, manager, credits);
    if (match) {
      recoverDebitTotal = match.periods;
      recoverGrantTxId = match.grantTransactionId;
    }
    const balance = await getCreditBalance(manager);
    if (balance < recoverDebitTotal) return { ok: false, code: "insufficient_credits", balance, required: recoverDebitTotal };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (input.operation === "ADD") {
      const rules = await getPromoBonusRules();
      const activeClients = await countActiveClientsForPromo2({ kind: "MNGR", username: manager });
      const { pct1, pct2, bonus1, bonus2 } = computePromoBonusesForAdd(credits, activeClients, rules.p1, rules.p2);
      const totalCredited = credits + bonus1 + bonus2;
      const grantSuffix =
        bonus1 + bonus2 > 0
          ? ` [promo_grant:${randomUUID()}|p1=${bonus1}|p2=${bonus2}|pct1=${pct1}|pct2=${pct2}|ac=${activeClients}]`
          : "";
      const remarksAdmin =
        bonus1 + bonus2 > 0
          ? `${manager} received ${credits} credits +${bonus1} Promo1 (${pct1}%) +${bonus2} Promo2 (${pct2}%) = ${totalCredited}${grantSuffix}`
          : `${manager} received ${credits} credits`;
      await insertHierarchyCreditTransaction(conn, {
        username: admin,
        type: "DBIT",
        periods: totalCredited,
        account: manager,
        remarks: remarksAdmin.length > 480 ? `${remarksAdmin.slice(0, 477)}...` : remarksAdmin,
      });
      await insertHierarchyCreditTransaction(conn, {
        username: manager,
        type: "CRDT",
        periods: totalCredited,
        remarks: `${totalCredited} credits received by ${input.operatorUsername} (base ${credits})`,
      });
    } else {
      const dr = recoverDebitTotal;
      const base = credits;
      const op = input.operatorUsername;
      const txTag = recoverGrantTxId != null ? ` [recover_of_tx:${recoverGrantTxId}]` : "";
      const mgrRemark =
        recoverGrantTxId != null
          ? dr > base
            ? `${dr} credits recovered (${base} base)${txTag} by ${op}`
            : `${dr} credits recovered${txTag} by ${op}`
          : `${dr} credits recovered by ${op}`;
      const admRemark =
        recoverGrantTxId != null
          ? dr > base
            ? `${dr} credits recovered from ${manager} (${base} base)${txTag}`
            : `${dr} credits recovered from ${manager}${txTag}`
          : `${dr} credits recovered from ${manager}`;
      await insertHierarchyCreditTransaction(conn, {
        username: manager,
        type: "DBIT",
        periods: dr,
        remarks: mgrRemark,
      });
      await insertHierarchyCreditTransaction(conn, {
        username: admin,
        type: "CRDT",
        periods: dr,
        account: manager,
        remarks: admRemark,
      });
    }
    await conn.commit();
    return { ok: true };
  } catch (err) {
    await conn.rollback();
    console.error("[adjustManagerCredits] DB error:", mysqlMessage(err));
    return { ok: false, code: "db" };
  } finally {
    conn.release();
  }
}

/** PHP reseller/dealer credit modals — ADD select runs from `limit_*_credit` through 5000; RECOVER is numeric min 1. */

export type HierarchyCreditsPortal =
  | "admin_manager"
  | "admin_reseller"
  | "admin_dealer"
  | "manager_reseller"
  | "manager_dealer"
  | "reseller_dealer";

/** PHP `limit_reseller_credit` / `limit_dealer_credit` as the lower bound of the ADD credits range (capped at 5000). */
export function hierarchyAddCreditsMin(
  portal: HierarchyCreditsPortal,
  settings: Pick<SettingsBundle, "limitManagerCredit" | "limitResellerCredit" | "limitDealerCredit" | "hierarchyAddCreditMax">,
): number {
  const maxAllowed = hierarchyAddCreditsMax(settings);
  const parseCap = (raw: string) => {
    const n = Math.floor(Number.parseInt(String(raw).trim(), 10));
    if (!Number.isFinite(n) || n < 1) return null;
    return Math.min(maxAllowed, n);
  };

  if (portal === "admin_manager") {
    const v = parseCap(settings.limitManagerCredit);
    if (v != null) return v;
    return 1;
  }
  if (portal === "admin_reseller" || portal === "manager_reseller") {
    const v = parseCap(settings.limitResellerCredit);
    if (v != null) return v;
    return portal === "manager_reseller" ? 1 : 2000;
  }
  const v = parseCap(settings.limitDealerCredit);
  if (v != null) return v;
  return portal === "reseller_dealer" ? 1 : 2000;
}

export function hierarchyAddCreditsMax(
  settings: Pick<SettingsBundle, "hierarchyAddCreditMax">,
): number {
  const n = Math.floor(Number.parseInt(String(settings.hierarchyAddCreditMax).trim(), 10));
  if (!Number.isFinite(n) || n < 1) return HIERARCHY_ADD_CREDITS_MAX;
  return Math.min(HIERARCHY_ADD_CREDITS_MAX, n);
}

/**
 * Admin credit transfer parity for reseller/dealer edit screens (`transactions` actions in PHP controllers).
 * ADD: owner DBIT (to target) + target CRDT.
 * RECOVER: target DBIT + owner CRDT (from target).
 */
export async function adjustHierarchyCredits(input: {
  targetUsername: string;
  targetType: "SRSLR" | "RSLR";
  operation: "ADD" | "RECOVER";
  credits: number;
  operatorUsername: string;
  portal: HierarchyCreditsPortal;
}): Promise<AdjustHierarchyCreditsResult> {
  const target = input.targetUsername.trim();
  const credits = Math.floor(Number(input.credits));
  if (!target) return { ok: false, code: "no_target" };

  const settings = await getSettings();
  const addMin = hierarchyAddCreditsMin(input.portal, settings);
  const addMax = hierarchyAddCreditsMax(settings);
  if (input.operation === "ADD") {
    if (!Number.isFinite(credits) || credits < addMin || credits > addMax) {
      return { ok: false, code: "invalid" };
    }
  } else if (!Number.isFinite(credits) || credits < 1 || credits > HIERARCHY_RECOVER_CREDITS_MAX) {
    return { ok: false, code: "invalid" };
  }

  const pool = getBillingPool();
  const [targets] = await pool.execute<RowDataPacket[]>(
    "SELECT username, username_owner FROM users WHERE username = :u AND type = :t LIMIT 1",
    { u: target, t: input.targetType },
  );
  if (!targets.length) return { ok: false, code: "no_target" };
  const owner = targets[0].username_owner != null ? String(targets[0].username_owner) : "";
  if (!owner) return { ok: false, code: "no_owner" };

  const balanceUsername = input.operation === "ADD" ? owner : target;
  let addTotalCredited = credits;
  let addPct1 = 0;
  let addPct2 = 0;
  let addBonus1 = 0;
  let addBonus2 = 0;
  let addActiveClients = 0;
  if (input.operation === "ADD") {
    const rules = await getPromoBonusRules();
    const promoKind = input.targetType === "SRSLR" ? "SRSLR" : "RSLR";
    addActiveClients = await countActiveClientsForPromo2({ kind: promoKind, username: target });
    const b = computePromoBonusesForAdd(credits, addActiveClients, rules.p1, rules.p2);
    addPct1 = b.pct1;
    addPct2 = b.pct2;
    addBonus1 = b.bonus1;
    addBonus2 = b.bonus2;
    addTotalCredited = credits + addBonus1 + addBonus2;
  }
  let recoverDebitTotal = credits;
  let recoverGrantTxId: number | null = null;
  if (input.operation === "RECOVER") {
    const match = await findFifoHierarchyGrantMatch(pool, target, credits);
    if (match) {
      recoverDebitTotal = match.periods;
      recoverGrantTxId = match.grantTransactionId;
    }
  }
  const debitAmount = input.operation === "ADD" ? addTotalCredited : recoverDebitTotal;
  const balance = await getCreditBalance(balanceUsername);
  if (balance < debitAmount) return { ok: false, code: "insufficient_credits", balance, required: debitAmount };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (input.operation === "ADD") {
      const bonus1 = addBonus1;
      const bonus2 = addBonus2;
      const pct1 = addPct1;
      const pct2 = addPct2;
      const activeClients = addActiveClients;
      const totalCredited = addTotalCredited;
      const grantSuffix =
        bonus1 + bonus2 > 0
          ? ` [promo_grant:${randomUUID()}|p1=${bonus1}|p2=${bonus2}|pct1=${pct1}|pct2=${pct2}|ac=${activeClients}]`
          : "";
      const remarksOwner =
        bonus1 + bonus2 > 0
          ? `${target} received ${credits} credits +${bonus1} Promo1 (${pct1}%) +${bonus2} Promo2 (${pct2}%) = ${totalCredited}${grantSuffix}`
          : `${target} received ${credits} credits`;
      await insertHierarchyCreditTransaction(conn, {
        username: owner,
        type: "DBIT",
        periods: totalCredited,
        account: target,
        remarks: remarksOwner.length > 480 ? `${remarksOwner.slice(0, 477)}...` : remarksOwner,
      });
      await insertHierarchyCreditTransaction(conn, {
        username: target,
        type: "CRDT",
        periods: totalCredited,
        remarks: `${totalCredited} credits received by ${input.operatorUsername} (base ${credits})`,
      });
    } else {
      const dr = recoverDebitTotal;
      const base = credits;
      const op = input.operatorUsername;
      const txTag = recoverGrantTxId != null ? ` [recover_of_tx:${recoverGrantTxId}]` : "";
      const tgtRemark =
        recoverGrantTxId != null
          ? dr > base
            ? `${dr} credits recovered (${base} base)${txTag} by ${op}`
            : `${dr} credits recovered${txTag} by ${op}`
          : `${dr} credits recovered by ${op}`;
      const ownRemark =
        recoverGrantTxId != null
          ? dr > base
            ? `${dr} credits recovered from ${target} (${base} base)${txTag}`
            : `${dr} credits recovered from ${target}${txTag}`
          : `${dr} credits recovered from ${target}`;
      await insertHierarchyCreditTransaction(conn, {
        username: target,
        type: "DBIT",
        periods: dr,
        remarks: tgtRemark,
      });
      await insertHierarchyCreditTransaction(conn, {
        username: owner,
        type: "CRDT",
        periods: dr,
        account: target,
        remarks: ownRemark,
      });
    }
    await conn.commit();
    return { ok: true };
  } catch (err) {
    await conn.rollback();
    console.error("[adjustHierarchyCredits] DB error:", mysqlMessage(err));
    return { ok: false, code: "db" };
  } finally {
    conn.release();
  }
}

export async function getUsersSummary() {
  const pool = getBillingPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT
       COUNT(*) AS all_cnt,
       SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS active_cnt,
       SUM(CASE WHEN expires IS NOT NULL AND expires > '1970-01-01 00:00:00' AND expires < NOW() THEN 1 ELSE 0 END) AS expired_cnt,
       SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS inactive_cnt
     FROM accounts`,
    [ACCOUNT_STATUS_ON, ACCOUNT_STATUS_OFF],
  );
  const r = rows[0] ?? {};
  return {
    all: Number(r.all_cnt ?? 0),
    active: Number(r.active_cnt ?? 0),
    expired: Number(r.expired_cnt ?? 0),
    inactive: Number(r.inactive_cnt ?? 0),
  };
}

export type AccountListRow = {
  account: string;
  username: string;
  full_name: string | null;
  mac: string | null;
  ip: string | null;
  phone: string | null;
  expires: string | null;
  status: number;
  autoRenew: boolean | null;
  manager: string;
  reseller: string;
  dealer: string;
  password: string;
  created: string | null;
  /** Billing `accounts.last_active` (source of truth for subscriber last activity). */
  lastActive: string | null;
  /** Stalker `tariff_plan` name for `users.login` = account; null when unknown or Stalker off. */
  packageName: string | null;
  /** Stalker `keep_alive` window; null when Stalker unavailable or no row. */
  receiverOnline: boolean | null;
  /** Raw Stalker `users.keep_alive`; null when Stalker unavailable or no row. */
  receiverKeepAlive: string | null;
};

type AccountScope = { ownerType: "ROOT" | "MNGR" | "SRSLR" | "RSLR"; ownerUsername: string };

function accountScopeWhereClause(scope: AccountScope): { sql: string; params: unknown[] } {
  const owner = scope.ownerUsername.trim();
  if (scope.ownerType === "ROOT") return { sql: "1=1", params: [] };
  if (!owner) return { sql: "1=0", params: [] };
  if (scope.ownerType === "MNGR") {
    return {
      sql: "(ur1.username_owner = ? OR ur2.username_owner = ?)",
      params: [owner, owner],
    };
  }
  if (scope.ownerType === "SRSLR") {
    return {
      sql: "(a.username = ? OR ur1.username = ? OR ur2.username = ?)",
      params: [owner, owner, owner],
    };
  }
  return {
    sql: "(ud.username = ? OR a.username = ?)",
    params: [owner, owner],
  };
}

/** Active subscriber rows under scope: status on and not expired (Promo 2 client-count axis). */
export async function countActiveClientsForPromo2(scope: { kind: "MNGR" | "SRSLR" | "RSLR"; username: string }): Promise<number> {
  const u = scope.username.trim();
  if (!u) return 0;
  const { sql, params } = accountScopeWhereClause({ ownerType: scope.kind, ownerUsername: u });
  const pool = getBillingPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c
     FROM accounts a
     LEFT JOIN users ud ON ud.username = a.username AND ud.type = 'RSLR'
     LEFT JOIN users ur1 ON ur1.username = ud.username_owner AND ur1.type = 'SRSLR'
     LEFT JOIN users ur2 ON ur2.username = a.username AND ur2.type = 'SRSLR' AND ud.username IS NULL
     WHERE ${sql} AND a.status = ? AND (a.expires IS NULL OR a.expires >= NOW())`,
    [...params, ACCOUNT_STATUS_ON],
  );
  return Number(rows[0]?.c ?? 0);
}

function accountListWhereClause(
  status: string | undefined | null,
  search: string | undefined | null,
  autoRenew: string | undefined | null,
): { sql: string; params: unknown[] } {
  const parts: string[] = ["1=1"];
  const params: unknown[] = [];
  const s = typeof status === "string" ? status.trim().toLowerCase() : undefined;
  if (s === "active") {
    parts.push("a.status = ?");
    params.push(ACCOUNT_STATUS_ON);
  } else if (s === "expired") {
    parts.push("(a.expires IS NOT NULL AND a.expires > ? AND a.expires < NOW())");
    params.push("1970-01-01 00:00:00");
  } else if (s === "inactive") {
    parts.push("a.status = ?");
    params.push(ACCOUNT_STATUS_OFF);
  } else if (s === "expiring") {
    parts.push(
      "a.status = ? AND a.expires IS NOT NULL AND a.expires > NOW() AND a.expires <= DATE_ADD(NOW(), INTERVAL 7 DAY)",
    );
    params.push(ACCOUNT_STATUS_ON);
  } else if (s === "expiry") {
    /** Dashboard “Expiry” donut: expired by date OR expiring within 7 days (status on). */
    parts.push(
      "(" +
        "(a.expires IS NOT NULL AND a.expires > ? AND a.expires < NOW())" +
        " OR " +
        "(a.status = ? AND a.expires IS NOT NULL AND a.expires > NOW() AND a.expires <= DATE_ADD(NOW(), INTERVAL 7 DAY))" +
        ")",
    );
    params.push("1970-01-01 00:00:00", ACCOUNT_STATUS_ON);
  } else if (s === "activity") {
    /** Dashboard “Activity” donut: inactive (off) OR status-on excluding only the expiring-soon window (matches activeNonExpiring + inactive). */
    parts.push(
      "(" +
        "(a.status = ?)" +
        " OR " +
        "(" +
        "a.status = ?" +
        " AND (" +
        "a.expires IS NULL" +
        " OR a.expires <= NOW()" +
        " OR a.expires > DATE_ADD(NOW(), INTERVAL 7 DAY)" +
        ")" +
        ")" +
        ")",
    );
    params.push(ACCOUNT_STATUS_OFF, ACCOUNT_STATUS_ON);
  }
  const ar = typeof autoRenew === "string" ? autoRenew.trim() : "";
  if (ar === "1") {
    parts.push("a.mark = ?");
    params.push(1);
  } else if (ar === "0") {
    parts.push("a.mark = ?");
    params.push(0);
  }
  const q = search?.trim();
  if (q) {
    const term = `%${q}%`;
    parts.push(
      "(a.full_name LIKE ? OR a.mac LIKE ? OR a.account LIKE ? OR a.username LIKE ? OR IFNULL(a.phone, '') LIKE ? OR IFNULL(ud.username, '') LIKE ? OR IFNULL(ur1.username, '') LIKE ? OR IFNULL(ur2.username, '') LIKE ? OR COALESCE(ur1.username_owner, ur2.username_owner, '') LIKE ?)",
    );
    params.push(term, term, term, term, term, term, term, term, term);
  }
  return { sql: parts.join(" AND "), params };
}

/** Same window as PHP `Stalker_model::check_keep_alive` (`120 * 2` seconds). */
const STALKER_KEEP_ALIVE_ONLINE_SEC = 240;

function stalkerKeepAliveIsOnline(keepAlive: unknown): boolean {
  if (keepAlive == null) return false;
  const raw = String(keepAlive).trim();
  if (!raw || raw === "0000-00-00 00:00:00") return false;
  const t = Date.parse(raw.replace(" ", "T"));
  if (Number.isNaN(t)) return false;
  return (Date.now() - t) / 1000 < STALKER_KEEP_ALIVE_ONLINE_SEC;
}

function escapeMySqlIdent(ident: string): string {
  return "`" + ident.replace(/`/g, "``") + "`";
}

/**
 * Billing accounts whose Stalker `users.login` matches `accounts.account` and `keep_alive`
 * is within {@link STALKER_KEEP_ALIVE_ONLINE_SEC} (same rule as {@link stalkerKeepAliveIsOnline}).
 * Uses a single billing-pool query with qualified table names (both DBs on the same server).
 * Returns `null` when Stalker is not configured or the query fails (e.g. missing cross-DB grants).
 */
export async function getAdminDevicesOnlineCount(): Promise<number | null> {
  const stalkerDb = process.env.STALKER_DATABASE_NAME?.trim();
  if (!stalkerDb) return null;
  const billingDb = (process.env.DATABASE_NAME ?? "stalker_billing").trim();
  const pool = getBillingPool();
  const s = escapeMySqlIdent(stalkerDb);
  const b = escapeMySqlIdent(billingDb);
  const sec = STALKER_KEEP_ALIVE_ONLINE_SEC;
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS c
       FROM ${s}.users u
       INNER JOIN ${b}.accounts a ON a.account = u.login
       WHERE u.keep_alive IS NOT NULL
         AND TRIM(COALESCE(u.keep_alive, '')) <> ''
         AND u.keep_alive > '1970-01-01 00:00:00'
         AND u.keep_alive > DATE_SUB(NOW(), INTERVAL ${sec} SECOND)`,
    );
    return Number(rows[0]?.c ?? 0);
  } catch {
    return null;
  }
}

async function batchStalkerTariffLabelsForAccounts(accounts: string[]): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  const unique = [...new Set(accounts.map((a) => a.trim()).filter(Boolean))];
  for (const u of unique) result.set(u, null);
  const stalker = getStalkerPool();
  if (!stalker || unique.length === 0) return result;
  const ph = unique.map(() => "?").join(",");
  try {
    const [rows] = await stalker.query<RowDataPacket[]>(
      `SELECT u.login, u.tariff_plan_id, tp.name AS plan_name
       FROM users u
       LEFT JOIN tariff_plan tp ON tp.id = u.tariff_plan_id
       WHERE u.login IN (${ph})`,
      unique,
    );
    for (const r of rows) {
      const login = r.login != null ? String(r.login) : "";
      if (!login) continue;
      const tid = Number(r.tariff_plan_id ?? 0);
      const name = r.plan_name != null ? String(r.plan_name).trim() : "";
      if (name) result.set(login, name);
      else if (tid > 0) result.set(login, `Plan #${tid}`);
    }
  } catch (err) {
    console.warn("[batchStalkerTariffLabelsForAccounts]", mysqlMessage(err));
  }
  return result;
}

async function batchStalkerReceiverOnlineForAccounts(accounts: string[]): Promise<Map<string, boolean | null>> {
  const result = new Map<string, boolean | null>();
  const unique = [...new Set(accounts.map((a) => a.trim()).filter(Boolean))];
  for (const u of unique) result.set(u, null);
  const stalker = getStalkerPool();
  if (!stalker || unique.length === 0) return result;
  const ph = unique.map(() => "?").join(",");
  try {
    const [rows] = await stalker.query<RowDataPacket[]>(
      `SELECT login, keep_alive FROM users WHERE login IN (${ph})`,
      unique,
    );
    for (const r of rows) {
      const login = r.login != null ? String(r.login) : "";
      if (login) result.set(login, stalkerKeepAliveIsOnline(r.keep_alive));
    }
  } catch (err) {
    console.warn("[batchStalkerReceiverOnlineForAccounts]", mysqlMessage(err));
  }
  return result;
}

async function batchStalkerReceiverKeepAliveForAccounts(
  accounts: Array<{ account: string; mac: string | null }>,
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  const uniqueAccounts = [...new Set(accounts.map((a) => a.account.trim()).filter(Boolean))];
  const uniqueMacs = [...new Set(accounts.map((a) => normalizeMacForStalker(a.mac ?? "")).filter(Boolean))];
  for (const u of uniqueAccounts) result.set(u, null);
  const stalker = getStalkerPool();
  if (!stalker || (uniqueAccounts.length === 0 && uniqueMacs.length === 0)) return result;
  const loginPh = uniqueAccounts.map(() => "?").join(",");
  const macPh = uniqueMacs.map(() => "?").join(",");
  const whereParts: string[] = [];
  const whereParams: string[] = [];
  if (uniqueAccounts.length > 0) {
    whereParts.push(`login IN (${loginPh})`);
    whereParams.push(...uniqueAccounts);
  }
  if (uniqueMacs.length > 0) {
    whereParts.push(`UPPER(REPLACE(TRIM(COALESCE(mac, '')), '-', ':')) IN (${macPh})`);
    whereParams.push(...uniqueMacs);
  }
  const whereSql = whereParts.join(" OR ");

  const mapByLogin = new Map<string, string | null>();
  const mapByMac = new Map<string, string | null>();

  const setActivity = (loginRaw: unknown, macRaw: unknown, activityRaw: unknown) => {
    const login = loginRaw != null ? String(loginRaw).trim() : "";
    const mac = macRaw != null ? normalizeMacForStalker(String(macRaw)) : "";
    const raw = activityRaw != null ? String(activityRaw).trim() : "";
    const activity = raw && raw !== "0000-00-00 00:00:00" ? raw : null;
    if (login) mapByLogin.set(login, activity);
    if (mac) mapByMac.set(mac, activity);
  };

  try {
    // Prefer `last_active` when available (legacy PHP behavior); fallback to mixed/legacy schemas.
    try {
      const [rows] = await stalker.query<RowDataPacket[]>(
        `SELECT login, mac, last_active AS activity_at FROM users WHERE ${whereSql}`,
        whereParams,
      );
      for (const r of rows) {
        setActivity(r.login, r.mac, r.activity_at);
      }
    } catch {
      try {
        const [rows] = await stalker.query<RowDataPacket[]>(
          `SELECT login, mac, COALESCE(last_active, keep_alive) AS activity_at FROM users WHERE ${whereSql}`,
          whereParams,
        );
        for (const r of rows) {
          setActivity(r.login, r.mac, r.activity_at);
        }
      } catch {
        const [rows] = await stalker.query<RowDataPacket[]>(
          `SELECT login, mac, keep_alive FROM users WHERE ${whereSql}`,
          whereParams,
        );
        for (const r of rows) {
          setActivity(r.login, r.mac, r.keep_alive);
        }
      }
    }
  } catch (err) {
    console.warn("[batchStalkerReceiverKeepAliveForAccounts]", mysqlMessage(err));
  }
  for (const row of accounts) {
    const acct = row.account.trim();
    if (!acct) continue;
    const mac = normalizeMacForStalker(row.mac ?? "");
    const activity = mapByLogin.get(acct) ?? (mac ? mapByMac.get(mac) : undefined) ?? null;
    result.set(acct, activity);
  }
  return result;
}

const ACCOUNT_SORT_COLS: Record<string, string> = {
  account: "a.account",
  manager: "COALESCE(ur1.username_owner, ur2.username_owner, '')",
  reseller: "COALESCE(ur1.username, ur2.username, '')",
  dealer: "COALESCE(ud.username, '')",
  username: "a.username",
  full_name: "a.full_name",
  mac: "a.mac",
  expires: "a.expires",
  status: "a.status",
  created: "a.created",
};

/**
 * Paginated accounts list (admin ROOT). Mirrors PHP `Users_model::get_user_by_status` filters;
 * hierarchy columns follow dealer → reseller → manager chain.
 */
export async function listAccountsPaged(input: {
  status?: string | null;
  search?: string | null;
  autoRenew?: string | null;
  /** Admin only: exact billing manager login (`COALESCE(ur1.username_owner, ur2.username_owner)`) — subscribers under that manager’s tree. */
  managerLogin?: string | null;
  /** Admin only: exact reseller login (`COALESCE(ur1.username, ur2.username)`) — subscribers under that reseller’s branch. */
  resellerLogin?: string | null;
  /** Admin only: dealer billing login (`accounts.username`) — subscribers owned by that dealer. */
  dealerLogin?: string | null;
  page: number;
  pageSize: number;
  sort?: string | null;
  dir?: string | null;
}): Promise<{ rows: AccountListRow[]; total: number }> {
  return listAccountsPagedScoped({
    ownerType: "ROOT",
    ownerUsername: "",
    ...input,
  });
}

export async function listAccountsPagedScoped(input: {
  ownerType: "ROOT" | "MNGR" | "SRSLR" | "RSLR";
  ownerUsername: string;
  /** SRSLR or MNGR: limit to `accounts.username` = this dealer login (PHP `Dealers_users::index` / manager branch). */
  dealerUsername?: string | null;
  /** MNGR only: limit to accounts under this reseller login (`ur1` / `ur2`). */
  resellerUsername?: string | null;
  status?: string | null;
  search?: string | null;
  autoRenew?: string | null;
  /** ROOT admin: restrict to accounts whose hierarchy manager login equals this (exact match). */
  managerLogin?: string | null;
  /** ROOT admin: restrict to accounts whose hierarchy reseller login equals this (exact match). */
  resellerLogin?: string | null;
  /** ROOT admin: restrict to accounts owned by this dealer (`accounts.username`). */
  dealerLogin?: string | null;
  page: number;
  pageSize: number;
  sort?: string | null;
  dir?: string | null;
}): Promise<{ rows: AccountListRow[]; total: number }> {
  const pool = getBillingPool();
  const pageNum = Number(input.page);
  const pageSizeNum = Number(input.pageSize);
  const page = Math.max(1, Math.floor(Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1));
  const pageSize = Math.min(
    100,
    Math.max(5, Math.floor(Number.isFinite(pageSizeNum) && pageSizeNum > 0 ? pageSizeNum : 20)),
  );
  const { sql: whereSql, params: whereParams } = accountListWhereClause(input.status, input.search, input.autoRenew);
  const { sql: scopeSql, params: scopeParams } = accountScopeWhereClause({
    ownerType: input.ownerType,
    ownerUsername: input.ownerUsername,
  });
  const dealerBranch =
    (input.ownerType === "SRSLR" || input.ownerType === "MNGR") &&
    input.dealerUsername != null &&
    String(input.dealerUsername).trim() !== ""
      ? { sql: "a.username = ?", params: [String(input.dealerUsername).trim()] as unknown[] }
      : null;
  const resellerOnly =
    input.ownerType === "MNGR" && input.resellerUsername != null && String(input.resellerUsername).trim() !== ""
      ? {
          sql: "COALESCE(ur1.username, ur2.username, '') = ?",
          params: [String(input.resellerUsername).trim()] as unknown[],
        }
      : null;
  let fullWhereSql = `(${whereSql}) AND (${scopeSql})`;
  let fullWhereParams: unknown[] = [...whereParams, ...scopeParams];
  if (dealerBranch) {
    fullWhereSql = `(${fullWhereSql}) AND (${dealerBranch.sql})`;
    fullWhereParams = [...fullWhereParams, ...dealerBranch.params];
  }
  if (resellerOnly) {
    fullWhereSql = `(${fullWhereSql}) AND (${resellerOnly.sql})`;
    fullWhereParams = [...fullWhereParams, ...resellerOnly.params];
  }

  const mgrLogin =
    input.ownerType === "ROOT" && input.managerLogin != null && String(input.managerLogin).trim() !== ""
      ? String(input.managerLogin).trim()
      : null;
  if (mgrLogin) {
    fullWhereSql = `(${fullWhereSql}) AND (COALESCE(ur1.username_owner, ur2.username_owner, '') = ?)`;
    fullWhereParams = [...fullWhereParams, mgrLogin];
  }

  const resLogin =
    input.ownerType === "ROOT" && input.resellerLogin != null && String(input.resellerLogin).trim() !== ""
      ? String(input.resellerLogin).trim()
      : null;
  if (resLogin) {
    fullWhereSql = `(${fullWhereSql}) AND (COALESCE(ur1.username, ur2.username, '') = ?)`;
    fullWhereParams = [...fullWhereParams, resLogin];
  }

  const dlrLogin =
    input.ownerType === "ROOT" && input.dealerLogin != null && String(input.dealerLogin).trim() !== ""
      ? String(input.dealerLogin).trim()
      : null;
  if (dlrLogin) {
    fullWhereSql = `(${fullWhereSql}) AND (a.username = ?)`;
    fullWhereParams = [...fullWhereParams, dlrLogin];
  }

  const rawSort = input.sort;
  const sortStr =
    typeof rawSort === "string"
      ? rawSort
      : Array.isArray(rawSort) && typeof rawSort[0] === "string"
        ? rawSort[0]
        : "";
  const sortKey = sortStr && ACCOUNT_SORT_COLS[sortStr] ? sortStr : "manager";
  const orderCol = ACCOUNT_SORT_COLS[sortKey] ?? "a.account";
  const orderDir = input.dir?.toLowerCase() === "desc" ? "DESC" : "ASC";

  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c
     FROM accounts a
     LEFT JOIN users ud ON ud.username = a.username AND ud.type = 'RSLR'
     LEFT JOIN users ur1 ON ur1.username = ud.username_owner AND ur1.type = 'SRSLR'
     LEFT JOIN users ur2 ON ur2.username = a.username AND ur2.type = 'SRSLR' AND ud.username IS NULL
     WHERE ${fullWhereSql}`,
    fullWhereParams,
  );
  const total = Number(countRows[0]?.c ?? 0);
  const offset = (page - 1) * pageSize;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       a.account,
       a.username,
       a.full_name,
       a.mac,
       a.ip,
       a.phone,
       a.expires,
       a.status,
       a.mark,
       a.online AS account_online,
       a.password,
       a.created,
       a.last_active,
       COALESCE(ud.username, '') AS dealer_login,
       COALESCE(ur1.username, ur2.username, '') AS reseller_login,
       COALESCE(ur1.username_owner, ur2.username_owner, '') AS manager_login
     FROM accounts a
     LEFT JOIN users ud ON ud.username = a.username AND ud.type = 'RSLR'
     LEFT JOIN users ur1 ON ur1.username = ud.username_owner AND ur1.type = 'SRSLR'
     LEFT JOIN users ur2 ON ur2.username = a.username AND ur2.type = 'SRSLR' AND ud.username IS NULL
     WHERE ${fullWhereSql}
     ORDER BY ${orderCol} ${orderDir}
     LIMIT ? OFFSET ?`,
    [...fullWhereParams, pageSize, offset],
  );

  const mapped: AccountListRow[] = rows.map((r) => ({
    account: String(r.account ?? ""),
    username: String(r.username ?? ""),
    full_name: r.full_name != null ? String(r.full_name) : null,
    mac: r.mac != null ? String(r.mac) : null,
    ip: r.ip != null ? String(r.ip) : null,
    phone: r.phone != null ? String(r.phone) : null,
    expires: r.expires != null ? String(r.expires) : null,
    status: Number(r.status ?? 0),
    autoRenew:
      r.mark == null
        ? null
        : Number(r.mark) === 1
          ? true
          : Number(r.mark) === 0
            ? false
            : null,
    manager: String(r.manager_login ?? ""),
    reseller: String(r.reseller_login ?? ""),
    dealer: String(r.dealer_login ?? ""),
    password: String(r.password ?? ""),
    created: r.created != null ? String(r.created) : null,
    lastActive: r.last_active != null ? String(r.last_active) : null,
    packageName: null,
    receiverOnline:
      r.account_online == null
        ? null
        : Number(r.account_online) === 1
          ? true
          : Number(r.account_online) === 0
            ? false
            : null,
    receiverKeepAlive: null,
  }));

  const stalker = getStalkerPool();
  const accountsOnPage = mapped.map((x) => x.account);
  const [pkgMap, recvMap, recvKeepAliveMap] = stalker
    ? await Promise.all([
        batchStalkerTariffLabelsForAccounts(accountsOnPage),
        batchStalkerReceiverOnlineForAccounts(accountsOnPage),
        batchStalkerReceiverKeepAliveForAccounts(mapped.map((r) => ({ account: r.account, mac: r.mac }))),
      ])
    : [null, null, null];

  const withMeta = mapped.map((r) => ({
    ...r,
    packageName: pkgMap ? (pkgMap.get(r.account) ?? null) : null,
    receiverOnline: r.receiverOnline ?? (recvMap ? (recvMap.get(r.account) ?? null) : null),
    receiverKeepAlive: recvKeepAliveMap ? (recvKeepAliveMap.get(r.account) ?? null) : null,
  }));

  return { rows: withMeta, total };
}

export async function getUsersSummaryScoped(input: {
  ownerType: "ROOT" | "MNGR" | "SRSLR" | "RSLR";
  ownerUsername: string;
  /** SRSLR only: counts for one dealer’s subscribers (`accounts.username` = dealer login). */
  dealerUsername?: string | null;
}) {
  const pool = getBillingPool();
  const { sql: scopeSql, params: scopeParams } = accountScopeWhereClause({
    ownerType: input.ownerType,
    ownerUsername: input.ownerUsername,
  });
  const dealerOnly =
    input.ownerType === "SRSLR" && input.dealerUsername != null && String(input.dealerUsername).trim() !== ""
      ? { sql: " AND a.username = ?", params: [String(input.dealerUsername).trim()] as unknown[] }
      : { sql: "", params: [] as unknown[] };
  const fromClause = `FROM accounts a
    LEFT JOIN users ud ON ud.username = a.username AND ud.type = 'RSLR'
    LEFT JOIN users ur1 ON ur1.username = ud.username_owner AND ur1.type = 'SRSLR'
    LEFT JOIN users ur2 ON ur2.username = a.username AND ur2.type = 'SRSLR' AND ud.username IS NULL
    WHERE ${scopeSql}${dealerOnly.sql}`;
  const summaryParams = [...scopeParams, ...dealerOnly.params];

  const [[all], [active], [expired], [inactive]] = await Promise.all([
    pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS c ${fromClause}`, summaryParams),
    pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS c ${fromClause} AND a.status = ?`, [...summaryParams, ACCOUNT_STATUS_ON]),
    pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS c ${fromClause} AND a.expires IS NOT NULL AND a.expires > ? AND a.expires < NOW()`,
      [...summaryParams, "1970-01-01 00:00:00"],
    ),
    pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS c ${fromClause} AND a.status = ?`, [...summaryParams, ACCOUNT_STATUS_OFF]),
  ]);
  return {
    all: Number(all[0]?.c ?? 0),
    active: Number(active[0]?.c ?? 0),
    expired: Number(expired[0]?.c ?? 0),
    inactive: Number(inactive[0]?.c ?? 0),
  };
}

/** Portal home tiles (PHP manager, reseller, and dealer Dashboard controllers and shared dashboard view). */
export type OperatorDashboardStats = {
  balance: number;
  /** Subscriber rows under hierarchy scope (billing accounts table). */
  totalAccounts: number;
  activeAccounts: number;
  expiredAccounts: number;
  /** Accounts with billing status off (same notion as subscriber lists). */
  inactiveAccounts: number;
  /** Managers only: SRSLR rows owned by this manager (username_owner). */
  resellerCount: number | null;
  /**
   * Managers: RSLR under those resellers. Resellers: RSLR under this reseller.
   * Dealers: unused (null).
   */
  dealerCount: number | null;
};

export async function getOperatorDashboardStats(input: {
  ownerType: "MNGR" | "SRSLR" | "RSLR";
  ownerUsername: string;
}): Promise<OperatorDashboardStats> {
  const u = input.ownerUsername.trim();
  const summary = await getUsersSummaryScoped({
    ownerType: input.ownerType,
    ownerUsername: u,
  });
  const balance = await getCreditBalance(u);
  const pool = getBillingPool();

  let resellerCount: number | null = null;
  let dealerCount: number | null = null;

  if (input.ownerType === "MNGR") {
    const [[r1]] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS c FROM users WHERE type = 'SRSLR' AND username_owner = ?",
      [u],
    );
    resellerCount = Number(r1?.c ?? 0);
    const [[r2]] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM users usr
       WHERE usr.type = 'RSLR'
         AND usr.username_owner IN (
           SELECT username FROM users WHERE type = 'SRSLR' AND username_owner = ?
         )`,
      [u],
    );
    dealerCount = Number(r2?.c ?? 0);
  } else if (input.ownerType === "SRSLR") {
    const [[r3]] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS c FROM users WHERE type = 'RSLR' AND username_owner = ?",
      [u],
    );
    dealerCount = Number(r3?.c ?? 0);
  }

  return {
    balance,
    totalAccounts: summary.all,
    activeAccounts: summary.active,
    expiredAccounts: summary.expired,
    inactiveAccounts: summary.inactive,
    resellerCount,
    dealerCount,
  };
}

/** Points for “new subscribers” trend (by `accounts.created`). */
export type DashboardMonthPoint = { key: string; label: string; count: number };

/** Credits added vs spent per calendar day (`transactions.periods`, absolute). */
export type DashboardDayCreditPoint = { key: string; label: string; creditIn: number; creditOut: number };

function accountsScopedFromClause(): string {
  return `FROM accounts a
    LEFT JOIN users ud ON ud.username = a.username AND ud.type = 'RSLR'
    LEFT JOIN users ur1 ON ur1.username = ud.username_owner AND ur1.type = 'SRSLR'
    LEFT JOIN users ur2 ON ur2.username = a.username AND ur2.type = 'SRSLR' AND ud.username IS NULL`;
}

function ymKey(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

function monthShortLabel(ym: string): string {
  const [ys, ms] = ym.split("-");
  const y = Number(ys);
  const mo = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(mo)) return ym;
  const d = new Date(y, mo - 1, 1);
  return d.toLocaleString(undefined, { month: "short", year: "numeric" });
}

function buildLastNMonthKeys(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(ymKey(d));
  }
  return out;
}

function buildLastNDayKeys(n: number): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({
      key,
      label: d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
    });
  }
  return out;
}

/** Last `monthCount` calendar months of new `accounts` rows (created timestamp). */
export async function getAccountsCreatedByMonthScoped(input: {
  ownerType: "ROOT" | "MNGR" | "SRSLR" | "RSLR";
  ownerUsername: string;
  monthCount?: number;
}): Promise<DashboardMonthPoint[]> {
  const pool = getBillingPool();
  const monthCount = Math.min(24, Math.max(3, Math.floor(input.monthCount ?? 6)));
  const { sql: scopeSql, params: scopeParams } = accountScopeWhereClause({
    ownerType: input.ownerType,
    ownerUsername: input.ownerUsername,
  });
  const fromClause = accountsScopedFromClause();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(a.created, '%Y-%m') AS ym, COUNT(*) AS c
     ${fromClause}
     WHERE (${scopeSql})
       AND a.created IS NOT NULL
       AND a.created > '1970-01-01 00:00:00'
       AND a.created >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL ? MONTH), '%Y-%m-01')
     GROUP BY ym
     ORDER BY ym ASC`,
    [...scopeParams, monthCount - 1],
  );
  const map = new Map(rows.map((r) => [String(r.ym ?? ""), Number(r.c ?? 0)]));
  const keys = buildLastNMonthKeys(monthCount);
  return keys.map((key) => ({
    key,
    label: monthShortLabel(key),
    count: map.get(key) ?? 0,
  }));
}

/** Accounts whose subscription expired in each month, limited to hierarchy scope. */
export async function getAccountsExpiredByMonthScoped(input: {
  ownerType: "ROOT" | "MNGR" | "SRSLR" | "RSLR";
  ownerUsername: string;
  monthCount?: number;
}): Promise<DashboardMonthPoint[]> {
  const pool = getBillingPool();
  const monthCount = Math.min(24, Math.max(3, Math.floor(input.monthCount ?? 6)));
  const { sql: scopeSql, params: scopeParams } = accountScopeWhereClause({
    ownerType: input.ownerType,
    ownerUsername: input.ownerUsername,
  });
  const fromClause = accountsScopedFromClause();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(a.expires, '%Y-%m') AS ym, COUNT(*) AS c
     ${fromClause}
     WHERE (${scopeSql})
       AND a.expires IS NOT NULL
       AND a.expires > '1970-01-01 00:00:00'
       AND a.expires < NOW()
       AND a.expires >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL ? MONTH), '%Y-%m-01')
     GROUP BY ym
     ORDER BY ym ASC`,
    [...scopeParams, monthCount - 1],
  );
  const map = new Map(rows.map((r) => [String(r.ym ?? ""), Number(r.c ?? 0)]));
  const keys = buildLastNMonthKeys(monthCount);
  return keys.map((key) => ({
    key,
    label: monthShortLabel(key),
    count: map.get(key) ?? 0,
  }));
}

/** Monthly new vs expired subscribers for portal operators (same chart shape as admin). */
export async function getOperatorSubscriberTrendSeries(input: {
  ownerType: "MNGR" | "SRSLR" | "RSLR";
  ownerUsername: string;
  monthCount?: number;
}) {
  const mc = Math.min(24, Math.max(6, Math.floor(input.monthCount ?? 12)));
  const created = await getAccountsCreatedByMonthScoped({
    ownerType: input.ownerType,
    ownerUsername: input.ownerUsername,
    monthCount: mc,
  });
  const expired = await getAccountsExpiredByMonthScoped({
    ownerType: input.ownerType,
    ownerUsername: input.ownerUsername,
    monthCount: mc,
  });
  const expMap = new Map(expired.map((e) => [e.key, e.count]));
  return created.map((c) => ({
    key: c.key,
    label: c.label,
    newAccounts: c.count,
    expired: expMap.get(c.key) ?? 0,
  }));
}

/** Operator’s own billing rows: credit in (CRDT) vs debit (DBIT) by day. */
export async function getCreditFlowByDayForUsername(
  username: string,
  dayCount?: number,
): Promise<DashboardDayCreditPoint[]> {
  const pool = getBillingPool();
  const u = username.trim();
  const n = Math.min(366, Math.max(1, Math.floor(dayCount ?? 14)));
  if (!u) return buildLastNDayKeys(n).map((d) => ({ ...d, creditIn: 0, creditOut: 0 }));

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DATE(t.\`timestamp\`) AS d,
        COALESCE(SUM(CASE WHEN UPPER(t.type) = 'CRDT' THEN ABS(t.periods) ELSE 0 END), 0) AS credit_in,
        COALESCE(SUM(CASE WHEN UPPER(t.type) = 'DBIT' THEN ABS(t.periods) ELSE 0 END), 0) AS credit_out
     FROM transactions t
     WHERE t.username = ?
       AND t.\`timestamp\` IS NOT NULL
       AND t.\`timestamp\` >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY DATE(t.\`timestamp\`)
     ORDER BY d ASC`,
    [u, n - 1],
  );
  const map = new Map(
    rows.map((r) => {
      const raw = r.d;
      const key =
        raw instanceof Date
          ? raw.toISOString().slice(0, 10)
          : String(raw ?? "").slice(0, 10);
      return [key, { in: Number(r.credit_in ?? 0), out: Number(r.credit_out ?? 0) }];
    }),
  );
  return buildLastNDayKeys(n).map(({ key, label }) => {
    const v = map.get(key);
    return { key, label, creditIn: v?.in ?? 0, creditOut: v?.out ?? 0 };
  });
}

/** System-wide credit movement (all operators) — admin overview. */
export async function getAdminCreditFlowByDay(dayCount?: number): Promise<DashboardDayCreditPoint[]> {
  const pool = getBillingPool();
  const n = Math.min(90, Math.max(7, Math.floor(dayCount ?? 14)));
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DATE(t.\`timestamp\`) AS d,
        COALESCE(SUM(CASE WHEN UPPER(t.type) = 'CRDT' THEN ABS(t.periods) ELSE 0 END), 0) AS credit_in,
        COALESCE(SUM(CASE WHEN UPPER(t.type) = 'DBIT' THEN ABS(t.periods) ELSE 0 END), 0) AS credit_out
     FROM transactions t
     WHERE t.\`timestamp\` IS NOT NULL
       AND t.\`timestamp\` >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY DATE(t.\`timestamp\`)
     ORDER BY d ASC`,
    [n - 1],
  );
  const map = new Map(
    rows.map((r) => {
      const raw = r.d;
      const key =
        raw instanceof Date
          ? raw.toISOString().slice(0, 10)
          : String(raw ?? "").slice(0, 10);
      return [key, { in: Number(r.credit_in ?? 0), out: Number(r.credit_out ?? 0) }];
    }),
  );
  return buildLastNDayKeys(n).map(({ key, label }) => {
    const v = map.get(key);
    return { key, label, creditIn: v?.in ?? 0, creditOut: v?.out ?? 0 };
  });
}

export type AdminRecentSubscriberRow = {
  account: string;
  full_name: string | null;
  status: number;
  expires: string | null;
  created: string | null;
};

/** Active accounts expiring within the next `withinDays` days (not yet expired). */
export async function getAdminExpiringSoonCount(withinDays: number): Promise<number> {
  const pool = getBillingPool();
  const d = Math.max(1, Math.min(90, Math.floor(withinDays)));
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM accounts
     WHERE status = ?
       AND expires IS NOT NULL
       AND expires > NOW()
       AND expires <= DATE_ADD(NOW(), INTERVAL ? DAY)`,
    [ACCOUNT_STATUS_ON, d],
  );
  return Number(rows[0]?.c ?? 0);
}

/** Scoped active accounts expiring within next `withinDays` days. */
export async function getScopedExpiringSoonCount(input: {
  ownerType: "MNGR" | "SRSLR" | "RSLR";
  ownerUsername: string;
  withinDays?: number;
}): Promise<number> {
  const pool = getBillingPool();
  const days = Math.max(1, Math.min(90, Math.floor(input.withinDays ?? 7)));
  const owner = input.ownerUsername.trim();
  if (!owner) return 0;
  const { sql: scopeSql, params: scopeParams } = accountScopeWhereClause({
    ownerType: input.ownerType,
    ownerUsername: owner,
  });
  const fromClause = accountsScopedFromClause();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c
     ${fromClause}
     WHERE (${scopeSql})
       AND a.status = ?
       AND a.expires IS NOT NULL
       AND a.expires > NOW()
       AND a.expires <= DATE_ADD(NOW(), INTERVAL ? DAY)`,
    [...scopeParams, ACCOUNT_STATUS_ON, days],
  );
  return Number(rows[0]?.c ?? 0);
}

/** Sum of positive net credit balances across all billing users (`transactions`). */
export async function getAdminWalletCreditsTotal(): Promise<number> {
  const pool = getBillingPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COALESCE(SUM(bal), 0) AS t FROM (
       SELECT SUM(CASE WHEN UPPER(type) = 'CRDT' THEN periods ELSE -periods END) AS bal
       FROM transactions
       GROUP BY username
     ) s
     WHERE bal > 0`,
  );
  return Math.floor(Number(rows[0]?.t ?? 0));
}

/** Sum of absolute `amount` values this calendar month (when column populated). */
export async function getAdminRevenueThisMonth(): Promise<number> {
  const pool = getBillingPool();
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COALESCE(SUM(ABS(CAST(amount AS DECIMAL(14,2)))), 0) AS r
       FROM transactions
       WHERE \`timestamp\` >= DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00')
         AND amount IS NOT NULL AND TRIM(COALESCE(amount, '')) <> ''`,
    );
    return Math.round(Number(rows[0]?.r ?? 0) * 100) / 100;
  } catch {
    return 0;
  }
}

export async function listAdminRecentSubscribers(limit: number): Promise<AdminRecentSubscriberRow[]> {
  const pool = getBillingPool();
  const lim = Math.max(1, Math.min(25, Math.floor(limit)));
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT account, full_name, status, expires, created
     FROM accounts
     ORDER BY created DESC
     LIMIT ?`,
    [lim],
  );
  return rows.map((r) => ({
    account: String(r.account ?? ""),
    full_name: r.full_name != null ? String(r.full_name) : null,
    status: Number(r.status ?? 0),
    expires: r.expires != null ? String(r.expires) : null,
    created: r.created != null ? String(r.created) : null,
  }));
}

export async function listOperatorRecentSubscribers(input: {
  ownerType: "MNGR" | "SRSLR" | "RSLR";
  ownerUsername: string;
  limit?: number;
}): Promise<AdminRecentSubscriberRow[]> {
  const pool = getBillingPool();
  const lim = Math.max(1, Math.min(25, Math.floor(input.limit ?? 8)));
  const u = input.ownerUsername.trim();
  if (!u) return [];
  const { sql: scopeSql, params: scopeParams } = accountScopeWhereClause({
    ownerType: input.ownerType,
    ownerUsername: u,
  });
  const fromClause = accountsScopedFromClause();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT a.account, a.full_name, a.status, a.expires, a.created
     ${fromClause}
     WHERE (${scopeSql})
     ORDER BY a.created DESC
     LIMIT ?`,
    [...scopeParams, lim],
  );
  return rows.map((r) => ({
    account: String(r.account ?? ""),
    full_name: r.full_name != null ? String(r.full_name) : null,
    status: Number(r.status ?? 0),
    expires: r.expires != null ? String(r.expires) : null,
    created: r.created != null ? String(r.created) : null,
  }));
}

/** Accounts whose subscription expired in each calendar month (bucketed by `expires`). */
export async function getAccountsExpiredByMonthLastN(monthCount: number): Promise<DashboardMonthPoint[]> {
  const pool = getBillingPool();
  const n = Math.min(24, Math.max(3, Math.floor(monthCount)));
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DATE_FORMAT(expires, '%Y-%m') AS ym, COUNT(*) AS c
     FROM accounts
     WHERE expires IS NOT NULL
       AND expires > '1970-01-01 00:00:00'
       AND expires < NOW()
       AND expires >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL ? MONTH), '%Y-%m-01')
     GROUP BY ym
     ORDER BY ym ASC`,
    [n - 1],
  );
  const map = new Map(rows.map((r) => [String(r.ym ?? ""), Number(r.c ?? 0)]));
  const keys = buildLastNMonthKeys(n);
  return keys.map((key) => ({
    key,
    label: monthShortLabel(key),
    count: map.get(key) ?? 0,
  }));
}

export type DashboardTrendPoint = { key: string; label: string; newAccounts: number; expired: number };

/** Monthly new accounts vs accounts that expired in that month (aligned keys). */
export async function getAdminSubscriberTrendSeries(monthCount?: number): Promise<DashboardTrendPoint[]> {
  const mc = Math.min(24, Math.max(6, Math.floor(monthCount ?? 12)));
  const created = await getAccountsCreatedByMonthScoped({ ownerType: "ROOT", ownerUsername: "", monthCount: mc });
  const expired = await getAccountsExpiredByMonthLastN(mc);
  const expMap = new Map(expired.map((e) => [e.key, e.count]));
  return created.map((c) => ({
    key: c.key,
    label: c.label,
    newAccounts: c.count,
    expired: expMap.get(c.key) ?? 0,
  }));
}

/** Matches PHP `Transaction_model::get_all_admin` column list and `periods` sign rule. */
export type AdminTransactionRow = {
  transaction: string;
  username: string;
  type: string;
  periods: number;
  amount: string | null;
  account: string | null;
  coverage_start: string | null;
  coverage_end: string | null;
  remarks: string | null;
  free_month: number | null;
  timestamp: string | null;
  created_by: string | null;
};

function isMissingCreatedByColumnError(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  if (e?.code === "ER_BAD_FIELD_ERROR" && String(e?.message ?? "").includes("created_by")) return true;
  return false;
}

function withoutCreatedByColumn(sql: string): string {
  return sql.replace(/,\s*`?created_by`?/i, "");
}

export async function getAdminTransactions(username: string): Promise<AdminTransactionRow[]> {
  const pool = getBillingPool();
  const sql = `SELECT \`transaction\`, username, type,
          CASE WHEN type = 'CRDT' THEN -periods ELSE periods END AS periods,
          amount, account, coverage_start, coverage_end, remarks, free_month,
          \`timestamp\`, created_by
   FROM transactions
   WHERE username = :u
   ORDER BY \`timestamp\` DESC
   LIMIT 500`;
  let rows: RowDataPacket[];
  try {
    [rows] = await pool.execute<RowDataPacket[]>(sql, { u: username });
  } catch (err) {
    if (!isMissingCreatedByColumnError(err)) throw err;
    [rows] = await pool.execute<RowDataPacket[]>(withoutCreatedByColumn(sql), { u: username });
  }
  return rows.map((r) => ({
    transaction: String(r.transaction ?? ""),
    username: String(r.username ?? ""),
    type: String(r.type ?? "").toUpperCase(),
    periods: Number(r.periods ?? 0),
    amount: r.amount != null ? String(r.amount) : null,
    account: r.account != null ? String(r.account) : null,
    coverage_start: r.coverage_start != null ? String(r.coverage_start) : null,
    coverage_end: r.coverage_end != null ? String(r.coverage_end) : null,
    remarks: r.remarks != null ? String(r.remarks) : null,
    free_month: (() => {
      if (r.free_month == null || r.free_month === "") return null;
      const n = Number(r.free_month);
      return Number.isFinite(n) ? n : null;
    })(),
    timestamp: r.timestamp != null ? String(r.timestamp) : null,
    created_by: r.created_by != null ? String(r.created_by) : null,
  }));
}

/** PHP `Transaction_model::get_all` (manager, reseller, dealer transactions index). */
export async function getOperatorTransactions(username: string): Promise<AdminTransactionRow[]> {
  const pool = getBillingPool();
  const u = username.trim();
  if (!u) return [];
  const sql = `SELECT \`transaction\`, username, type,
          CASE WHEN type = 'CRDT' THEN periods ELSE -periods END AS periods,
          amount, account, coverage_start, coverage_end, remarks, free_month,
          \`timestamp\`, created_by
   FROM transactions
   WHERE username = :uname
   ORDER BY \`timestamp\` DESC
   LIMIT 500`;
  let rows: RowDataPacket[];
  try {
    [rows] = await pool.execute<RowDataPacket[]>(sql, { uname: u });
  } catch (err) {
    if (!isMissingCreatedByColumnError(err)) throw err;
    [rows] = await pool.execute<RowDataPacket[]>(withoutCreatedByColumn(sql), { uname: u });
  }
  return rows.map((r) => ({
    transaction: String(r.transaction ?? ""),
    username: String(r.username ?? ""),
    type: String(r.type ?? "").toUpperCase(),
    periods: Number(r.periods ?? 0),
    amount: r.amount != null ? String(r.amount) : null,
    account: r.account != null ? String(r.account) : null,
    coverage_start: r.coverage_start != null ? String(r.coverage_start) : null,
    coverage_end: r.coverage_end != null ? String(r.coverage_end) : null,
    remarks: r.remarks != null ? String(r.remarks) : null,
    free_month: (() => {
      if (r.free_month == null || r.free_month === "") return null;
      const n = Number(r.free_month);
      return Number.isFinite(n) ? n : null;
    })(),
    timestamp: r.timestamp != null ? String(r.timestamp) : null,
    created_by: r.created_by != null ? String(r.created_by) : null,
  }));
}

export async function getDeductionsConfig() {
  const pool = getBillingPool();
  const [deductions] = await pool.execute<RowDataPacket[]>(
    `SELECT id, month, month_deduction FROM credit_deductions ORDER BY month ASC`,
  );
  const [[free]] = await pool.query<RowDataPacket[]>(
    "SELECT value FROM configs WHERE `key` = '1_month_free' LIMIT 1",
  );
  const [[bonus]] = await pool.query<RowDataPacket[]>(
    "SELECT value FROM configs WHERE `key` = 'is_recover_bonus_credit' LIMIT 1",
  );
  return {
    rows: deductions.map((d) => ({
      id: Number(d.id),
      month: Number(d.month),
      month_deduction: String(d.month_deduction ?? ""),
    })),
    monthFree: Boolean(Number(free?.value ?? 0)),
    recoverBonus: Boolean(Number(bonus?.value ?? 0)),
  };
}

async function upsertConfigKeyOnce(conn: PoolConnection, key: string, value: string): Promise<void> {
  const [existing] = await conn.execute<RowDataPacket[]>("SELECT id FROM configs WHERE `key` = :k LIMIT 1", { k: key });
  if (existing.length) {
    await conn.execute("UPDATE configs SET value = :v, updated_at = NOW() WHERE `key` = :k", { v: value, k: key });
  } else {
    await conn.execute("INSERT INTO configs (`key`, value, updated_at) VALUES (:k, :v, NOW())", { k: key, v: value });
  }
}

async function upsertConfigKey(conn: PoolConnection, key: string, value: string): Promise<void> {
  try {
    await upsertConfigKeyOnce(conn, key, value);
  } catch (e) {
    if (!isMysqlDataTooLongForColumn(e)) throw e;
    const ok = await widenConfigsValueColumnToMediumText(conn);
    if (!ok) throw e;
    await upsertConfigKeyOnce(conn, key, value);
  }
}

/** Single-row upsert for `configs` (used outside deduction transactions). */
export async function upsertConfigByKey(key: string, value: string): Promise<void> {
  const pool = getBillingPool();
  const conn = await pool.getConnection();
  try {
    await upsertConfigKey(conn, key, value);
  } finally {
    conn.release();
  }
}

export type PromoBonusRules = { p1: PromoTier[]; p2: PromoTier[] };

const PROMO_TIERS_TABLE = "bonus_promo_tiers";

function promoTypeLabel(v: string): "P1" | "P2" | null {
  return v === "P1" || v === "P2" ? v : null;
}

async function ensurePromoTiersTable(conn: PoolConnection): Promise<void> {
  await conn.execute(
    `CREATE TABLE IF NOT EXISTS ${PROMO_TIERS_TABLE} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      promo_type ENUM('P1','P2') NOT NULL,
      sort_order INT UNSIGNED NOT NULL,
      ge INT UNSIGNED NOT NULL,
      lt INT UNSIGNED NULL,
      percentage DECIMAL(6,3) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_promo_tiers_type_order (promo_type, sort_order),
      KEY idx_promo_tiers_type_ge (promo_type, ge)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  );
}

async function getPromoBonusRulesFromConfigJson(pool: Pool): Promise<PromoBonusRules> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT `key`, value FROM configs WHERE `key` IN (?, ?)",
    [PROMO_BONUS_P1_CONFIG_KEY, PROMO_BONUS_P2_CONFIG_KEY],
  );
  const map = new Map<string, string>();
  for (const r of rows) {
    map.set(String(r.key), r.value != null ? String(r.value) : "");
  }
  return {
    p1: parsePromoTiersJson(map.get(PROMO_BONUS_P1_CONFIG_KEY)),
    p2: parsePromoTiersJson(map.get(PROMO_BONUS_P2_CONFIG_KEY)),
  };
}

export async function getPromoBonusRules(): Promise<PromoBonusRules> {
  const pool = getBillingPool();
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT promo_type, ge, lt, percentage
       FROM ${PROMO_TIERS_TABLE}
       ORDER BY promo_type ASC, sort_order ASC, id ASC`,
    );
    const p1: PromoTier[] = [];
    const p2: PromoTier[] = [];
    for (const r of rows) {
      const type = promoTypeLabel(String(r.promo_type ?? ""));
      if (!type) continue;
      const ge = Math.floor(Number(r.ge));
      const ltRaw = r.lt;
      const lt =
        ltRaw == null || String(ltRaw).trim() === ""
          ? null
          : Math.floor(Number(ltRaw));
      const percentage = Number(r.percentage);
      if (!Number.isFinite(ge) || ge < 0) continue;
      if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) continue;
      if (lt != null && (!Number.isFinite(lt) || lt <= ge)) continue;
      const row: PromoTier = { ge, lt, percentage };
      if (type === "P1") p1.push(row);
      else p2.push(row);
    }

    // If table is empty (fresh migration), fallback to legacy JSON config values.
    if (p1.length === 0 && p2.length === 0) {
      return await getPromoBonusRulesFromConfigJson(pool);
    }
    return { p1, p2 };
  } catch (e) {
    if (isMysqlNoSuchTable(e)) {
      return await getPromoBonusRulesFromConfigJson(pool);
    }
    throw e;
  }
}

export async function savePromoBonusRules(input: {
  p1: PromoTier[];
  p2: PromoTier[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const e1 = validatePromoTiers(input.p1, "Promo 1 (requested credits)", true);
  if (e1) return { ok: false, error: e1 };
  const e2 = validatePromoTiers(input.p2, "Promo 2 (active clients)", true);
  if (e2) return { ok: false, error: e2 };
  const pool = getBillingPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await ensurePromoTiersTable(conn);
    await conn.execute(`DELETE FROM ${PROMO_TIERS_TABLE} WHERE promo_type IN ('P1','P2')`);

    const insertSql =
      `INSERT INTO ${PROMO_TIERS_TABLE} (promo_type, sort_order, ge, lt, percentage, created_at, updated_at)
       VALUES (:promo_type, :sort_order, :ge, :lt, :percentage, NOW(), NOW())`;
    for (let i = 0; i < input.p1.length; i++) {
      const r = input.p1[i];
      await conn.execute(insertSql, {
        promo_type: "P1",
        sort_order: i,
        ge: r.ge,
        lt: r.lt,
        percentage: r.percentage,
      });
    }
    for (let i = 0; i < input.p2.length; i++) {
      const r = input.p2[i];
      await conn.execute(insertSql, {
        promo_type: "P2",
        sort_order: i,
        ge: r.ge,
        lt: r.lt,
        percentage: r.percentage,
      });
    }
    await conn.commit();
    return { ok: true };
  } catch (e) {
    await conn.rollback();
    return { ok: false, error: `Could not save bonus tiers in ${PROMO_TIERS_TABLE}: ${mysqlMessage(e)}` };
  } finally {
    conn.release();
  }
}

export async function saveDeductions(input: {
  rows: { id: number; month: number; month_deduction: number }[];
  monthFree: boolean;
  recoverBonus: boolean;
}) {
  const pool = getBillingPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute("TRUNCATE TABLE credit_deductions");
    for (const r of input.rows) {
      await conn.execute(
        `INSERT INTO credit_deductions (\`month\`, month_deduction, created_at, updated_at) VALUES (:m, :md, NOW(), NOW())`,
        { m: r.month, md: r.month_deduction },
      );
    }
    await upsertConfigKey(conn, "1_month_free", input.monthFree ? "1" : "0");
    await upsertConfigKey(conn, "is_recover_bonus_credit", input.recoverBonus ? "1" : "0");
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

const SETTINGS_CONFIG_KEYS = [
  "limit_manager_credit",
  "limit_reseller_credit",
  "limit_dealer_credit",
  "hierarchy_add_credit_max",
  "pin_default",
  "is_retry_trial",
  "number_retry_trial",
  "notify_expiring_subscriptions",
  "notify_low_credit",
  "notify_new_tickets",
  "notify_device_offline",
] as const;

function settingsConfigBool(map: Map<string, string>, key: string, whenMissing: boolean): boolean {
  const raw = map.get(key);
  if (raw == null || raw === "") return whenMissing;
  return Boolean(Number(raw));
}

export type SettingsBundle = {
  id: number;
  title: string;
  adminEmail: string;
  announcement: string;
  limitManagerCredit: string;
  limitResellerCredit: string;
  limitDealerCredit: string;
  hierarchyAddCreditMax: string;
  pinDefault: string;
  isRetryTrial: boolean;
  numberRetryTrial: string;
  notifyExpiringSubscriptions: boolean;
  notifyLowCredit: boolean;
  notifyNewTickets: boolean;
  notifyDeviceOffline: boolean;
};

export async function getSettings(): Promise<SettingsBundle> {
  const pool = getBillingPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, title, email, global_msg FROM settings ORDER BY id DESC LIMIT 1`,
  );
  const r = row(rows);
  const base = {
    id: r ? Number(r.id) : 0,
    title: r ? String(r.title ?? "") : "",
    adminEmail: r ? String(r.email ?? "") : "",
    announcement: r ? String(r.global_msg ?? "") : "",
  };

  const ph = SETTINGS_CONFIG_KEYS.map(() => "?").join(",");
  const [cfgRows] = await pool.execute<RowDataPacket[]>(
    `SELECT \`key\`, value FROM configs WHERE \`key\` IN (${ph})`,
    [...SETTINGS_CONFIG_KEYS],
  );
  const map = new Map<string, string>();
  for (const row of cfgRows) {
    const k = row["key"] != null ? String(row["key"]) : "";
    if (k) map.set(k, row.value != null ? String(row.value) : "");
  }

  return {
    ...base,
    limitManagerCredit: map.get("limit_manager_credit") ?? "1",
    limitResellerCredit: map.get("limit_reseller_credit") ?? "200",
    limitDealerCredit: map.get("limit_dealer_credit") ?? "200",
    hierarchyAddCreditMax: map.get("hierarchy_add_credit_max") ?? String(HIERARCHY_ADD_CREDITS_MAX),
    pinDefault: map.get("pin_default") ?? "9090",
    isRetryTrial: Boolean(Number(map.get("is_retry_trial") ?? 0)),
    numberRetryTrial: map.get("number_retry_trial") ?? "0",
    notifyExpiringSubscriptions: settingsConfigBool(map, "notify_expiring_subscriptions", true),
    notifyLowCredit: settingsConfigBool(map, "notify_low_credit", true),
    notifyNewTickets: settingsConfigBool(map, "notify_new_tickets", true),
    notifyDeviceOffline: settingsConfigBool(map, "notify_device_offline", false),
  };
}

const ADMIN_NOTIFICATION_CONFIG_KEYS = [
  "notify_expiring_subscriptions",
  "notify_low_credit",
  "notify_new_tickets",
  "notify_device_offline",
] as const;

export type AdminNotificationPrefs = Pick<
  SettingsBundle,
  "notifyExpiringSubscriptions" | "notifyLowCredit" | "notifyNewTickets" | "notifyDeviceOffline"
>;

/** Used when `configs` is unreachable so UI still renders with safe defaults. */
export const DEFAULT_ADMIN_NOTIFICATION_PREFS: AdminNotificationPrefs = {
  notifyExpiringSubscriptions: true,
  notifyLowCredit: true,
  notifyNewTickets: true,
  notifyDeviceOffline: false,
};

/** Lightweight read of notification toggles (admin Settings → Notifications). */
export async function getAdminNotificationPrefs(): Promise<AdminNotificationPrefs> {
  const pool = getBillingPool();
  const ph = ADMIN_NOTIFICATION_CONFIG_KEYS.map(() => "?").join(",");
  const [cfgRows] = await pool.execute<RowDataPacket[]>(
    `SELECT \`key\`, value FROM configs WHERE \`key\` IN (${ph})`,
    [...ADMIN_NOTIFICATION_CONFIG_KEYS],
  );
  const map = new Map<string, string>();
  for (const row of cfgRows) {
    const k = row["key"] != null ? String(row["key"]) : "";
    if (k) map.set(k, row.value != null ? String(row.value) : "");
  }
  return {
    notifyExpiringSubscriptions: settingsConfigBool(map, "notify_expiring_subscriptions", true),
    notifyLowCredit: settingsConfigBool(map, "notify_low_credit", true),
    notifyNewTickets: settingsConfigBool(map, "notify_new_tickets", true),
    notifyDeviceOffline: settingsConfigBool(map, "notify_device_offline", false),
  };
}

export async function updateSettingsRow(id: number, title: string, email: string, global_msg: string) {
  const pool = getBillingPool();
  const [res] = await pool.execute<ResultSetHeader>(
    `UPDATE settings SET title = :title, email = :email, global_msg = :global_msg WHERE id = :id`,
    { id, title, email, global_msg },
  );
  return res.affectedRows === 1;
}

function formatBillingExpiryForStb(expires: unknown): string {
  if (expires == null) return "—";
  const s = String(expires).trim();
  if (!s || s === "0000-00-00 00:00:00") return "—";
  return s;
}

function buildStbSnapshotFromStalkerUserRow(stalkerUser: RowDataPacket | undefined, billingExpires: unknown) {
  const expiry = formatBillingExpiryForStb(billingExpires);
  const dash = "—";
  if (!stalkerUser) {
    return { online: false, ip: dash, firmware: dash, watching: dash, expiry };
  }
  const ipRaw = stalkerUser.ip != null ? String(stalkerUser.ip).trim() : "";
  const ip = ipRaw ? ipRaw : dash;
  const fwRaw =
    stalkerUser.image_version != null
      ? String(stalkerUser.image_version).trim()
      : stalkerUser.version != null
        ? String(stalkerUser.version).trim()
        : "";
  const firmware = fwRaw ? fwRaw : dash;
  const watchRaw =
    stalkerUser.now_playing_content != null
      ? String(stalkerUser.now_playing_content).trim()
      : stalkerUser.now_playing_type != null
        ? String(stalkerUser.now_playing_type).trim()
        : "";
  const watching = watchRaw ? watchRaw : dash;
  return {
    online: stalkerKeepAliveIsOnline(stalkerUser.keep_alive),
    ip,
    firmware,
    watching,
    expiry,
  };
}

export async function getUserForEdit(account: string) {
  const pool = getBillingPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT a.account, a.username, a.full_name, a.password, a.mac, a.phone, a.note, a.status, a.expires,
            u.type AS utype
     FROM accounts a
     LEFT JOIN users u ON u.username = a.username
     WHERE a.account = :a LIMIT 1`,
    { a: account },
  );
  const r = row(rows);
  if (!r) return null;
  const ownerLogin = String(r.username ?? "");
  const utype = r.utype != null ? String(r.utype) : "";
  const isDealer = utype === "RSLR";
  const isReseller = utype === "SRSLR";

  const [own] = await pool.execute<RowDataPacket[]>(
    `SELECT username_owner FROM users WHERE username = :u LIMIT 1`,
    { u: ownerLogin },
  );
  const ownerParent = own[0]?.username_owner != null ? String(own[0].username_owner) : "";

  /** Reseller / dealer shown in the form match PHP owner chain (`accounts.username` is dealer or reseller). */
  let resellerForForm = "";
  let dealerForForm = "";
  if (isDealer) {
    resellerForForm = ownerParent;
    dealerForForm = ownerLogin;
  } else if (isReseller) {
    resellerForForm = ownerLogin;
    dealerForForm = "";
  }

  let tariffPlanId = 0;
  let parentPin = "";
  let packageLabel = "—";
  let stalkerUserId: number | null = null;
  let customPackagePlanId: number | null = null;
  let addonPackages: { package_id: number; name: string }[] = [];
  let subscribedPackageIds: number[] = [];
  let messageEvents: StalkerDeviceEventRow[] = [];

  let stalkerUserRow: RowDataPacket | undefined;
  const stalker = getStalkerPool();
  if (stalker) {
    const [su] = await stalker.execute<RowDataPacket[]>("SELECT * FROM users WHERE login = :l LIMIT 1", { l: account });
    stalkerUserRow = su[0];
    if (stalkerUserRow) {
      stalkerUserId = Number(stalkerUserRow.id);
      tariffPlanId = stalkerUserRow.tariff_plan_id != null ? Number(stalkerUserRow.tariff_plan_id) : 0;
      parentPin = stalkerUserRow.parent_password != null ? String(stalkerUserRow.parent_password) : "";
      if (tariffPlanId > 0) {
        const [tn] = await stalker.execute<RowDataPacket[]>("SELECT name FROM tariff_plan WHERE id = :id LIMIT 1", {
          id: tariffPlanId,
        });
        packageLabel = tn.length ? String(tn[0].name ?? "") : `Plan #${tariffPlanId}`;
      }
    }
    /** Must run whenever Stalker is configured — not only when a `users` row exists (PHP still loads `get_package` from plan id). */
    customPackagePlanId = await getStalkerCustomPackagePlanId();
    if (customPackagePlanId) {
      addonPackages = await listStalkerPackagesForPlan(customPackagePlanId);
      if (stalkerUserId) {
        subscribedPackageIds = await listStalkerUserSubscribedPackageIds(stalkerUserId);
      }
    }
    if (stalkerUserId != null && stalkerUserId > 0) {
      messageEvents = await listStalkerEventsForUid(stalkerUserId, 30);
    }
  }

  const stb = buildStbSnapshotFromStalkerUserRow(stalkerUserRow, r.expires);

  const tx = await listTransactionsByAccount(String(r.account), 50);
  return {
    id: String(r.account),
    name: String(r.full_name ?? ""),
    username: ownerLogin,
    password: String(r.password ?? ""),
    mac: r.mac != null ? String(r.mac) : "",
    phone: r.phone != null ? String(r.phone) : "",
    status: Number(r.status) === ACCOUNT_STATUS_ON ? ("ACTIVE" as const) : ("INACTIVE" as const),
    statusCode: Number(r.status),
    reseller: resellerForForm,
    dealer: dealerForForm,
    isDealer,
    isReseller,
    tariffPlanId,
    parentPin,
    packageLabel,
    stalkerUserId,
    customPackagePlanId,
    addonPackages,
    subscribedPackageIds,
    messageEvents,
    comments: r.note != null ? String(r.note) : "",
    stb,
    transactions: tx,
  };
}

export async function canAccessAccountByRole(input: {
  ownerType: "ROOT" | "MNGR" | "SRSLR" | "RSLR";
  ownerUsername: string;
  account: string;
}): Promise<boolean> {
  const pool = getBillingPool();
  const acc = input.account.trim();
  if (!acc) return false;
  const { sql: scopeSql, params: scopeParams } = accountScopeWhereClause({
    ownerType: input.ownerType,
    ownerUsername: input.ownerUsername,
  });
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT a.account
     FROM accounts a
     LEFT JOIN users ud ON ud.username = a.username AND ud.type = 'RSLR'
     LEFT JOIN users ur1 ON ur1.username = ud.username_owner AND ur1.type = 'SRSLR'
     LEFT JOIN users ur2 ON ur2.username = a.username AND ur2.type = 'SRSLR' AND ud.username IS NULL
     WHERE a.account = ? AND (${scopeSql})
     LIMIT 1`,
    [acc, ...scopeParams],
  );
  return rows.length > 0;
}

export async function getUserForEditScoped(input: {
  ownerType: "ROOT" | "MNGR" | "SRSLR" | "RSLR";
  ownerUsername: string;
  account: string;
}) {
  const ok = await canAccessAccountByRole(input);
  if (!ok) return null;
  return getUserForEdit(input.account);
}

/** Reseller (required) and optional dealer under that reseller → billing `accounts.username` value. */
export async function resolveValidatedAccountOwner(reseller: string, dealer: string): Promise<string | null> {
  const pool = getBillingPool();
  const r = reseller.trim();
  const d = dealer.trim();
  if (!r) return null;
  const [[rs]] = await pool.execute<RowDataPacket[]>(
    "SELECT username FROM users WHERE type = 'SRSLR' AND username = :u LIMIT 1",
    { u: r },
  );
  if (!rs) return null;
  if (d) {
    const [[dl]] = await pool.execute<RowDataPacket[]>(
      "SELECT username FROM users WHERE type = 'RSLR' AND username = :d AND username_owner = :r LIMIT 1",
      { d, r },
    );
    if (!dl) return null;
    return d;
  }
  return r;
}

/** Raw `periods` from DB — matches PHP `users/view` transaction table (not `get_all_admin` sign flip). */
export type AccountTransactionRow = {
  transaction: string;
  username: string;
  type: string;
  periods: number;
  amount: string | null;
  account: string | null;
  coverage_start: string | null;
  coverage_end: string | null;
  remarks: string | null;
  free_month: number | null;
  timestamp: string | null;
  created_by: string | null;
};

function mapAccountTransactionRow(r: RowDataPacket): AccountTransactionRow {
  return {
    transaction: String(r.transaction ?? ""),
    username: String(r.username ?? ""),
    type: String(r.type ?? "").toUpperCase(),
    periods: Number(r.periods ?? 0),
    amount: r.amount != null ? String(r.amount) : null,
    account: r.account != null ? String(r.account) : null,
    coverage_start: r.coverage_start != null ? String(r.coverage_start) : null,
    coverage_end: r.coverage_end != null ? String(r.coverage_end) : null,
    remarks: r.remarks != null ? String(r.remarks) : null,
    free_month: (() => {
      if (r.free_month == null || r.free_month === "") return null;
      const n = Number(r.free_month);
      return Number.isFinite(n) ? n : null;
    })(),
    timestamp: r.timestamp != null ? String(r.timestamp) : null,
    created_by: r.created_by != null ? String(r.created_by) : null,
  };
}

/** Sub-account (end user) rows: `transactions.account` = Stalker login / `accounts.account`. */
export async function listTransactionsByAccount(account: string, limit = 50): Promise<AccountTransactionRow[]> {
  const pool = getBillingPool();
  const lim = Math.min(200, Math.max(1, Math.floor(limit)));
  const sql = `SELECT \`transaction\`, username, type, periods, amount, account, coverage_start, coverage_end, remarks, free_month, \`timestamp\`, created_by
   FROM transactions WHERE account = :a ORDER BY \`timestamp\` DESC LIMIT ${lim}`;
  let rows: RowDataPacket[];
  try {
    [rows] = await pool.execute<RowDataPacket[]>(sql, { a: account });
  } catch (err) {
    if (!isMissingCreatedByColumnError(err)) throw err;
    [rows] = await pool.execute<RowDataPacket[]>(withoutCreatedByColumn(sql), { a: account });
  }
  return rows.map(mapAccountTransactionRow);
}

/** Operator (reseller/dealer) rows: `transactions.username` = billing user login. */
export async function listTransactionsByUsername(username: string, limit = 50): Promise<AccountTransactionRow[]> {
  const pool = getBillingPool();
  const lim = Math.min(200, Math.max(1, Math.floor(limit)));
  const sql = `SELECT \`transaction\`, username, type, periods, amount, account, coverage_start, coverage_end, remarks, free_month, \`timestamp\`, created_by
   FROM transactions WHERE username = :u ORDER BY \`timestamp\` DESC LIMIT ${lim}`;
  let rows: RowDataPacket[];
  try {
    [rows] = await pool.execute<RowDataPacket[]>(sql, { u: username });
  } catch (err) {
    if (!isMissingCreatedByColumnError(err)) throw err;
    [rows] = await pool.execute<RowDataPacket[]>(withoutCreatedByColumn(sql), { u: username });
  }
  return rows.map(mapAccountTransactionRow);
}

/** Stalker `events` rows for a device user (PHP `Stalker_model::get_events`). */
export type StalkerDeviceEventRow = {
  id: number;
  event: string;
  msg: string | null;
  priority: number | null;
  addtime: string | null;
  need_confirm: number | null;
  eventtime: string | null;
};

export async function listStalkerEventsForUid(uid: number, limit = 30): Promise<StalkerDeviceEventRow[]> {
  if (!Number.isFinite(uid) || uid <= 0) return [];
  const stalker = getStalkerPool();
  if (!stalker) return [];
  const lim = Math.min(100, Math.max(1, Math.floor(limit)));
  try {
    const [rows] = await stalker.execute<RowDataPacket[]>(
      `SELECT id, event, msg, priority, addtime, need_confirm, eventtime FROM events WHERE uid = :u ORDER BY id DESC LIMIT ${lim}`,
      { u: uid },
    );
    return rows.map((ev) => ({
      id: Number(ev.id ?? 0),
      event: String(ev.event ?? ""),
      msg: ev.msg != null ? String(ev.msg) : null,
      priority: ev.priority != null ? Number(ev.priority) : null,
      addtime: ev.addtime != null ? String(ev.addtime) : null,
      need_confirm: ev.need_confirm != null ? Number(ev.need_confirm) : null,
      eventtime: ev.eventtime != null ? String(ev.eventtime) : null,
    }));
  } catch {
    return [];
  }
}

/** Stalker portal users for admin Message “Custom selection” (`Message::index` + `common/message`). */
export type StalkerMessageUserOption = { id: number; login: string };

export async function countStalkerUsers(): Promise<number> {
  const stalker = getStalkerPool();
  if (!stalker) return 0;
  try {
    const [rows] = await stalker.execute<RowDataPacket[]>("SELECT COUNT(*) AS c FROM users");
    return Math.floor(Number(rows[0]?.c ?? 0));
  } catch {
    return 0;
  }
}

export type AdminStalkerMessageDashboardStats = {
  /** Distinct send batches today (same minute + same body counts as one send). */
  sendsToday: number;
  /** Total `send_msg` event rows (all time, device targets). */
  recipients30d: number;
  /** Share of rows with `need_confirm = 0` (all time), or null if none. */
  deliveryPct: number | null;
  /** True when some rows still have `need_confirm` set. */
  deliveryPending: boolean;
};

export type AdminMessageRoleCounts = {
  admin: number;
  manager: number;
  reseller: number;
  dealer: number;
};

export async function getAdminStalkerMessageDashboardStats(): Promise<AdminStalkerMessageDashboardStats> {
  const stalker = getStalkerPool();
  if (!stalker || !(await stalkerHasEventsTable(stalker))) {
    return { sendsToday: 0, recipients30d: 0, deliveryPct: null, deliveryPending: false };
  }
  const sendMsgWhere = `event = 'send_msg' AND uid > 0 AND msg IS NOT NULL AND TRIM(msg) <> ''`;
  try {
    const [r1] = await stalker.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM (
         SELECT 1 AS x FROM events
         WHERE ${sendMsgWhere} AND DATE(\`addtime\`) = CURDATE()
         GROUP BY DATE_FORMAT(\`addtime\`, '%Y-%m-%d %H:%i'), \`msg\`
       ) t`,
    );
    const sendsToday = Math.floor(Number(r1[0]?.c ?? 0));
    const [r2] = await stalker.query<RowDataPacket[]>(`SELECT COUNT(*) AS c FROM events WHERE ${sendMsgWhere}`);
    const recipients30d = Math.floor(Number(r2[0]?.c ?? 0));
    const [r3] = await stalker.query<RowDataPacket[]>(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN COALESCE(need_confirm, 1) = 0 THEN 1 ELSE 0 END) AS confirmed
       FROM events
       WHERE ${sendMsgWhere}`,
    );
    const total = Math.floor(Number(r3[0]?.total ?? 0));
    const confirmed = Math.floor(Number(r3[0]?.confirmed ?? 0));
    const deliveryPct = total > 0 ? Math.round((100 * confirmed) / total) : null;
    const deliveryPending = total > 0 && confirmed < total;
    return { sendsToday, recipients30d, deliveryPct, deliveryPending };
  } catch {
    return { sendsToday: 0, recipients30d: 0, deliveryPct: null, deliveryPending: false };
  }
}

export async function getAdminMessageRoleCounts(): Promise<AdminMessageRoleCounts> {
  const pool = getBillingPool();
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'ROOT'  AND UPPER(TRIM(status)) = 'A' THEN 1 ELSE 0 END), 0) AS admin_n,
         COALESCE(SUM(CASE WHEN type = 'MNGR'  AND UPPER(TRIM(status)) = 'A' THEN 1 ELSE 0 END), 0) AS manager_n,
         COALESCE(SUM(CASE WHEN type = 'SRSLR' AND UPPER(TRIM(status)) = 'A' THEN 1 ELSE 0 END), 0) AS reseller_n,
         COALESCE(SUM(CASE WHEN type = 'RSLR'  AND UPPER(TRIM(status)) = 'A' THEN 1 ELSE 0 END), 0) AS dealer_n
       FROM users`,
    );
    const r = rows[0];
    const admin = Math.floor(Number(r?.admin_n ?? 0));
    return {
      admin: admin > 0 ? admin : 1,
      manager: Math.floor(Number(r?.manager_n ?? 0)),
      reseller: Math.floor(Number(r?.reseller_n ?? 0)),
      dealer: Math.floor(Number(r?.dealer_n ?? 0)),
    };
  } catch {
    return { admin: 1, manager: 0, reseller: 0, dealer: 0 };
  }
}

export type AdminRecentStalkerSendMessageRow = {
  uid: number;
  login: string | null;
  msg: string | null;
  priority: number | null;
  addtime: string | null;
  need_confirm: number | null;
};

export async function listAdminRecentStalkerSendMessages(limit = 0): Promise<AdminRecentStalkerSendMessageRow[]> {
  const stalker = getStalkerPool();
  if (!stalker || !(await stalkerHasEventsTable(stalker))) return [];
  const lim = Math.floor(limit);
  const sqlLimit = lim > 0 ? `LIMIT ${Math.min(10000, lim)}` : "";
  try {
    const [rows] = await stalker.execute<RowDataPacket[]>(
      `SELECT e.uid, e.msg, e.priority, e.addtime, e.need_confirm, u.login
       FROM events e
       LEFT JOIN users u ON u.id = e.uid
       WHERE e.event = 'send_msg'
         AND e.uid > 0
         AND e.msg IS NOT NULL
         AND TRIM(e.msg) <> ''
       ORDER BY e.addtime DESC, e.id DESC
       ${sqlLimit}`,
    );
    return rows.map((r) => ({
      uid: Math.floor(Number(r.uid ?? 0)),
      login: r.login != null && String(r.login).trim() !== "" ? String(r.login) : null,
      msg: r.msg != null ? String(r.msg) : null,
      priority: r.priority != null ? Number(r.priority) : null,
      addtime: r.addtime != null ? String(r.addtime) : null,
      need_confirm: r.need_confirm != null ? Number(r.need_confirm) : null,
    }));
  } catch {
    return [];
  }
}

/** Approximate audience sizes for admin Messages UI (billing vs Stalker totals). */
export type AdminMessageAudiencePreviewCounts = {
  /** Every row in Stalker `users` (broadcast “all”). */
  all: number;
  active: number;
  expired: number;
  expiring: number;
  inactive: number;
  managers: number;
  resellers: number;
};

export async function getAdminMessageAudiencePreviewCounts(): Promise<AdminMessageAudiencePreviewCounts> {
  const pool = getBillingPool();
  const mappedTotal = await countAdminMappableStalkerUsers();
  const summary = await getUsersSummary();
  const expiring = await getAdminExpiringSoonCount(7);
  const [[m]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM users WHERE type = 'MNGR' AND UPPER(TRIM(status)) = 'A'`,
  );
  const [[r]] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM users WHERE type IN ('SRSLR', 'RSLR') AND UPPER(TRIM(status)) = 'A'`,
  );
  return {
    all: mappedTotal,
    active: summary.active,
    expired: summary.expired,
    expiring,
    inactive: summary.inactive,
    managers: Math.floor(Number(m[0]?.c ?? 0)),
    resellers: Math.floor(Number(r[0]?.c ?? 0)),
  };
}

async function listAdminAccountLogins(limit = 20000): Promise<string[]> {
  const pool = getBillingPool();
  const lim = Math.min(50000, Math.max(1, Math.floor(limit)));
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DISTINCT a.account AS acct
     FROM accounts a
     WHERE a.account IS NOT NULL AND TRIM(a.account) <> ''
     ORDER BY a.account ASC
     LIMIT ?`,
    [lim],
  );
  return rows.map((r) => String(r.acct ?? "").trim()).filter(Boolean);
}

async function resolveAdminAccountLoginsToStalkerUids(logins: string[]): Promise<number[]> {
  if (!logins.length) return [];
  const stalker = getStalkerPool();
  if (!stalker) return [];
  const out: number[] = [];
  const seen = new Set<number>();
  const chunk = 400;
  for (let i = 0; i < logins.length; i += chunk) {
    const part = logins.slice(i, i + chunk);
    const ph = part.map(() => "?").join(",");
    const [rows] = await stalker.query<RowDataPacket[]>(
      `SELECT id FROM users WHERE login IN (${ph})`,
      part,
    );
    for (const r of rows) {
      const id = Number(r.id ?? 0);
      if (id > 0 && !seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
  }
  return out;
}

async function countAdminMappableStalkerUsers(): Promise<number> {
  const logins = await listAdminAccountLogins(25000);
  if (!logins.length) return 0;
  const uids = await resolveAdminAccountLoginsToStalkerUids(logins);
  return uids.length;
}

const ADMIN_MESSAGE_ACCOUNT_FROM = `FROM accounts a
  LEFT JOIN users ud ON ud.username = a.username AND ud.type = 'RSLR'
  LEFT JOIN users ur1 ON ur1.username = ud.username_owner AND ur1.type = 'SRSLR'
  LEFT JOIN users ur2 ON ur2.username = a.username AND ur2.type = 'SRSLR' AND ud.username IS NULL`;

/**
 * Resolve Stalker `users.id` values for a billing-driven audience (max `maxUids` matches).
 * Does not handle `all` (use broadcast) or `custom` (form posts `users[]`).
 */
export async function resolveAdminMessageStalkerUids(
  audience: string,
  opts?: { maxUids?: number },
): Promise<{ uids: number[]; sourceLogins: number }> {
  const requestedCap = opts?.maxUids;
  const maxUids = requestedCap == null ? Number.POSITIVE_INFINITY : Math.max(1, Math.floor(requestedCap));
  const a = audience.trim().toLowerCase();
  if (a === "all" || a === "custom") return { uids: [], sourceLogins: 0 };

  const pool = getBillingPool();

  async function mapLoginsToUids(logins: string[]): Promise<{ uids: number[]; sourceLogins: number }> {
    const uids: number[] = [];
    const seen = new Set<number>();
    for (const login of logins) {
      if (uids.length >= maxUids) break;
      const uid = await getStalkerUserDbIdByLogin(login);
      if (uid != null && uid > 0 && !seen.has(uid)) {
        seen.add(uid);
        uids.push(uid);
      }
    }
    return { uids, sourceLogins: logins.length };
  }

  if (a === "managers") {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT username FROM users WHERE type = 'MNGR' AND UPPER(TRIM(status)) = 'A' ORDER BY username ASC`,
    );
    const logins = rows.map((r) => String(r.username ?? "").trim()).filter(Boolean);
    return mapLoginsToUids(logins);
  }
  if (a === "resellers") {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT username FROM users WHERE type IN ('SRSLR', 'RSLR') AND UPPER(TRIM(status)) = 'A' ORDER BY username ASC`,
    );
    const logins = rows.map((r) => String(r.username ?? "").trim()).filter(Boolean);
    return mapLoginsToUids(logins);
  }

  if (a === "active" || a === "expired" || a === "expiring" || a === "inactive") {
    const { sql: filterSql, params: filterParams } = accountListWhereClause(a, null, null);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT a.account AS acct ${ADMIN_MESSAGE_ACCOUNT_FROM} WHERE (${filterSql}) ORDER BY a.account ASC LIMIT 15000`,
      filterParams,
    );
    const logins = rows.map((r) => String(r.acct ?? "").trim()).filter(Boolean);
    return mapLoginsToUids(logins);
  }

  return { uids: [], sourceLogins: 0 };
}

export async function listStalkerUsersForMessageSelect(limit = 8000): Promise<StalkerMessageUserOption[]> {
  const stalker = getStalkerPool();
  if (!stalker) return [];
  const lim = Math.min(20000, Math.max(1, Math.floor(limit)));
  const mapRows = (rows: RowDataPacket[]) =>
    rows.map((r) => ({
      id: Number(r.id ?? 0),
      login: r.login != null && String(r.login).trim() !== "" ? String(r.login) : `id:${r.id}`,
    }));
  try {
    const [rows] = await stalker.execute<RowDataPacket[]>(
      `SELECT id, login FROM users ORDER BY fname ASC, login ASC LIMIT ${lim}`,
    );
    return mapRows(rows).filter((u) => u.id > 0);
  } catch {
    try {
      const [rows] = await stalker.execute<RowDataPacket[]>(
        `SELECT id, login FROM users ORDER BY login ASC LIMIT ${lim}`,
      );
      return mapRows(rows).filter((u) => u.id > 0);
    } catch {
      return [];
    }
  }
}

/** Distinct billing `accounts.account` values under portal hierarchy (PHP Message index user list). */
export async function listScopedAccountLogins(input: {
  ownerType: "MNGR" | "SRSLR" | "RSLR";
  ownerUsername: string;
  limit?: number;
}): Promise<string[]> {
  const pool = getBillingPool();
  const { sql: scopeSql, params: scopeParams } = accountScopeWhereClause({
    ownerType: input.ownerType,
    ownerUsername: input.ownerUsername,
  });
  const lim = Math.min(10000, Math.max(1, Math.floor(input.limit ?? 8000)));
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DISTINCT a.account AS acct
     FROM accounts a
     LEFT JOIN users ud ON ud.username = a.username AND ud.type = 'RSLR'
     LEFT JOIN users ur1 ON ur1.username = ud.username_owner AND ur1.type = 'SRSLR'
     LEFT JOIN users ur2 ON ur2.username = a.username AND ur2.type = 'SRSLR' AND ud.username IS NULL
     WHERE (${scopeSql})
     ORDER BY a.account ASC
     LIMIT ?`,
    [...scopeParams, lim],
  );
  return rows.map((r) => String(r.acct ?? "").trim()).filter(Boolean);
}

/** Stalker rows for accounts visible to manager, reseller, or dealer (custom selection). */
export async function listStalkerUsersForMessageSelectScoped(input: {
  ownerType: "MNGR" | "SRSLR" | "RSLR";
  ownerUsername: string;
  limit?: number;
}): Promise<StalkerMessageUserOption[]> {
  const logins = await listScopedAccountLogins(input);
  if (!logins.length) return [];
  const stalker = getStalkerPool();
  if (!stalker) return [];
  const maxOut = Math.min(8000, Math.max(1, Math.floor(input.limit ?? 8000)));
  const out: StalkerMessageUserOption[] = [];
  const seen = new Set<number>();
  const chunk = 400;
  for (let i = 0; i < logins.length; i += chunk) {
    const part = logins.slice(i, i + chunk);
    const ph = part.map(() => "?").join(",");
    const [rows] = await stalker.query<RowDataPacket[]>(
      `SELECT id, login FROM users WHERE login IN (${ph}) ORDER BY login ASC`,
      part,
    );
    for (const r of rows) {
      const id = Number(r.id ?? 0);
      if (id <= 0 || seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        login: r.login != null && String(r.login).trim() !== "" ? String(r.login) : `id:${id}`,
      });
      if (out.length >= maxOut) return out;
    }
  }
  return out;
}

/** Audience sizes for portal message UI (“All” = scoped Stalker rows). */
export async function getOperatorMessageAudiencePreviewCounts(input: {
  ownerType: "MNGR" | "SRSLR" | "RSLR";
  ownerUsername: string;
}): Promise<AdminMessageAudiencePreviewCounts> {
  const users = await listStalkerUsersForMessageSelectScoped(input);
  const n = users.length;
  return {
    all: n,
    active: 0,
    expired: 0,
    expiring: 0,
    inactive: 0,
    managers: 0,
    resellers: 0,
  };
}

/** Stalker `send_msg` stats limited to subscribers under the operator hierarchy. */
export async function getOperatorStalkerMessageDashboardStats(input: {
  ownerType: "MNGR" | "SRSLR" | "RSLR";
  ownerUsername: string;
}): Promise<AdminStalkerMessageDashboardStats> {
  const logins = await listScopedAccountLogins({ ...input, ownerUsername: input.ownerUsername.trim(), limit: 12000 });
  if (!logins.length) {
    return { sendsToday: 0, recipients30d: 0, deliveryPct: null, deliveryPending: false };
  }
  const stalker = getStalkerPool();
  if (!stalker || !(await stalkerHasEventsTable(stalker))) {
    return { sendsToday: 0, recipients30d: 0, deliveryPct: null, deliveryPending: false };
  }
  const chunk = 280;
  let sendsToday = 0;
  let recipients30d = 0;
  let confirmed30d = 0;
  try {
    for (let i = 0; i < logins.length; i += chunk) {
      const part = logins.slice(i, i + chunk);
      const ph = part.map(() => "?").join(",");
      const [r1] = await stalker.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS c FROM events e
         INNER JOIN users u ON u.id = e.uid
         WHERE e.event = 'send_msg' AND DATE(e.addtime) = CURDATE() AND u.login IN (${ph})`,
        part,
      );
      sendsToday += Math.floor(Number(r1[0]?.c ?? 0));
      const [r2] = await stalker.query<RowDataPacket[]>(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN COALESCE(e.need_confirm, 1) = 0 THEN 1 ELSE 0 END) AS confirmed
         FROM events e
         INNER JOIN users u ON u.id = e.uid
         WHERE e.event = 'send_msg' AND e.addtime >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND u.login IN (${ph})`,
        part,
      );
      recipients30d += Math.floor(Number(r2[0]?.total ?? 0));
      confirmed30d += Math.floor(Number(r2[0]?.confirmed ?? 0));
    }
    const deliveryPct = recipients30d > 0 ? Math.round((100 * confirmed30d) / recipients30d) : null;
    const deliveryPending = recipients30d > 0 && confirmed30d < recipients30d;
    return { sendsToday, recipients30d, deliveryPct, deliveryPending };
  } catch {
    return { sendsToday: 0, recipients30d: 0, deliveryPct: null, deliveryPending: false };
  }
}

export async function listOperatorRecentStalkerSendMessages(
  input: { ownerType: "MNGR" | "SRSLR" | "RSLR"; ownerUsername: string },
  limit = 30,
): Promise<AdminRecentStalkerSendMessageRow[]> {
  const logins = new Set(
    (await listScopedAccountLogins({ ...input, ownerUsername: input.ownerUsername.trim(), limit: 12000 }))
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  if (!logins.size) return [];
  const lim = Math.min(100, Math.max(1, Math.floor(limit)));
  const recent = await listAdminRecentStalkerSendMessages(500);
  return recent
    .filter((r) => {
      const lo = (r.login ?? "").trim().toLowerCase();
      return lo.length > 0 && logins.has(lo);
    })
    .slice(0, lim);
}

/** PHP portal Message “To All”: `send_msg` to every Stalker user whose login is a scoped billing account. */
export async function broadcastStalkerMessageScoped(
  message: string,
  input: { ownerType: "MNGR" | "SRSLR" | "RSLR"; ownerUsername: string },
  priority = 2,
): Promise<number> {
  const msg = message.trim();
  if (!msg) return 0;
  const pr = Number.isFinite(priority) && priority >= 1 && priority <= 3 ? Math.floor(priority) : 2;
  const logins = await listScopedAccountLogins({ ...input, limit: 10000 });
  if (!logins.length) return 0;
  const stalker = getStalkerPool();
  if (!stalker) return 0;
  const uids: number[] = [];
  const seen = new Set<number>();
  const chunk = 400;
  for (let i = 0; i < logins.length; i += chunk) {
    const part = logins.slice(i, i + chunk);
    const ph = part.map(() => "?").join(",");
    const [rows] = await stalker.query<RowDataPacket[]>(`SELECT id FROM users WHERE login IN (${ph})`, part);
    for (const r of rows) {
      const id = Number(r.id ?? 0);
      if (id > 0 && !seen.has(id)) {
        seen.add(id);
        uids.push(id);
      }
    }
  }
  if (!uids.length) return 0;
  return sendStalkerMessageToUserIds(uids, msg, pr);
}

export async function isStalkerUidInOperatorScope(input: {
  ownerType: "MNGR" | "SRSLR" | "RSLR";
  ownerUsername: string;
  uid: number;
}): Promise<boolean> {
  const uid = Math.floor(Number(input.uid));
  if (!Number.isFinite(uid) || uid <= 0) return false;
  const stalker = getStalkerPool();
  if (!stalker) return false;
  const [rows] = await stalker.execute<RowDataPacket[]>("SELECT login FROM users WHERE id = :id LIMIT 1", { id: uid });
  const login = rows[0]?.login != null ? String(rows[0].login).trim() : "";
  if (!login) return false;
  return canAccessAccountByRole({
    ownerType: input.ownerType,
    ownerUsername: input.ownerUsername,
    account: login,
  });
}

export async function getTransactionsForAccount(account: string): Promise<AccountTransactionRow[]> {
  return listTransactionsByAccount(account, 50);
}

export async function updateAccountBasics(input: {
  account: string;
  full_name: string;
  mac: string;
  phone: string;
  note: string;
  status: number;
  password: string;
  owner_username?: string;
}) {
  const pool = getBillingPool();
  const owner = input.owner_username?.trim();
  if (owner) {
    const [res] = await pool.execute<ResultSetHeader>(
      `UPDATE accounts SET full_name = :full_name, mac = :mac, phone = :phone, note = :note, status = :status, password = :password, username = :username WHERE account = :account`,
      {
        account: input.account,
        full_name: input.full_name,
        mac: input.mac,
        phone: input.phone,
        note: input.note,
        status: input.status,
        password: input.password,
        username: owner,
      },
    );
    return res.affectedRows === 1;
  }
  const [res] = await pool.execute<ResultSetHeader>(
    `UPDATE accounts SET full_name = :full_name, mac = :mac, phone = :phone, note = :note, status = :status, password = :password WHERE account = :account`,
    input,
  );
  return res.affectedRows === 1;
}

/**
 * Update billing `accounts` and mirror PHP `Users_model::update` + `change_status` into Stalker `users` / `events`.
 * If Stalker is not configured or the login row is missing, falls back to {@link updateAccountBasics} only.
 */
export async function updateAccountWithStalkerSync(input: {
  account: string;
  full_name: string;
  mac: string;
  phone: string;
  note: string;
  status: number;
  password: string;
  owner_username?: string;
  tariff_plan_id?: number;
  parent_password?: string;
}): Promise<boolean> {
  const stalker = getStalkerPool();
  const pool = getBillingPool();
  const macNorm = normalizeMacForStalker(input.mac);

  const [accRows] = await pool.execute<RowDataPacket[]>("SELECT expires FROM accounts WHERE account = :a LIMIT 1", {
    a: input.account,
  });
  if (!accRows.length) return false;
  const expired = isBillingAccountExpired(accRows[0].expires != null ? String(accRows[0].expires) : null);

  const billingPayload = (statusVal: number) => ({
    account: input.account,
    full_name: input.full_name,
    mac: macNorm,
    phone: input.phone,
    note: input.note,
    status: statusVal,
    password: input.password,
    ...(input.owner_username?.trim() ? { owner_username: input.owner_username.trim() } : {}),
  });

  if (!stalker) {
    return updateAccountBasics(billingPayload(input.status));
  }

  const [su] = await stalker.execute<RowDataPacket[]>(
    "SELECT id, status, tariff_plan_id, parent_password FROM users WHERE login = :l LIMIT 1",
    { l: input.account },
  );
  if (!su.length) {
    return updateAccountBasics(billingPayload(input.status));
  }

  const uid = Number(su[0].id);
  const stalkerPrevStatus = Number(su[0].status ?? 0);
  const rowTariff = su[0].tariff_plan_id != null ? Number(su[0].tariff_plan_id) : 0;
  const rowParent =
    su[0].parent_password != null && String(su[0].parent_password) !== "" ? String(su[0].parent_password) : "9090";
  const tariffId =
    input.tariff_plan_id !== undefined && Number.isFinite(input.tariff_plan_id) && input.tariff_plan_id > 0
      ? Math.floor(input.tariff_plan_id)
      : rowTariff;
  const parentPin =
    input.parent_password !== undefined && String(input.parent_password).trim() !== ""
      ? String(input.parent_password).trim()
      : rowParent;

  const statusForRow = expired ? stalkerPrevStatus : input.status;
  const formStatus = input.status;

  try {
    if (!(expired && formStatus === ACCOUNT_STATUS_ON) && stalkerPrevStatus !== formStatus) {
      if (formStatus === ACCOUNT_STATUS_ON) {
        await stalkerCutOnOff(stalker, uid, "on");
      } else if (formStatus === ACCOUNT_STATUS_OFF) {
        await stalkerCutOnOff(stalker, uid, "off");
      }
    }

    const pwdHash = stalkerPasswordDigest(input.password, uid);
    await stalker.execute(
      `UPDATE users SET fname = :fn, mac = :mac, status = :st, phone = :phone, comment = :cm, tariff_plan_id = :tp, parent_password = :pp, password = :pw WHERE id = :id`,
      {
        fn: input.full_name || input.account,
        mac: macNorm,
        st: statusForRow,
        phone: input.phone,
        cm: input.note,
        tp: tariffId,
        pp: parentPin,
        pw: pwdHash,
        id: uid,
      },
    );
  } catch {
    return false;
  }

  return updateAccountBasics(billingPayload(statusForRow));
}

/**
 * PHP `manager/Users::activate` / `::block` and `reseller/Dealers_users::activate` / `::block` parity:
 * - deny status changes for expired accounts
 * - deny when target status is already set
 * - update billing + Stalker `cut_on` / `cut_off`
 */
export async function setManagerEndUserStatusLikePhp(input: {
  account: string;
  mode: "activate" | "block";
}): Promise<{ ok: true } | { ok: false; code: string }> {
  const account = input.account.trim();
  if (!account) return { ok: false, code: "invalid" };
  const targetStatus = input.mode === "activate" ? ACCOUNT_STATUS_ON : ACCOUNT_STATUS_OFF;
  const pool = getBillingPool();

  const [accRows] = await pool.execute<RowDataPacket[]>(
    "SELECT status, expires FROM accounts WHERE account = :a LIMIT 1",
    { a: account },
  );
  if (!accRows.length) return { ok: false, code: "no_account" };

  const currentStatus = Number(accRows[0].status);
  const expires = accRows[0].expires != null ? String(accRows[0].expires) : null;
  if (isBillingAccountExpired(expires)) {
    return { ok: false, code: input.mode === "activate" ? "expired_activate" : "expired_change" };
  }
  if (currentStatus === targetStatus) {
    return { ok: false, code: targetStatus === ACCOUNT_STATUS_ON ? "already_active" : "already_blocked" };
  }

  const stalker = getStalkerPool();
  if (!stalker) return { ok: false, code: "no_stalker" };
  const [stRows] = await stalker.execute<RowDataPacket[]>(
    "SELECT id FROM users WHERE login = :l LIMIT 1",
    { l: account },
  );
  if (!stRows.length) return { ok: false, code: "no_stalker_user" };
  const uid = Number(stRows[0].id);
  if (!Number.isFinite(uid) || uid <= 0) return { ok: false, code: "no_stalker_user" };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute("UPDATE accounts SET status = :s WHERE account = :a", {
      s: targetStatus,
      a: account,
    });
    await conn.commit();
  } catch {
    await conn.rollback();
    return { ok: false, code: "billing_db" };
  } finally {
    conn.release();
  }

  try {
    await stalkerCutOnOff(stalker, uid, input.mode === "activate" ? "on" : "off");
  } catch {
    return { ok: false, code: "stalker_db" };
  }
  return { ok: true };
}

/**
 * PHP `reseller/Dealers_users::delete` — only when billing `accounts.expires` is in the past; deletes Stalker `users` then `accounts`.
 */
export async function deleteExpiredEndUserAccount(
  accountLogin: string,
): Promise<{ ok: true } | { ok: false; code: string }> {
  const pool = getBillingPool();
  const stalker = getStalkerPool();
  const acct = accountLogin.trim();
  if (!acct) return { ok: false, code: "invalid" };
  const [accRows] = await pool.execute<RowDataPacket[]>("SELECT expires FROM accounts WHERE account = :a LIMIT 1", {
    a: acct,
  });
  if (!accRows.length) return { ok: false, code: "no_account" };
  const exp = accRows[0].expires != null ? String(accRows[0].expires) : null;
  if (!isBillingAccountExpired(exp)) return { ok: false, code: "not_expired" };
  if (!stalker) return { ok: false, code: "no_stalker" };
  try {
    const [dr] = await stalker.execute<ResultSetHeader>("DELETE FROM users WHERE login = :l LIMIT 1", { l: acct });
    if (dr.affectedRows < 1) return { ok: false, code: "no_stalker_user" };
  } catch {
    return { ok: false, code: "stalker_db" };
  }
  try {
    const [br] = await pool.execute<ResultSetHeader>("DELETE FROM accounts WHERE account = :a LIMIT 1", { a: acct });
    if (br.affectedRows < 1) return { ok: false, code: "no_account_del" };
  } catch {
    return { ok: false, code: "billing_db" };
  }
  return { ok: true };
}

/**
 * PHP `admin/Users_model::delete` — delete Stalker `users` by `login`, then billing `accounts` (admin may delete active or expired; UI confirms when not expired).
 */
export async function deleteAdminEndUserAccount(
  accountLogin: string,
): Promise<{ ok: true } | { ok: false; code: string }> {
  const stalker = getStalkerPool();
  if (!stalker) return { ok: false, code: "no_stalker" };
  const pool = getBillingPool();
  const acct = accountLogin.trim();
  if (!acct) return { ok: false, code: "invalid" };
  const [accRows] = await pool.execute<RowDataPacket[]>("SELECT 1 FROM accounts WHERE account = :a LIMIT 1", { a: acct });
  if (!accRows.length) return { ok: false, code: "no_account" };
  try {
    const [dr] = await stalker.execute<ResultSetHeader>("DELETE FROM users WHERE login = :l LIMIT 1", { l: acct });
    if (dr.affectedRows < 1) return { ok: false, code: "no_stalker_user" };
  } catch {
    return { ok: false, code: "stalker_db" };
  }
  try {
    const [br] = await pool.execute<ResultSetHeader>("DELETE FROM accounts WHERE account = :a LIMIT 1", { a: acct });
    if (br.affectedRows < 1) return { ok: false, code: "no_account_del" };
  } catch {
    return { ok: false, code: "billing_db" };
  }
  return { ok: true };
}

export type RenewAccountResult =
  | { ok: true; mode: "months" | "trial" | "recover" }
  | {
      ok: false;
      code:
        | "invalid"
        | "no_account"
        | "no_stalker"
        | "no_stalker_user"
        | "no_summarize"
        | "insufficient_credits"
        | "insufficient_recoverable"
        | "trial_used"
        | "trial_limit"
        | "db";
      balance?: number;
      required?: number;
    };

async function getConfigInt(pool: ReturnType<typeof getBillingPool>, key: string, fallback: number): Promise<number> {
  const [rows] = await pool.execute<RowDataPacket[]>("SELECT value FROM configs WHERE `key` = :k LIMIT 1", { k: key });
  const raw = rows[0]?.value;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** PHP `Creditsummarize_model::before_update` — month drift on `max_credit_recoverable`. */
export async function creditSummarizeBeforeUpdate(account: string): Promise<void> {
  const a = account.trim();
  if (!a) return;
  const pool = getBillingPool();
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      "SELECT start_date, expiry_date, max_credit_recoverable, updated_at FROM user_credit_summarize WHERE account = :ac LIMIT 1",
      { ac: a },
    );
    if (!rows.length) return;
    const r = rows[0];
    const now = new Date();
    const updatedRaw = r.updated_at;
    if (updatedRaw != null && String(updatedRaw) !== "") {
      const upd = new Date(String(updatedRaw).replace(" ", "T"));
      if (Number.isFinite(upd.getTime())) {
        if (
          upd.getFullYear() === now.getFullYear() &&
          upd.getMonth() === now.getMonth() &&
          upd.getDate() === now.getDate()
        ) {
          return;
        }
      }
    }

    let maxCredit = Math.max(0, Number(r.max_credit_recoverable ?? 0));
    const exp = r.expiry_date != null ? new Date(String(r.expiry_date).replace(" ", "T")) : new Date(0);
    const start = r.start_date != null ? new Date(String(r.start_date).replace(" ", "T")) : now;

    if (!Number.isFinite(exp.getTime()) || exp < now) {
      maxCredit = 0;
    } else {
      const invert = start.getTime() > now.getTime();
      const earlier = invert ? now : start;
      const later = invert ? start : now;
      let y = later.getFullYear() - earlier.getFullYear();
      let m = later.getMonth() - earlier.getMonth();
      if (m < 0) {
        y -= 1;
        m += 12;
      }
      const totalMonths = Math.max(0, y * 12 + m);
      maxCredit = Math.max(0, maxCredit - totalMonths);
    }

    await pool.execute(
      "UPDATE user_credit_summarize SET max_credit_recoverable = :mx, updated_at = NOW() WHERE account = :ac",
      { mx: maxCredit, ac: a },
    );
  } catch {
    // missing columns / legacy schema
  }
}

export async function getAccountRenewRecoveryAvailability(account: string): Promise<{
  expiresAt: string | null;
  recoverableCredits: number | null;
  debitUsername: string | null;
  debitCredits: number | null;
}> {
  const a = String(account ?? "").trim();
  if (!a) return { expiresAt: null, recoverableCredits: null, debitUsername: null, debitCredits: null };
  const pool = getBillingPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT a.expires, a.username, s.max_credit_recoverable
     FROM accounts a
     LEFT JOIN user_credit_summarize s ON s.account = a.account
     WHERE a.account = :a
     LIMIT 1`,
    { a },
  );
  if (!rows.length) return { expiresAt: null, recoverableCredits: null, debitUsername: null, debitCredits: null };
  const debitUsername = rows[0].username != null ? String(rows[0].username) : null;
  const debitCredits = debitUsername ? await getCreditBalance(debitUsername) : null;
  return {
    expiresAt: rows[0].expires != null ? String(rows[0].expires) : null,
    recoverableCredits:
      rows[0].max_credit_recoverable != null ? Math.max(0, Number(rows[0].max_credit_recoverable)) : null,
    debitUsername,
    debitCredits,
  };
}

function bulkRenewFailureMessage(
  account: string,
  validityLabel: string,
  r: Extract<RenewAccountResult, { ok: false }>,
): string {
  switch (r.code) {
    case "no_account":
      return `Account ${account} cannot be processed because the user was not found.`;
    case "no_stalker":
    case "no_stalker_user":
      return `Account ${account}: Stalker user missing or Stalker not configured.`;
    case "no_summarize":
      return `Account ${account}: missing user_credit_summarize row.`;
    case "insufficient_credits":
      return `Account ${account} cannot add ${validityLabel} because the operator does not have enough credits (remaining: ${r.balance ?? 0}, required: ${r.required ?? "?"}).`;
    case "insufficient_recoverable":
      return `Account ${account}: insufficient recoverable credits (remaining: ${r.balance ?? 0}, required: ${r.required ?? "?"}).`;
    case "trial_used":
      return `Account ${account} cannot add ${validityLabel} because this MAC has already used a free trial.`;
    case "trial_limit":
      return `Account ${account} cannot add ${validityLabel} because this MAC has exceeded the free trial usage limit.`;
    case "invalid":
      return `Account ${account}: invalid renewal option.`;
    case "db":
    default:
      return `Account ${account}: renewal failed (database error).`;
  }
}

export type BulkRenewAccountResult = { account: string; ok: boolean; message: string };

/**
 * Admin bulk renew (`Users::renew_one_month_bulk`): same pre-checks as PHP, then `renewAccountByOperatorValidity`.
 */
export async function bulkRenewAccountsByOperator(input: {
  accounts: string[];
  validity: string;
}): Promise<BulkRenewAccountResult[]> {
  const validityTrim = String(input.validity ?? "").trim();
  const validityUpper = validityTrim.toUpperCase();
  const isFreeTrial = validityUpper === "FREE_TRIAL";
  const validityForRenew = isFreeTrial ? "FREE_TRIAL" : validityTrim;

  const validityInt = Number.parseInt(validityTrim, 10);
  const needsCreditCheck = Number.isFinite(validityInt) && validityInt > 0;

  const unique = [...new Set(input.accounts.map((x) => String(x ?? "").trim()).filter(Boolean))].slice(0, 250);
  const out: BulkRenewAccountResult[] = [];
  const pool = getBillingPool();

  for (const account of unique) {
    const [accRows] = await pool.execute<RowDataPacket[]>("SELECT username FROM accounts WHERE account = :a LIMIT 1", { a: account });
    if (!accRows.length) {
      out.push({
        account,
        ok: false,
        message: `Account ${account} cannot be processed because the user was not found.`,
      });
      continue;
    }
    const ownerUsername = String(accRows[0].username ?? "");

    if (needsCreditCheck) {
      const balance = await getCreditBalance(ownerUsername);
      if (balance < validityInt) {
        out.push({
          account,
          ok: false,
          message: `Account ${account} cannot add ${validityInt} months because ${ownerUsername} does not have enough credits (remaining: ${balance}, required: ${validityInt}).`,
        });
        continue;
      }
    }

    await creditSummarizeBeforeUpdate(account);

    const r = await renewAccountByOperatorValidity({ account, validity: validityForRenew });
    if (!r.ok) {
      out.push({ account, ok: false, message: bulkRenewFailureMessage(account, validityTrim, r) });
      continue;
    }
    out.push({
      account,
      ok: true,
      message: `Success: ${validityTrim} applied to account ${account}.`,
    });
  }

  return out;
}

/**
 * PHP `manager|reseller|dealer/Users::renew_one_month_bulk`: same per-account renew as single portal renew
 * (`debitUsername` = logged-in operator), with `canAccessAccountByRole` and PHP-style credit gate
 * (`remain_credits > intval(validity)` each iteration; free trial uses `intval` 0 so requires `> 0`).
 */
export async function bulkRenewPortalAccountsByOperator(input: {
  accounts: string[];
  validity: string;
  ownerType: "MNGR" | "SRSLR" | "RSLR";
  ownerUsername: string;
}): Promise<BulkRenewAccountResult[]> {
  const validityTrim = String(input.validity ?? "").trim();
  const validityUpper = validityTrim.toUpperCase();
  if (!operatorRenewValidityFormatLikePhp(validityTrim)) {
    return [{ account: "—", ok: false, message: "Invalid validity for bulk renew." }];
  }
  if (validityUpper === "1_MONTH_FREE") {
    return [{ account: "—", ok: false, message: "1_MONTH_FREE is not supported in bulk renew." }];
  }

  const isFreeTrial = validityUpper === "FREE_TRIAL";
  const validityInt = Number.parseInt(validityTrim, 10);
  /** PHP `intval(validity)`: FREE_TRIAL → 0, months → n. */
  const phpIntValidity = isFreeTrial ? 0 : validityInt;

  const unique = [...new Set(input.accounts.map((x) => String(x ?? "").trim()).filter(Boolean))].slice(0, 250);
  const out: BulkRenewAccountResult[] = [];
  const debitUser = input.ownerUsername.trim();
  if (!debitUser) return [{ account: "—", ok: false, message: "Missing operator username." }];

  for (const account of unique) {
    const balance = await getCreditBalance(debitUser);
    if (!(balance > phpIntValidity)) {
      out.push({
        account: "—",
        ok: false,
        message:
          phpIntValidity === 0
            ? "Bulk renew stopped: no credits remaining (PHP requires balance > 0 for this validity)."
            : `Bulk renew stopped: insufficient credits (remaining: ${balance}; PHP requires more than ${phpIntValidity} per renewal).`,
      });
      break;
    }

    const inScope = await canAccessAccountByRole({
      ownerType: input.ownerType,
      ownerUsername: input.ownerUsername,
      account,
    });
    if (!inScope) {
      out.push({
        account,
        ok: false,
        message: `Account ${account} cannot be processed (outside your access scope).`,
      });
      continue;
    }

    await creditSummarizeBeforeUpdate(account);
    const r = await renewAccountByOperatorValidity({
      account,
      validity: isFreeTrial ? "FREE_TRIAL" : validityTrim,
      debitUsername: debitUser,
    });
    if (!r.ok) {
      out.push({ account, ok: false, message: bulkRenewFailureMessage(account, validityTrim, r) });
      continue;
    }
    out.push({
      account,
      ok: true,
      message: `Success: ${validityTrim} applied to account ${account}.`,
    });
  }

  return out;
}

/**
 * Renew by validity value from PHP form (`1..24` or `FREE_TRIAL`).
 * FREE_TRIAL follows PHP `Users_model::renew` path: no debit, insert `free_trial_users`,
 * update billing expiry + summarize expiry.
 */
export async function renewAccountByOperatorValidity(input: {
  account: string;
  validity: string;
  /** When set, debits this user (PHP portal `renew(..., $this->userinfo['username'])`). Otherwise debits `accounts.username`. */
  debitUsername?: string;
}): Promise<RenewAccountResult> {
  const account = input.account.trim();
  const validity = String(input.validity ?? "").trim().toUpperCase();
  if (!account) return { ok: false, code: "no_account" };

  if (validity !== "FREE_TRIAL") {
    const months = Number.parseInt(validity, 10);
    return renewAccountByOperatorMonths({ account, months, debitUsername: input.debitUsername });
  }

  const stalker = getStalkerPool();
  if (!stalker) return { ok: false, code: "no_stalker" };
  const pool = getBillingPool();

  const [stUsers] = await stalker.execute<RowDataPacket[]>("SELECT id, mac FROM users WHERE login = :l LIMIT 1", { l: account });
  if (!stUsers.length) return { ok: false, code: "no_stalker_user" };
  const stalkerMac = stUsers[0].mac != null ? String(stUsers[0].mac) : "";

  const [accRows] = await pool.execute<RowDataPacket[]>("SELECT expires FROM accounts WHERE account = :a LIMIT 1", { a: account });
  if (!accRows.length) return { ok: false, code: "no_account" };
  const expiresStr = accRows[0].expires != null ? String(accRows[0].expires) : "";
  const baseDate = expiresStr ? new Date(expiresStr.replace(" ", "T")) : undefined;
  const expiry_date = computeExpiryDatePhp("FREE_TRIAL", baseDate && Number.isFinite(baseDate.getTime()) ? baseDate : undefined);

  // PHP controller free-trial restrictions (`is_retry_trial`, `number_retry_trial`).
  const isRetryTrial = (await getConfigInt(pool, "is_retry_trial", 0)) === 1;
  const numberRetryTrial = Math.max(0, await getConfigInt(pool, "number_retry_trial", 0));
  const [usedRows] = await pool.execute<RowDataPacket[]>("SELECT COUNT(*) AS n FROM free_trial_users WHERE mac = :m", {
    m: stalkerMac,
  });
  const usedTrialCount = Number(usedRows[0]?.n ?? 0);
  if (!isRetryTrial && usedTrialCount > 0) return { ok: false, code: "trial_used" };
  if (isRetryTrial && usedTrialCount >= numberRetryTrial) return { ok: false, code: "trial_limit" };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute("INSERT INTO free_trial_users (mac, free_trial_end_date) VALUES (:m, :e)", {
      m: stalkerMac,
      e: expiry_date,
    });
    await conn.execute("UPDATE accounts SET expires = :e WHERE account = :a", { e: expiry_date, a: account });
    await conn.execute("UPDATE user_credit_summarize SET expiry_date = :e WHERE account = :a", { e: expiry_date, a: account });
    await conn.commit();
  } catch {
    await conn.rollback();
    return { ok: false, code: "db" };
  } finally {
    conn.release();
  }

  return { ok: true, mode: "trial" };
}

function subtractMonthsPhp(datetimeLike: string, months: number): string {
  const dt = new Date(datetimeLike.replace(" ", "T"));
  if (!Number.isFinite(dt.getTime())) return formatMysqlDateTime(new Date());
  dt.setMonth(dt.getMonth() - months);
  return formatMysqlDateTime(dt);
}

/**
 * Calendar span in whole months matching PHP `($a->diff($b)->y * 12) + $a->diff($b)->m`
 * for `Users::check_renew_validity` (reseller RCDT), verified against PHP for sample dates.
 */
export function phpCalendarYearMonthsBetween(dateA: Date, dateB: Date): number {
  const t1 = dateA.getTime();
  const t2 = dateB.getTime();
  const dEarly = t1 <= t2 ? dateA : dateB;
  const dLate = t1 <= t2 ? dateB : dateA;
  let y = dLate.getFullYear() - dEarly.getFullYear();
  let m = dLate.getMonth() - dEarly.getMonth();
  const day = dLate.getDate() - dEarly.getDate();
  if (day < 0) m -= 1;
  if (m < 0) {
    y -= 1;
    m += 12;
  }
  return y * 12 + m;
}

/** PHP reseller/dealer `check_validity_format`: FREE_TRIAL, 1_MONTH_FREE, or months 1..24 */
export function operatorRenewValidityFormatLikePhp(validity: string): boolean {
  const v = validity.trim().toUpperCase();
  if (v === "FREE_TRIAL" || v === "1_MONTH_FREE") return true;
  const n = Number.parseInt(validity.trim(), 10);
  return Number.isFinite(n) && n >= 1 && n <= 24;
}

export type PortalOperatorRcdtPrecheckResult =
  | { ok: true }
  | { ok: false; code: "reseller_months"; maxMonths: number; required: number }
  | { ok: false; code: "insufficient_recoverable"; balance: number; required: number }
  | { ok: false; code: "no_summarize" }
  | { ok: false; code: "no_account" };

/**
 * PHP portal `check_renew_validity` for RCDT only (form branch):
 * - **Reseller**: months between `accounts.expires` and now, same y/m formula as PHP `DateTime::diff`.
 * - **Dealer / manager**: `users_model->get_balance(account)` i.e. `max_credit_recoverable` vs credits (dealer controller; manager has no RCDT route — same rule as dealer when RCDT is used).
 */
export async function portalOperatorRcdtPrecheckLikePhp(input: {
  ownerType: "MNGR" | "SRSLR" | "RSLR";
  account: string;
  credits: number;
}): Promise<PortalOperatorRcdtPrecheckResult> {
  const account = input.account.trim();
  const credits = Math.floor(Number(input.credits));
  if (!account || !Number.isFinite(credits) || credits < 1) {
    return { ok: false, code: "no_account" };
  }

  const pool = getBillingPool();

  if (input.ownerType === "SRSLR") {
    const [accRows] = await pool.execute<RowDataPacket[]>("SELECT expires FROM accounts WHERE account = :a LIMIT 1", { a: account });
    if (!accRows.length) return { ok: false, code: "no_account" };
    const expStr = accRows[0].expires != null ? String(accRows[0].expires) : "";
    const exp = new Date(expStr.replace(" ", "T"));
    const now = new Date();
    if (!Number.isFinite(exp.getTime())) {
      return { ok: false, code: "reseller_months", maxMonths: 0, required: credits };
    }
    const monthSpan = phpCalendarYearMonthsBetween(exp, now);
    if (monthSpan < credits) {
      return { ok: false, code: "reseller_months", maxMonths: monthSpan, required: credits };
    }
    return { ok: true };
  }

  const [sumRows] = await pool.execute<RowDataPacket[]>(
    "SELECT max_credit_recoverable FROM user_credit_summarize WHERE account = :a LIMIT 1",
    { a: account },
  );
  if (!sumRows.length) return { ok: false, code: "no_summarize" };
  const balance = Math.max(0, Number(sumRows[0].max_credit_recoverable ?? 0));
  if (balance < credits) {
    return { ok: false, code: "insufficient_recoverable", balance, required: credits };
  }
  return { ok: true };
}

async function calculateRecoverDateLikePhp(
  conn: PoolConnection,
  account: string,
  creditsBase: number,
  userExpired: string,
): Promise<{ expiry_date: string; freeMonth: number }> {
  let freeMonth = 0;
  let credits = creditsBase;

  const [recoverRows] = await conn.execute<RowDataPacket[]>(
    "SELECT COALESCE(SUM(periods), 0) AS credit_recover FROM transactions WHERE account = :a AND type = 'CRDT'",
    { a: account },
  );
  credits += Number(recoverRows[0]?.credit_recover ?? 0);

  let txRows: RowDataPacket[] = [];
  let hasSubtractFlag = true;
  try {
    [txRows] = await conn.execute<RowDataPacket[]>(
      "SELECT `transaction`, periods, free_month, is_subtract_free_month FROM transactions WHERE account = :a AND type = 'DBIT' ORDER BY `timestamp` DESC",
      { a: account },
    );
  } catch {
    hasSubtractFlag = false;
    [txRows] = await conn.execute<RowDataPacket[]>(
      "SELECT `transaction`, periods, free_month FROM transactions WHERE account = :a AND type = 'DBIT' ORDER BY `timestamp` DESC",
      { a: account },
    );
  }

  for (const tx of txRows) {
    const wasSubtracted = Number(tx.is_subtract_free_month ?? 0) === 1;
    if (!wasSubtracted) {
      freeMonth += Number(tx.free_month ?? 0);
      if (hasSubtractFlag) {
        await conn.execute(
          "UPDATE transactions SET is_subtract_free_month = 1 WHERE account = :a AND `transaction` = :t",
          { a: account, t: Number(tx.transaction ?? 0) },
        );
      }
    }
    if (credits <= Number(tx.periods ?? 0)) break;
    credits -= Number(tx.periods ?? 0);
  }

  const expiry_date = subtractMonthsPhp(userExpired, freeMonth + creditsBase);
  return { expiry_date, freeMonth };
}

async function insertRecoverCreditLikePhp(
  conn: PoolConnection,
  input: { ownerUsername: string; account: string; credits: number; expiry_date: string; coverageStart: string; freeMonth: number },
) {
  const [[row]] = await conn.execute<RowDataPacket[]>(
    "SELECT COALESCE(MAX(`transaction`), 0) + 1 AS n FROM transactions WHERE username = :u",
    { u: input.ownerUsername },
  );
  const tx = Number(row?.n ?? 1);
  const base = {
    username: input.ownerUsername,
    transaction: tx,
    periods: input.credits,
    timestamp: formatMysqlDateTime(new Date()),
    coverage_start: input.coverageStart,
    coverage_end: input.expiry_date,
    remarks: `${input.ownerUsername} reversed ${input.credits} credits to ${input.account}`,
    free_month: input.freeMonth + input.credits,
    account: input.account,
  };
  const sqlUserTx = `INSERT INTO transactions (username, type, \`transaction\`, periods, \`timestamp\`, coverage_start, coverage_end, remarks, free_month, user_transaction, account)
     VALUES (:username, 'CRDT', :transaction, :periods, :timestamp, :coverage_start, :coverage_end, :remarks, :free_month, 1, :account)`;
  const sqlLegacy = `INSERT INTO transactions (username, type, \`transaction\`, periods, \`timestamp\`, coverage_start, coverage_end, remarks, free_month, account)
     VALUES (:username, 'CRDT', :transaction, :periods, :timestamp, :coverage_start, :coverage_end, :remarks, :free_month, :account)`;
  const sqlAmount = `INSERT INTO transactions (username, type, \`transaction\`, periods, \`timestamp\`, coverage_start, coverage_end, remarks, free_month, user_transaction, amount, account)
     VALUES (:username, 'CRDT', :transaction, :periods, :timestamp, :coverage_start, :coverage_end, :remarks, :free_month, 1, :amount, :account)`;
  try {
    await conn.execute(sqlUserTx, base);
  } catch (e) {
    if (isMysqlUnknownColumn(e, "user_transaction") || isMysqlUnknownColumn(e, "'user_transaction'")) {
      await conn.execute(sqlLegacy, base);
    } else if (isMysqlNoDefaultForField(e, "amount") || isMysqlNoDefaultForField(e, "'amount'")) {
      try {
        await conn.execute(sqlAmount, { ...base, amount: input.credits });
      } catch (e2) {
        if (isMysqlUnknownColumn(e2, "user_transaction") || isMysqlUnknownColumn(e2, "'user_transaction'")) {
          await conn.execute(
            `INSERT INTO transactions (username, type, \`transaction\`, periods, \`timestamp\`, coverage_start, coverage_end, remarks, free_month, amount, account)
             VALUES (:username, 'CRDT', :transaction, :periods, :timestamp, :coverage_start, :coverage_end, :remarks, :free_month, :amount, :account)`,
            { ...base, amount: input.credits },
          );
        } else {
          throw e2;
        }
      }
    } else {
      throw e;
    }
  }
}

/** PHP `Users_model::recover_credits` parity for RCDT flow. */
export async function recoverAccountCreditsByOperator(input: {
  account: string;
  credits: number;
}): Promise<RenewAccountResult> {
  const credits = Math.floor(Number(input.credits));
  if (!Number.isFinite(credits) || credits < 1 || credits > 2000) return { ok: false, code: "invalid" };
  const account = input.account.trim();
  if (!account) return { ok: false, code: "no_account" };

  const stalker = getStalkerPool();
  if (!stalker) return { ok: false, code: "no_stalker" };
  const pool = getBillingPool();

  const [stUsers] = await stalker.execute<RowDataPacket[]>("SELECT id FROM users WHERE login = :l LIMIT 1", { l: account });
  if (!stUsers.length) return { ok: false, code: "no_stalker_user" };

  const [accRows] = await pool.execute<RowDataPacket[]>("SELECT username, expires FROM accounts WHERE account = :a LIMIT 1", { a: account });
  if (!accRows.length) return { ok: false, code: "no_account" };
  const ownerUsername = String(accRows[0].username ?? "");
  const userExpired = accRows[0].expires != null ? String(accRows[0].expires) : formatMysqlDateTime(new Date());

  const [sumRows] = await pool.execute<RowDataPacket[]>(
    "SELECT start_date, max_credit_recoverable FROM user_credit_summarize WHERE account = :a LIMIT 1",
    { a: account },
  );
  if (!sumRows.length) return { ok: false, code: "no_summarize" };
  const recoverable = Number(sumRows[0].max_credit_recoverable ?? 0);
  if (recoverable <= 0 || recoverable < credits) {
    return { ok: false, code: "insufficient_recoverable", balance: recoverable, required: credits };
  }
  const coverageStart = sumRows[0].start_date != null ? String(sumRows[0].start_date) : formatMysqlDateTime(new Date());

  const conn = await pool.getConnection();
  let expiry_date = userExpired;
  try {
    await conn.beginTransaction();
    const calc = await calculateRecoverDateLikePhp(conn, account, credits, userExpired);
    expiry_date = calc.expiry_date;

    await insertRecoverCreditLikePhp(conn, {
      ownerUsername,
      account,
      credits,
      expiry_date,
      coverageStart,
      freeMonth: calc.freeMonth,
    });

    await conn.execute("UPDATE accounts SET expires = :e WHERE account = :a", { e: expiry_date, a: account });
    await conn.execute(
      "UPDATE user_credit_summarize SET expiry_date = :e, max_credit_recoverable = max_credit_recoverable - :c WHERE account = :a",
      { e: expiry_date, c: credits, a: account },
    );
    await conn.commit();
  } catch {
    await conn.rollback();
    return { ok: false, code: "db" };
  } finally {
    conn.release();
  }

  try {
    await stalker.execute("UPDATE users SET expire_billing_date = :e WHERE login = :l", { e: expiry_date, l: account });
  } catch {
    return { ok: false, code: "db" };
  }

  return { ok: true, mode: "recover" };
}

/**
 * Add paid months to an account (PHP `Users_model::renew` non–free-trial path): debit operator,
 * extend `accounts.expires`, update `user_credit_summarize`, Stalker `expire_billing_date`, activate + `cut_on`.
 */
export async function renewAccountByOperatorMonths(input: {
  account: string;
  months: number;
  debitUsername?: string;
}): Promise<RenewAccountResult> {
  const months = Math.floor(Number(input.months));
  if (!Number.isFinite(months) || months < 1 || months > 24) return { ok: false, code: "invalid" };

  const stalker = getStalkerPool();
  if (!stalker) return { ok: false, code: "no_stalker" };

  const pool = getBillingPool();
  const account = input.account.trim();

  const [stUsers] = await stalker.execute<RowDataPacket[]>("SELECT id, status FROM users WHERE login = :l LIMIT 1", { l: account });
  if (!stUsers.length) return { ok: false, code: "no_stalker_user" };
  const stalkerUid = Number(stUsers[0].id);

  const [accRows] = await pool.execute<RowDataPacket[]>(
    "SELECT username, expires FROM accounts WHERE account = :a LIMIT 1",
    { a: account },
  );
  if (!accRows.length) return { ok: false, code: "no_account" };
  const accountOwnerUsername = String(accRows[0].username ?? "");
  const debitUsername = String(input.debitUsername ?? "").trim() || accountOwnerUsername;
  const expiresStr = accRows[0].expires != null ? String(accRows[0].expires) : "";
  const expired = isBillingAccountExpired(expiresStr);

  const balance = await getCreditBalance(debitUsername);
  if (balance < months) {
    return { ok: false, code: "insufficient_credits", balance, required: months };
  }

  const [sumRows] = await pool.execute<RowDataPacket[]>(
    "SELECT start_date, max_credit_recoverable FROM user_credit_summarize WHERE account = :a LIMIT 1",
    { a: account },
  );
  if (!sumRows.length) return { ok: false, code: "no_summarize" };

  const nowStr = formatMysqlDateTime(new Date());
  const coverageStart = expired ? nowStr : expiresStr;
  const expiry_date = expired
    ? computeExpiryDatePhp(String(months))
    : computeExpiryDatePhp(String(months), new Date(expiresStr.replace(" ", "T")));

  const [dedRows] = await pool.execute<RowDataPacket[]>(
    "SELECT month, month_deduction FROM credit_deductions ORDER BY month ASC",
  );
  const deductionMap = buildMonthDeductionChargedMap(
    dedRows.map((d) => ({ month: Number(d.month), month_deduction: Number(d.month_deduction) })),
  );
  const creditsSummarizeBase = deductionMap[months] !== undefined ? deductionMap[months] : months;

  const startDateStr = sumRows[0].start_date != null ? String(sumRows[0].start_date) : nowStr;
  let maxRec = Number(sumRows[0].max_credit_recoverable ?? 0);
  let cAdj = creditsSummarizeBase;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await insertDebitLikePhp(conn, {
      username: debitUsername,
      account,
      expires: expiry_date,
      coverageStart,
      credits: months,
      type: "DBIT",
      numberFree: 0,
      deductionMap,
    });

    await conn.execute(
      `UPDATE accounts SET expires = :e, status = :st WHERE account = :a`,
      { e: expiry_date, st: ACCOUNT_STATUS_ON, a: account },
    );

    if (startDateStr > nowStr) {
      await conn.execute(
        `UPDATE user_credit_summarize SET start_date = :sd, max_credit_recoverable = 0, updated_at = :u WHERE account = :a`,
        { sd: nowStr, u: nowStr, a: account },
      );
      maxRec = 0;
    }

    if (maxRec === 0 && nowStr > coverageStart) {
      cAdj = Math.max(0, cAdj - 1);
    }

    await conn.execute(
      `UPDATE user_credit_summarize SET expiry_date = :ed, max_credit_recoverable = max_credit_recoverable + :add, updated_at = :u WHERE account = :a`,
      { ed: expiry_date, add: Math.floor(cAdj), u: nowStr, a: account },
    );

    await conn.commit();
  } catch {
    await conn.rollback();
    conn.release();
    return { ok: false, code: "db" };
  }
  conn.release();

  try {
    await stalker.execute("UPDATE users SET expire_billing_date = :e WHERE login = :l", { e: expiry_date, l: account });

    const [stAfter] = await stalker.execute<RowDataPacket[]>("SELECT status FROM users WHERE login = :l LIMIT 1", { l: account });
    const stNow = Number(stAfter[0]?.status ?? 0);

    const [accFresh] = await pool.execute<RowDataPacket[]>("SELECT expires FROM accounts WHERE account = :a LIMIT 1", { a: account });
    const freshExp = accFresh[0]?.expires != null ? String(accFresh[0].expires) : "";
    const stillExpiredForChangeStatus = isBillingAccountExpired(freshExp);

    // PHP `change_status(ACCOUNT_STATUS_ON, …)` when not (billing expired && requesting ON).
    if (!stillExpiredForChangeStatus && stNow !== ACCOUNT_STATUS_ON) {
      await stalkerCutOnOff(stalker, stalkerUid, "on");
    }
    await stalkerCutOnOff(stalker, stalkerUid, "on");
  } catch {
    return { ok: false, code: "db" };
  }

  return { ok: true, mode: "months" };
}

export async function verifyUserPassword(username: string, oldPassword: string): Promise<boolean> {
  const pool = getBillingPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT password FROM users WHERE username = :u LIMIT 1`,
    { u: username },
  );
  const p = rows[0]?.password;
  return verifyPassword(oldPassword, p != null ? String(p) : "");
}

export async function setUserPassword(username: string, newPassword: string) {
  const pool = getBillingPool();
  const [res] = await pool.execute<ResultSetHeader>(
    `UPDATE users SET password = :p WHERE username = :u`,
    { p: newPassword, u: username },
  );
  return res.affectedRows === 1;
}

async function insertStalkerEventMessage(
  stalker: ReturnType<typeof getStalkerPool>,
  uid: number,
  message: string,
  priority = 2,
): Promise<boolean> {
  if (!stalker || !Number.isFinite(uid) || uid <= 0) return false;
  const pri = Math.min(3, Math.max(1, Math.floor(priority)));
  const date = new Date();
  const addtime = formatMysqlDateTime(date);
  const future = new Date(date.getTime() + 60 * 24 * 1000);
  const eventtime = formatMysqlDateTime(future);
  try {
    await stalker.execute(
      `INSERT INTO events (uid, event, msg, priority, addtime, need_confirm, eventtime) VALUES (:uid, 'send_msg', :msg, :pri, :addtime, 1, :eventtime)`,
      { uid, msg: message, pri, addtime, eventtime },
    );
    return true;
  } catch {
    return false;
  }
}

/** PHP `Message::index` branch when `type != 'All'`: one `send_msg` row per posted Stalker `users` id. */
export async function sendStalkerMessageToUserIds(uids: number[], message: string, priority?: number): Promise<number> {
  const msg = message.trim();
  if (!msg) return 0;
  const stalker = getStalkerPool();
  if (!stalker) return 0;
  if (!(await stalkerHasEventsTable(stalker))) return 0;
  const pri = priority === undefined ? 2 : Math.min(3, Math.max(1, Math.floor(priority)));
  const unique = [...new Set(uids.map((u) => Math.floor(Number(u))).filter((u) => Number.isFinite(u) && u > 0))];
  let n = 0;
  for (const uid of unique) {
    if (await insertStalkerEventMessage(stalker, uid, msg, pri)) n++;
  }
  return n;
}

export type SendUserMessageResult =
  | { ok: true }
  | { ok: false; code: "stalker" | "no_user" | "no_events" | "db" };

/** PHP `Users::message` parity for one user (stalker event insert by login). */
export async function sendStalkerMessageToAccount(account: string, message: string): Promise<SendUserMessageResult> {
  const a = account.trim();
  const msg = message.trim();
  if (!a || !msg) return { ok: false, code: "no_user" };
  const stalker = getStalkerPool();
  if (!stalker) return { ok: false, code: "stalker" };
  if (!(await stalkerHasEventsTable(stalker))) return { ok: false, code: "no_events" };
  const [rows] = await stalker.execute<RowDataPacket[]>("SELECT id FROM users WHERE login = :l LIMIT 1", { l: a });
  if (!rows.length) return { ok: false, code: "no_user" };
  const uid = Number(rows[0]?.id ?? 0);
  const ok = await insertStalkerEventMessage(stalker, uid, msg, 2);
  return ok ? { ok: true } : { ok: false, code: "db" };
}

export async function broadcastStalkerMessage(message: string, priority?: number): Promise<number> {
  const msg = message.trim();
  if (!msg) return 0;
  const stalker = getStalkerPool();
  if (!stalker) return 0;
  if (!(await stalkerHasEventsTable(stalker))) return 0;
  const pri = priority === undefined ? 2 : Math.min(3, Math.max(1, Math.floor(priority)));
  const [users] = await stalker.execute<RowDataPacket[]>("SELECT id FROM users ORDER BY id ASC");
  let n = 0;
  for (const u of users) {
    if (await insertStalkerEventMessage(stalker, Number(u.id), msg, pri)) n++;
  }
  return n;
}

/** Admin message “All users”: send to Stalker users mapped from billing subscriber accounts. */
export async function broadcastStalkerMessageAdminSubscribers(message: string, priority?: number): Promise<number> {
  const msg = message.trim();
  if (!msg) return 0;
  const stalker = getStalkerPool();
  if (!stalker) return 0;
  if (!(await stalkerHasEventsTable(stalker))) return 0;
  const pri = priority === undefined ? 2 : Math.min(3, Math.max(1, Math.floor(priority)));
  const logins = await listAdminAccountLogins(25000);
  if (!logins.length) return 0;
  const uids = await resolveAdminAccountLoginsToStalkerUids(logins);
  if (!uids.length) return 0;
  let n = 0;
  for (const uid of uids) {
    if (await insertStalkerEventMessage(stalker, uid, msg, pri)) n++;
  }
  return n;
}

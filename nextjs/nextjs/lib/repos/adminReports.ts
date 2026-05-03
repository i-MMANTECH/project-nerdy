import type { RowDataPacket } from "mysql2";
import { getBillingPool, getStalkerPool } from "@/lib/db/pool";

const ACCOUNT_ON = 0;

export type AdminReportRange = 7 | 30 | 90 | 365;

export function parseAdminReportRange(raw: string | null | undefined): AdminReportRange {
  const n = Number(raw);
  if (n === 7 || n === 30 || n === 90 || n === 365) return n;
  return 30;
}

function pctChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export type AdminReportKpiBlock = {
  value: number;
  previous: number;
  pctVsPrevious: number | null;
};

export type AdminReportKpis = {
  rangeDays: AdminReportRange;
  revenueUsd: AdminReportKpiBlock;
  newSubscribers: AdminReportKpiBlock;
  /** Approximation: expired accounts in window ÷ active accounts × 100. */
  churnRatePct: AdminReportKpiBlock;
  arpuUsd: AdminReportKpiBlock;
  activeUsers: number;
};

export type AdminReportGrowthPoint = { key: string; label: string; newAccounts: number; revenue: number };

export type AdminReportDealerRow = {
  rank: number;
  dealer: string;
  subscribers: number;
  revenue: number;
  growthPct: number | null;
};

export type AdminReportExpiringRow = {
  label: string;
  count: number;
  potentialUsd: number;
};

export type AdminReportPackageRow = { name: string; count: number };

export type AdminReportsPayload = {
  rangeDays: AdminReportRange;
  kpis: AdminReportKpis;
  growth: AdminReportGrowthPoint[];
  topDealers: AdminReportDealerRow[];
  expiring: AdminReportExpiringRow[];
  packages: AdminReportPackageRow[];
};

async function sumRevenueUsdSince(pool: ReturnType<typeof getBillingPool>, sinceSql: string, params: number[]) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COALESCE(SUM(ABS(CAST(amount AS DECIMAL(14,2)))), 0) AS r
     FROM transactions
     WHERE \`timestamp\` >= ${sinceSql}
       AND amount IS NOT NULL AND TRIM(COALESCE(amount, '')) <> ''`,
    params,
  );
  return Math.round(Number(rows[0]?.r ?? 0) * 100) / 100;
}

async function countNewAccountsSince(pool: ReturnType<typeof getBillingPool>, sinceSql: string, params: number[]) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM accounts WHERE created IS NOT NULL AND created >= ${sinceSql}`,
    params,
  );
  return Math.floor(Number(rows[0]?.c ?? 0));
}

async function countExpiredInWindow(pool: ReturnType<typeof getBillingPool>, startSql: string, endSql: string, params: number[]) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM accounts
     WHERE expires IS NOT NULL
       AND expires > '1970-01-01 00:00:00'
       AND expires >= ${startSql}
       AND expires < ${endSql}`,
    params,
  );
  return Math.floor(Number(rows[0]?.c ?? 0));
}

async function activeUsers(pool: ReturnType<typeof getBillingPool>) {
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) AS c FROM accounts WHERE status = ?",
    [ACCOUNT_ON],
  );
  return Math.floor(Number(rows[0]?.c ?? 0));
}

export async function loadAdminReportsPayload(rangeDays: AdminReportRange): Promise<AdminReportsPayload> {
  const pool = getBillingPool();
  const d = rangeDays;
  const d2 = d * 2;

  const [
    revCur,
    revPrev,
    newCur,
    newPrev,
    expiredCur,
    expiredPrev,
    act,
  ] = await Promise.all([
    sumRevenueUsdSince(pool, "DATE_SUB(NOW(), INTERVAL ? DAY)", [d]),
    sumRevenueUsdSince(pool, "DATE_SUB(NOW(), INTERVAL ? DAY) AND `timestamp` < DATE_SUB(NOW(), INTERVAL ? DAY)", [d2, d]),
    countNewAccountsSince(pool, "DATE_SUB(NOW(), INTERVAL ? DAY)", [d]),
    countNewAccountsSince(pool, "DATE_SUB(NOW(), INTERVAL ? DAY) AND created < DATE_SUB(NOW(), INTERVAL ? DAY)", [d2, d]),
    countExpiredInWindow(pool, "DATE_SUB(NOW(), INTERVAL ? DAY)", "NOW()", [d]),
    countExpiredInWindow(pool, "DATE_SUB(NOW(), INTERVAL ? DAY)", "DATE_SUB(NOW(), INTERVAL ? DAY)", [d2, d]),
    activeUsers(pool),
  ]);

  const churnCur = act > 0 ? (100 * expiredCur) / act : 0;
  const churnPrev = act > 0 ? (100 * expiredPrev) / act : 0;
  const arpuCur = act > 0 ? revCur / act : 0;
  const arpuPrev = act > 0 ? revPrev / act : 0;

  const kpis: AdminReportKpis = {
    rangeDays: d,
    revenueUsd: { value: revCur, previous: revPrev, pctVsPrevious: pctChange(revCur, revPrev) },
    newSubscribers: { value: newCur, previous: newPrev, pctVsPrevious: pctChange(newCur, newPrev) },
    churnRatePct: {
      value: Math.round(churnCur * 10) / 10,
      previous: Math.round(churnPrev * 10) / 10,
      pctVsPrevious: pctChange(churnCur, churnPrev),
    },
    arpuUsd: {
      value: Math.round(arpuCur * 100) / 100,
      previous: Math.round(arpuPrev * 100) / 100,
      pctVsPrevious: pctChange(arpuCur, arpuPrev),
    },
    activeUsers: act,
  };

  const chartDays = Math.min(d, 90);
  const [growthExec, dealerExec, expiringExec, pkgRows] = await Promise.all([
    pool.execute<RowDataPacket[]>(
      `SELECT DATE(a.created) AS d, COUNT(*) AS c
       FROM accounts a
       WHERE a.created IS NOT NULL AND a.created >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY DATE(a.created)
       ORDER BY d ASC`,
      [chartDays],
    ),
    pool.execute<RowDataPacket[]>(
      `SELECT a.username AS dealer,
              COUNT(*) AS subscribers,
              COALESCE(SUM(tx.rev), 0) AS revenue
       FROM accounts a
       INNER JOIN users u ON u.username = a.username AND u.type = 'RSLR'
       LEFT JOIN (
         SELECT username AS dealer_login,
                SUM(ABS(CAST(amount AS DECIMAL(14,2)))) AS rev
         FROM transactions
         WHERE \`timestamp\` >= DATE_SUB(NOW(), INTERVAL ? DAY)
           AND amount IS NOT NULL AND TRIM(COALESCE(amount, '')) <> ''
         GROUP BY username
       ) tx ON tx.dealer_login = a.username
       GROUP BY a.username
       ORDER BY 3 DESC, 2 DESC
       LIMIT 8`,
      [d],
    ),
    pool.execute<RowDataPacket[]>(
      `SELECT a.account, a.expires
       FROM accounts a
       WHERE a.status = ?
         AND a.expires IS NOT NULL
         AND a.expires > NOW()
         AND a.expires <= DATE_ADD(NOW(), INTERVAL 30 DAY)
       ORDER BY a.expires ASC
       LIMIT 800`,
      [ACCOUNT_ON],
    ),
    loadPackageDistribution(),
  ]);

  const [createdByDay] = growthExec;
  const createdMap = new Map<string, number>();
  for (const r of createdByDay) {
    const key = r.d != null ? String(r.d).slice(0, 10) : "";
    if (key) createdMap.set(key, Math.floor(Number(r.c ?? 0)));
  }

  const [revDayRows] = await pool.execute<RowDataPacket[]>(
    `SELECT DATE(\`timestamp\`) AS d,
            COALESCE(SUM(ABS(CAST(amount AS DECIMAL(14,2)))), 0) AS r
     FROM transactions
     WHERE \`timestamp\` >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       AND amount IS NOT NULL AND TRIM(COALESCE(amount, '')) <> ''
     GROUP BY DATE(\`timestamp\`)
     ORDER BY d ASC`,
    [chartDays],
  );
  const revMap = new Map<string, number>();
  for (const r of revDayRows) {
    const key = r.d != null ? String(r.d).slice(0, 10) : "";
    if (key) revMap.set(key, Math.round(Number(r.r ?? 0) * 100) / 100);
  }

  const keys = new Set<string>([...createdMap.keys(), ...revMap.keys()]);
  const sortedKeys = [...keys].sort();
  const growth: AdminReportGrowthPoint[] = sortedKeys.map((key) => {
    const tick =
      key.length >= 10
        ? new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })
        : key;
    return {
      key,
      label: tick,
      newAccounts: createdMap.get(key) ?? 0,
      revenue: revMap.get(key) ?? 0,
    };
  });

  const [dealerData] = dealerExec;
  const prevDealerRev = await loadPreviousDealerRevenueMap(pool, d);
  const topDealers: AdminReportDealerRow[] = dealerData.map((r, i) => {
    const dealer = String(r.dealer ?? "");
    const revenue = Math.round(Number(r.revenue ?? 0) * 100) / 100;
    const prev = prevDealerRev.get(dealer) ?? 0;
    return {
      rank: i + 1,
      dealer,
      subscribers: Math.floor(Number(r.subscribers ?? 0)),
      revenue,
      growthPct: pctChange(revenue, prev),
    };
  });

  const [accRows] = expiringExec;
  type Bucket = "d0" | "d3" | "d7" | "d30";
  const bucketCounts: Record<Bucket, string[]> = { d0: [], d3: [], d7: [], d30: [] };
  const now = Date.now();
  const add = (ms: number) => now + ms;
  for (const r of accRows) {
    const account = String(r.account ?? "");
    const ex = r.expires != null ? String(r.expires) : "";
    if (!account || !ex) continue;
    const t = Date.parse(ex.includes("T") ? ex : ex.replace(" ", "T"));
    if (!Number.isFinite(t) || t <= now) continue;
    const day = 86400000;
    if (t <= add(1 * day)) bucketCounts.d0.push(account);
    else if (t <= add(3 * day)) bucketCounts.d3.push(account);
    else if (t <= add(7 * day)) bucketCounts.d7.push(account);
    else if (t <= add(30 * day)) bucketCounts.d30.push(account);
  }

  const allExpiring = [...new Set([...bucketCounts.d0, ...bucketCounts.d3, ...bucketCounts.d7, ...bucketCounts.d30])];
  const revByAccount = await sumRevenueByAccountLastDays(pool, allExpiring, 120);

  const sumPot = (ids: string[]) => ids.reduce((s, a) => s + (revByAccount.get(a) ?? 0), 0);
  const expiring: AdminReportExpiringRow[] = [
    { label: "Next 24 hours", count: bucketCounts.d0.length, potentialUsd: Math.round(sumPot(bucketCounts.d0) * 100) / 100 },
    { label: "Next 3 days", count: bucketCounts.d3.length, potentialUsd: Math.round(sumPot(bucketCounts.d3) * 100) / 100 },
    { label: "Next 7 days", count: bucketCounts.d7.length, potentialUsd: Math.round(sumPot(bucketCounts.d7) * 100) / 100 },
    { label: "Next 30 days", count: bucketCounts.d30.length, potentialUsd: Math.round(sumPot(bucketCounts.d30) * 100) / 100 },
  ];

  return {
    rangeDays: d,
    kpis,
    growth,
    topDealers,
    expiring,
    packages: pkgRows,
  };
}

async function loadPreviousDealerRevenueMap(pool: ReturnType<typeof getBillingPool>, d: number) {
  const map = new Map<string, number>();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT username AS dealer_login,
            SUM(ABS(CAST(amount AS DECIMAL(14,2)))) AS rev
     FROM transactions
     WHERE \`timestamp\` >= DATE_SUB(NOW(), INTERVAL ? DAY)
       AND \`timestamp\` < DATE_SUB(NOW(), INTERVAL ? DAY)
       AND amount IS NOT NULL AND TRIM(COALESCE(amount, '')) <> ''
     GROUP BY username`,
    [d * 2, d],
  );
  for (const r of rows) {
    const k = String(r.dealer_login ?? "");
    if (k) map.set(k, Math.round(Number(r.rev ?? 0) * 100) / 100);
  }
  return map;
}

async function sumRevenueByAccountLastDays(
  pool: ReturnType<typeof getBillingPool>,
  accounts: string[],
  days: number,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (accounts.length === 0) return map;
  const uniq = [...new Set(accounts)].slice(0, 800);
  const ph = uniq.map(() => "?").join(",");
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT account AS acct,
            COALESCE(SUM(ABS(CAST(amount AS DECIMAL(14,2)))), 0) AS rev
     FROM transactions
     WHERE account IN (${ph})
       AND \`timestamp\` >= DATE_SUB(NOW(), INTERVAL ${Math.min(365, Math.max(7, days))} DAY)
       AND amount IS NOT NULL AND TRIM(COALESCE(amount, '')) <> ''
     GROUP BY account`,
    uniq,
  );
  for (const r of rows) {
    const a = String(r.acct ?? "");
    if (a) map.set(a, Math.round(Number(r.rev ?? 0) * 100) / 100);
  }
  return map;
}

async function loadPackageDistribution(): Promise<AdminReportPackageRow[]> {
  const stalker = getStalkerPool();
  if (!stalker) return [];
  try {
    const [rows] = await stalker.execute<RowDataPacket[]>(
      `SELECT x.nm AS plan_name, COUNT(*) AS c
       FROM (
         SELECT COALESCE(NULLIF(TRIM(tp.name), ''), CONCAT('Plan #', u.tariff_plan_id)) AS nm
         FROM users u
         LEFT JOIN tariff_plan tp ON tp.id = u.tariff_plan_id
       ) x
       GROUP BY x.nm
       ORDER BY c DESC
       LIMIT 10`,
    );
    return rows.map((r) => ({
      name: String(r.plan_name ?? "Unknown"),
      count: Math.floor(Number(r.c ?? 0)),
    }));
  } catch {
    return [];
  }
}

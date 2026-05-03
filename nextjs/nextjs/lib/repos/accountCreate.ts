import { createHash } from "node:crypto";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { getBillingPool, getStalkerPool } from "@/lib/db/pool";
import { getCreditBalance } from "@/lib/repos/creditBalance";
import {
  getStalkerCustomPackagePlanId,
  listStalkerPackagesForPlan,
  setStalkerUserPackageSubscriptions,
} from "@/lib/repos/stalkerUserPackages";

const ACCOUNT_STATUS_ON = 0;
const ACCOUNT_STATUS_OFF = 1;

function formatMysqlDateTime(d: Date) {
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function stalkerPasswordDigest(plain: string, userId: number) {
  const inner = createHash("md5").update(plain).digest("hex");
  return createHash("md5").update(`${inner}${userId}`).digest("hex");
}

/** Mirrors `datetime_helper::get_expiry_date` (PHP billing). */
export function computeExpiryDatePhp(validity: string, baseDate?: Date): string {
  const month = String(validity);
  const now = baseDate ?? new Date();
  const datetimeNow = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());
  let datetime = baseDate ? new Date(baseDate) : new Date(datetimeNow);
  if (datetimeNow > datetime) {
    datetime = new Date(datetimeNow);
  }
  if (month !== "FREE_TRIAL") {
    const n = Number.parseInt(month, 10);
    if (Number.isFinite(n) && n > 0) {
      datetime.setMonth(datetime.getMonth() + n);
    }
  } else {
    datetime.setDate(datetime.getDate() + 2);
  }
  return formatMysqlDateTime(datetime);
}

export function buildMonthDeductionChargedMap(rows: { month: number; month_deduction: number }[]): Record<number, number> {
  const deductions = [...rows].sort((a, b) => a.month - b.month);
  const arrayMonthDeduction: Record<number, number> = {};
  for (let key = 0; key < deductions.length; key++) {
    const value = deductions[key];
    const start = value.month;
    let end: number | null = key + 1 < deductions.length ? deductions[key + 1].month : null;
    if (key + 1 === deductions.length && value.month <= 24) {
      end = 24;
    }
    if (end != null && end) {
      for (let i = start; i <= end; i++) {
        if (value.month_deduction > 0) {
          arrayMonthDeduction[i] = i - value.month_deduction;
        }
      }
    }
  }
  return arrayMonthDeduction;
}

export type TariffPlanRow = { id: number; name: string };

export async function listStalkerTariffPlans(): Promise<TariffPlanRow[]> {
  const stalker = getStalkerPool();
  if (!stalker) return [];
  const [rows] = await stalker.execute<RowDataPacket[]>(
    "SELECT id, name FROM tariff_plan ORDER BY name ASC",
  );
  return rows.map((r) => ({ id: Number(r.id), name: String(r.name ?? "") }));
}

export async function getPinDefaultFromBilling(): Promise<string> {
  const pool = getBillingPool();
  const [rows] = await pool.execute<RowDataPacket[]>("SELECT value FROM configs WHERE `key` = 'pin_default' LIMIT 1");
  const v = rows[0]?.value;
  return v != null && String(v).trim() !== "" ? String(v) : "9090";
}

export type CreateEndUserInput = {
  full_name: string;
  account: string;
  password: string;
  mac: string;
  validity: string;
  status: number;
  reseller: string;
  dealer: string;
  tariff_plan_id: number;
  monthFreeEnabled: boolean;
  /** PHP `packs[]` when tariff is Stalker “CUSTOM PACKAGE” plan — whitelisted to packages in that plan. */
  addonPackageIds?: number[];
};

export type CreateEndUserResult =
  | { ok: true; account: string }
  | {
      ok: false;
      code:
        | "stalker_required"
        | "invalid"
        | "duplicate_login"
        | "duplicate_mac"
        | "bad_owner"
        | "bad_package"
        | "bad_validity"
        | "insufficient_credits"
        | "db";
      balance?: number;
      required?: number;
    };

const MAC_RE = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;
const LOGIN_RE = /^[a-z0-9]+$/;

function normalizeMac(mac: string): string {
  return mac.trim().toUpperCase().replace(/-/g, ":");
}

async function nextTransactionNumber(conn: PoolConnection, username: string): Promise<number> {
  const [rows] = await conn.execute<RowDataPacket[]>(
    "SELECT COALESCE(MAX(`transaction`), 0) + 1 AS n FROM transactions WHERE username = :u",
    { u: username },
  );
  return Number(rows[0]?.n ?? 1);
}

function mysqlErrno(err: unknown): number | undefined {
  return (err as { errno?: number })?.errno;
}

function mysqlMessage(err: unknown): string {
  return String((err as Error)?.message ?? err ?? "");
}

function isMysqlUnknownColumn(err: unknown, column: string): boolean {
  if (mysqlErrno(err) !== 1054) return false;
  return mysqlMessage(err).includes(column);
}

function isMysqlNoDefaultForField(err: unknown, column: string): boolean {
  if (mysqlErrno(err) !== 1364) return false;
  return mysqlMessage(err).includes(column);
}

/**
 * PHP `Transaction_model::add` parity for DBIT (+ optional BONUS). Some billing DBs omit
 * `user_transaction` or require NOT NULL `amount` — same tiered INSERT as hierarchy credits.
 */
export async function insertDebitLikePhp(
  conn: PoolConnection,
  input: {
    username: string;
    account: string;
    expires: string;
    coverageStart: string;
    credits: number;
    type: "DBIT" | "BONUS";
    numberFree: number;
    deductionMap: Record<number, number>;
  },
): Promise<void> {
  const { username, account, expires, coverageStart, type } = input;
  let credits = input.credits;
  let remarks: string | null = null;
  let isBonus = false;
  let freeMonth = input.numberFree;

  if (account && input.deductionMap[credits] !== undefined) {
    freeMonth = credits - input.deductionMap[credits];
    credits = input.deductionMap[credits];
    isBonus = true;
  }

  if (account) {
    remarks = `Credit from ${username} to ${account}`;
  }

  const tx = await nextTransactionNumber(conn, username);

  const dbitBase = {
    username,
    type,
    transaction: tx,
    periods: credits,
    timestamp: coverageStart,
    coverage_start: coverageStart,
    coverage_end: expires,
    remarks,
    free_month: freeMonth,
    account,
  };

  const sqlUserTx = `INSERT INTO transactions (username, type, \`transaction\`, periods, timestamp, coverage_start, coverage_end, remarks, free_month, user_transaction, account)
     VALUES (:username, :type, :transaction, :periods, :timestamp, :coverage_start, :coverage_end, :remarks, :free_month, 1, :account)`;
  const sqlLegacy = `INSERT INTO transactions (username, type, \`transaction\`, periods, timestamp, coverage_start, coverage_end, remarks, free_month, account)
     VALUES (:username, :type, :transaction, :periods, :timestamp, :coverage_start, :coverage_end, :remarks, :free_month, :account)`;
  const sqlUserTxAmount = `INSERT INTO transactions (username, type, \`transaction\`, periods, timestamp, coverage_start, coverage_end, remarks, free_month, user_transaction, amount, account)
     VALUES (:username, :type, :transaction, :periods, :timestamp, :coverage_start, :coverage_end, :remarks, :free_month, 1, :amount, :account)`;

  try {
    await conn.execute(sqlUserTx, dbitBase);
  } catch (e) {
    if (isMysqlUnknownColumn(e, "user_transaction") || isMysqlUnknownColumn(e, "'user_transaction'")) {
      await conn.execute(sqlLegacy, dbitBase);
    } else if (isMysqlNoDefaultForField(e, "amount") || isMysqlNoDefaultForField(e, "'amount'")) {
      try {
        await conn.execute(sqlUserTxAmount, { ...dbitBase, amount: credits });
      } catch (e2) {
        if (isMysqlUnknownColumn(e2, "user_transaction") || isMysqlUnknownColumn(e2, "'user_transaction'")) {
          await conn.execute(
            `INSERT INTO transactions (username, type, \`transaction\`, periods, timestamp, coverage_start, coverage_end, remarks, free_month, amount, account)
             VALUES (:username, :type, :transaction, :periods, :timestamp, :coverage_start, :coverage_end, :remarks, :free_month, :amount, :account)`,
            { ...dbitBase, amount: credits },
          );
        } else {
          throw e2;
        }
      }
    } else {
      throw e;
    }
  }

  if (isBonus && account) {
    const bonusRemarks = `Credit from ${username} to ${account} (${freeMonth} credits free)`;
    const bonusBase = {
      username,
      account,
      transaction: tx + 1,
      timestamp: coverageStart,
      coverage_start: coverageStart,
      coverage_end: expires,
      remarks: bonusRemarks,
      free_month: freeMonth,
    };
    const sqlBonusUserTx = `INSERT INTO transactions (username, account, type, \`transaction\`, periods, timestamp, coverage_start, coverage_end, remarks, free_month, user_transaction)
       VALUES (:username, :account, 'BONUS', :transaction, 0, :timestamp, :coverage_start, :coverage_end, :remarks, :free_month, 1)`;
    const sqlBonusLegacy = `INSERT INTO transactions (username, account, type, \`transaction\`, periods, timestamp, coverage_start, coverage_end, remarks, free_month)
       VALUES (:username, :account, 'BONUS', :transaction, 0, :timestamp, :coverage_start, :coverage_end, :remarks, :free_month)`;
    const sqlBonusAmount = `INSERT INTO transactions (username, account, type, \`transaction\`, periods, timestamp, coverage_start, coverage_end, remarks, free_month, user_transaction, amount)
       VALUES (:username, :account, 'BONUS', :transaction, 0, :timestamp, :coverage_start, :coverage_end, :remarks, :free_month, 1, 0)`;

    try {
      await conn.execute(sqlBonusUserTx, bonusBase);
    } catch (e) {
      if (isMysqlUnknownColumn(e, "user_transaction") || isMysqlUnknownColumn(e, "'user_transaction'")) {
        await conn.execute(sqlBonusLegacy, bonusBase);
      } else if (isMysqlNoDefaultForField(e, "amount") || isMysqlNoDefaultForField(e, "'amount'")) {
        try {
          await conn.execute(sqlBonusAmount, bonusBase);
        } catch (e2) {
          if (isMysqlUnknownColumn(e2, "user_transaction") || isMysqlUnknownColumn(e2, "'user_transaction'")) {
            await conn.execute(
              `INSERT INTO transactions (username, account, type, \`transaction\`, periods, timestamp, coverage_start, coverage_end, remarks, free_month, amount)
               VALUES (:username, :account, 'BONUS', :transaction, 0, :timestamp, :coverage_start, :coverage_end, :remarks, :free_month, 0)`,
              bonusBase,
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
}

async function insertCreditSummarizeLikePhp(
  conn: PoolConnection,
  account: string,
  startDate: string,
  expiryDate: string,
  credits: number,
  deductionMap: Record<number, number>,
) {
  let c = credits;
  if (c > 5) {
    c = deductionMap[c] ?? c;
  }
  await conn.execute(
    `INSERT INTO user_credit_summarize (account, start_date, max_credit_recoverable, expiry_date, updated_at)
     VALUES (:account, :start_date, :max_credit_recoverable, :expiry_date, :updated_at)`,
    {
      account,
      start_date: startDate,
      max_credit_recoverable: Math.max(0, c - 1),
      expiry_date: expiryDate,
      updated_at: startDate,
    },
  );
}

/**
 * Create billing `accounts` row + Stalker `users` row (+ transactions / summarize) like PHP `Users_model::create`.
 */
export async function createEndUserAccount(raw: CreateEndUserInput): Promise<CreateEndUserResult> {
  const stalker = getStalkerPool();
  if (!stalker) return { ok: false, code: "stalker_required" };

  const account = raw.account.trim().toLowerCase();
  const password = raw.password;
  const full_name = raw.full_name.trim();
  const mac = normalizeMac(raw.mac);
  const reseller = raw.reseller.trim();
  const dealer = raw.dealer.trim();
  const ownerUsername = dealer || reseller;

  if (!account || !LOGIN_RE.test(account) || password.length < 4 || password.length > 100) {
    return { ok: false, code: "invalid" };
  }
  if (!MAC_RE.test(mac)) return { ok: false, code: "invalid" };
  if (!reseller) return { ok: false, code: "bad_owner" };
  if (!Number.isFinite(raw.tariff_plan_id) || raw.tariff_plan_id <= 0) return { ok: false, code: "bad_package" };

  let validity = raw.validity.trim();
  if (validity === "1_MONTH_FREE" && !raw.monthFreeEnabled) return { ok: false, code: "bad_validity" };
  if (validity !== "FREE_TRIAL" && validity !== "1_MONTH_FREE") {
    const m = Number.parseInt(validity, 10);
    if (!Number.isFinite(m) || m < 1 || m > 24) return { ok: false, code: "bad_validity" };
    validity = String(m);
  }

  const accountStatus = raw.status === ACCOUNT_STATUS_OFF ? ACCOUNT_STATUS_OFF : ACCOUNT_STATUS_ON;
  const billing = getBillingPool();

  const [[dupAccount], [dupMac], [tariff]] = await Promise.all([
    billing.execute<RowDataPacket[]>("SELECT account FROM accounts WHERE account = :a LIMIT 1", { a: account }),
    billing.execute<RowDataPacket[]>("SELECT account FROM accounts WHERE mac = :m LIMIT 1", { m: mac }),
    stalker.execute<RowDataPacket[]>("SELECT id FROM tariff_plan WHERE id = :id LIMIT 1", { id: raw.tariff_plan_id }),
  ]);
  if (dupAccount.length) return { ok: false, code: "duplicate_login" };
  if (dupMac.length) return { ok: false, code: "duplicate_mac" };
  if (!tariff.length) return { ok: false, code: "bad_package" };

  const [stDupLogin] = await stalker.execute<RowDataPacket[]>("SELECT id FROM users WHERE login = :l LIMIT 1", { l: account });
  const [stDupMac] = await stalker.execute<RowDataPacket[]>("SELECT id FROM users WHERE mac = :m LIMIT 1", { m: mac });
  if (stDupLogin.length) return { ok: false, code: "duplicate_login" };
  if (stDupMac.length) return { ok: false, code: "duplicate_mac" };

  const [[rs]] = await billing.execute<RowDataPacket[]>(
    "SELECT username FROM users WHERE type = 'SRSLR' AND username = :u LIMIT 1",
    { u: reseller },
  );
  if (!rs) return { ok: false, code: "bad_owner" };

  if (dealer) {
    const [[dl]] = await billing.execute<RowDataPacket[]>(
      "SELECT username FROM users WHERE type = 'RSLR' AND username = :d AND username_owner = :r LIMIT 1",
      { d: dealer, r: reseller },
    );
    if (!dl) return { ok: false, code: "bad_owner" };
  }

  const customPlanId = await getStalkerCustomPackagePlanId();
  let filteredAddonIds: number[] = [];
  if (
    customPlanId != null &&
    raw.tariff_plan_id === customPlanId &&
    Array.isArray(raw.addonPackageIds) &&
    raw.addonPackageIds.length > 0
  ) {
    const allowed = await listStalkerPackagesForPlan(customPlanId);
    const allowedSet = new Set(allowed.map((p) => p.package_id));
    filteredAddonIds = [
      ...new Set(
        raw.addonPackageIds
          .map((n) => Math.floor(Number(n)))
          .filter((n) => Number.isFinite(n) && n > 0 && allowedSet.has(n)),
      ),
    ];
  }

  const skipCreditCheck = validity === "FREE_TRIAL" || validity === "1_MONTH_FREE";
  if (!skipCreditCheck) {
    const needMonths = Number(validity);
    const balance = await getCreditBalance(ownerUsername);
    if (balance < needMonths) {
      return { ok: false, code: "insufficient_credits", balance, required: needMonths };
    }
  }

  const [dedRows] = await billing.execute<RowDataPacket[]>(
    "SELECT month, month_deduction FROM credit_deductions ORDER BY month ASC",
  );
  const deductionMap = buildMonthDeductionChargedMap(
    dedRows.map((d) => ({ month: Number(d.month), month_deduction: Number(d.month_deduction) })),
  );

  const pinDefault = await getPinDefaultFromBilling();
  const created = formatMysqlDateTime(new Date());
  const usingFreeTrial = validity === "FREE_TRIAL";
  let expires = computeExpiryDatePhp(validity === "1_MONTH_FREE" ? "1" : validity);

  const stalkerConn = await stalker.getConnection();
  let stalkerUserId: number | null = null;
  try {
    const [ins] = await stalkerConn.execute<ResultSetHeader>(
      `INSERT INTO users (fname, login, mac, status, tariff_plan_id, created, expire_billing_date, parent_password)
       VALUES (:fname, :login, :mac, :status, :tariff_plan_id, :created, :expire_billing_date, :parent_password)`,
      {
        fname: full_name || account,
        login: account,
        mac,
        status: accountStatus,
        tariff_plan_id: raw.tariff_plan_id,
        created,
        expire_billing_date: expires,
        parent_password: pinDefault,
      },
    );
    stalkerUserId = Number(ins.insertId);
    if (!stalkerUserId) throw new Error("stalker_insert_id");

    const pwdHash = stalkerPasswordDigest(password, stalkerUserId);
    await stalkerConn.execute("UPDATE users SET password = :p WHERE id = :id", { p: pwdHash, id: stalkerUserId });
  } catch {
    return { ok: false, code: "db" };
  } finally {
    stalkerConn.release();
  }

  const billConn = await billing.getConnection();
  try {
    await billConn.beginTransaction();

    const [aRes] = await billConn.execute<ResultSetHeader>(
      `INSERT INTO accounts (full_name, account, mac, status, created, expires, username, password)
       VALUES (:full_name, :account, :mac, :status, :created, :expires, :username, :password)`,
      {
        full_name: full_name || account,
        account,
        mac,
        status: accountStatus,
        created,
        expires,
        username: ownerUsername,
        password,
      },
    );
    if (aRes.affectedRows !== 1) throw new Error("accounts");

    if (usingFreeTrial) {
      await billConn.execute(
        "INSERT INTO free_trial_users (mac, free_trial_end_date) VALUES (:mac, :free_trial_end_date)",
        { mac, free_trial_end_date: expires },
      );
      await insertCreditSummarizeLikePhp(billConn, account, created, expires, 0, deductionMap);
    } else {
      let txCredits = 0;
      let txType: "DBIT" | "BONUS" = "DBIT";
      let numberFree = 0;
      let summarizeCredits = 0;

      if (validity === "1_MONTH_FREE") {
        txCredits = 0;
        txType = "BONUS";
        numberFree = 1;
        summarizeCredits = 0;
      } else {
        txCredits = Number(validity);
        summarizeCredits = txCredits;
      }

      await insertDebitLikePhp(billConn, {
        username: ownerUsername,
        account,
        expires,
        coverageStart: created,
        credits: txCredits,
        type: txType,
        numberFree,
        deductionMap,
      });
      await insertCreditSummarizeLikePhp(billConn, account, created, expires, summarizeCredits, deductionMap);
    }

    await billConn.commit();
  } catch {
    await billConn.rollback();
    billConn.release();
    await stalker.execute("DELETE FROM users WHERE id = :id", { id: stalkerUserId });
    return { ok: false, code: "db" };
  }
  billConn.release();

  if (filteredAddonIds.length > 0 && stalkerUserId) {
    await setStalkerUserPackageSubscriptions(stalkerUserId, filteredAddonIds);
  }

  return { ok: true, account };
}

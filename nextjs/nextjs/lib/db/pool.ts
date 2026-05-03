import mysql from "mysql2/promise";

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

/** Set `DATABASE_SSL=1` (or `true` / `required`) for cloud MySQL that requires TLS (e.g. RDS, Aiven). */
function billingSslOption(): { rejectUnauthorized: boolean } | undefined {
  const raw = (process.env.DATABASE_SSL ?? "").trim().toLowerCase();
  if (raw !== "1" && raw !== "true" && raw !== "required" && raw !== "yes") return undefined;
  const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "0";
  return { rejectUnauthorized };
}

type GlobalPoolCache = {
  billingPool: mysql.Pool | null;
  stalkerPool: mysql.Pool | null;
};

const globalForPools = globalThis as typeof globalThis & {
  __billingPoolCache?: GlobalPoolCache;
};

const poolCache: GlobalPoolCache = globalForPools.__billingPoolCache ?? { billingPool: null, stalkerPool: null };
globalForPools.__billingPoolCache = poolCache;

export function getBillingPool(): mysql.Pool {
  if (!poolCache.billingPool) {
    const ssl = billingSslOption();
    poolCache.billingPool = mysql.createPool({
      host: req("DATABASE_HOST", "127.0.0.1"),
      port: Number(process.env.DATABASE_PORT ?? 3306),
      user: req("DATABASE_USER", "root"),
      password: process.env.DATABASE_PASSWORD ?? "",
      database: req("DATABASE_NAME", "stalker_billing"),
      ...(ssl ? { ssl } : {}),
      waitForConnections: true,
      /** Default 5 lowers burst load on MySQL during Next dev / Turbopack; override with `DATABASE_CONNECTION_LIMIT`. */
      connectionLimit: (() => {
        const n = Number(process.env.DATABASE_CONNECTION_LIMIT);
        return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 5;
      })(),
      namedPlaceholders: true,
      dateStrings: true,
    });
  }
  return poolCache.billingPool;
}

/** Ministra/Stalker DB — only used when STALKER_DATABASE_NAME is set (e.g. send message → `events`). */
export function getStalkerPool(): mysql.Pool | null {
  const name = process.env.STALKER_DATABASE_NAME;
  if (!name) return null;
  if (!poolCache.stalkerPool) {
    const ssl = billingSslOption();
    poolCache.stalkerPool = mysql.createPool({
      host: process.env.STALKER_DATABASE_HOST ?? process.env.DATABASE_HOST ?? "127.0.0.1",
      port: Number(process.env.STALKER_DATABASE_PORT ?? process.env.DATABASE_PORT ?? 3306),
      user: process.env.STALKER_DATABASE_USER ?? process.env.DATABASE_USER,
      password: process.env.STALKER_DATABASE_PASSWORD ?? process.env.DATABASE_PASSWORD ?? "",
      database: name,
      ...(ssl ? { ssl } : {}),
      waitForConnections: true,
      connectionLimit: Number(process.env.STALKER_DATABASE_CONNECTION_LIMIT ?? 5),
      namedPlaceholders: true,
      dateStrings: true,
    });
  }
  return poolCache.stalkerPool;
}

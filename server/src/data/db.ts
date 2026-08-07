// MySQL / MariaDB connection and schema.
//
// The database is the source of truth ACROSS restarts. While the process runs,
// the in-memory store in memoryStore.ts acts as a read cache so the
// deterministic engine can stay synchronous. Every change is written through
// to MySQL.
//
// If the database cannot be reached the service still starts, clearly reporting
// IN_MEMORY storage. A dead database must never take down a live demo - but it
// must never be hidden either.

import mysql from 'mysql2/promise'

export interface DbConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
}

export type StorageState = 'MYSQL' | 'IN_MEMORY'

let pool: mysql.Pool | null = null
let state: StorageState = 'IN_MEMORY'
let lastError: string | null = null

export function getDbConfig(): DbConfig {
  return {
    host: process.env.DB_HOST?.trim() || '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER?.trim() || 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME?.trim() || 'mandateguard',
  }
}

export function storageState(): StorageState {
  return state
}

/** Safe for /health - host, port and database name only, never the password. */
export function describeStorage(): {
  state: StorageState
  driver: string
  host: string
  port: number
  database: string
  error: string | null
} {
  const c = getDbConfig()
  return {
    state,
    driver: 'mysql',
    host: c.host,
    port: c.port,
    database: c.database,
    error: lastError,
  }
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS policies (
     id                     VARCHAR(32)  NOT NULL PRIMARY KEY,
     product                VARCHAR(255) NOT NULL,
     quantity               INT          NOT NULL,
     max_price              DECIMAL(14,2) NOT NULL,
     approved_seller        VARCHAR(255) NOT NULL,
     warranty_allowed       TINYINT(1)   NOT NULL,
     approved_receiver_wallet VARCHAR(255) NOT NULL,
     per_transaction_limit  DECIMAL(14,2) NOT NULL,
     daily_limit            DECIMAL(14,2) NOT NULL,
     expires_at             VARCHAR(64)  NOT NULL,
     status                 VARCHAR(16)  NOT NULL,
     created_at             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS mandates (
     mandate_id    VARCHAR(32)  NOT NULL PRIMARY KEY,
     mandate_hash  CHAR(64)     NOT NULL,
     expires_at    VARCHAR(64)  NOT NULL,
     used          TINYINT(1)   NOT NULL DEFAULT 0,
     used_at       VARCHAR(64)  NULL,
     registered_at VARCHAR(64)  NOT NULL,
     anchor_tx_id  VARCHAR(128) NULL,
     anchored_at   VARCHAR(64)  NULL,
     INDEX idx_hash (mandate_hash)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS verifications (
     verification_id     VARCHAR(32)  NOT NULL PRIMARY KEY,
     request_id          VARCHAR(32)  NULL,
     policy_id           VARCHAR(32)  NOT NULL,
     order_id            VARCHAR(64)  NOT NULL,
     product             VARCHAR(255) NOT NULL,
     amount              DECIMAL(14,2) NOT NULL,
     seller              VARCHAR(255) NOT NULL,
     decision            VARCHAR(16)  NOT NULL,
     violations          TEXT         NOT NULL,
     checked_at          VARCHAR(64)  NOT NULL,
     execution_status    VARCHAR(32)  NOT NULL,
     policy_source       VARCHAR(32)  NOT NULL,
     order_source        VARCHAR(32)  NOT NULL,
     x402_payment_status VARCHAR(16)  NOT NULL,
     x402_transaction_id VARCHAR(128) NULL,
     x402_amount         VARCHAR(32)  NULL,
     blockchain_network  VARCHAR(64)  NULL,
     payment_verified_at VARCHAR(64)  NULL,
     mandate_hash        CHAR(64)     NULL,
     mandate_status      VARCHAR(32)  NULL,
     created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
     INDEX idx_policy (policy_id),
     INDEX idx_request (request_id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS flow_events (
     id         BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
     request_id VARCHAR(32)  NOT NULL,
     at         VARCHAR(64)  NOT NULL,
     step       VARCHAR(255) NOT NULL,
     detail     TEXT         NULL,
     INDEX idx_request (request_id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS daily_spend (
     spend_date VARCHAR(10)  NOT NULL PRIMARY KEY,
     amount     DECIMAL(14,2) NOT NULL
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
]

/**
 * Columns added after the first release. CREATE TABLE IF NOT EXISTS leaves an
 * existing table alone, so a database built before on-chain anchoring would
 * still be missing these. Each one is tried on its own and a duplicate-column
 * error is the expected, harmless case.
 */
const MIGRATIONS = [
  'ALTER TABLE mandates ADD COLUMN anchor_tx_id VARCHAR(128) NULL',
  'ALTER TABLE mandates ADD COLUMN anchored_at VARCHAR(64) NULL',
]

/**
 * Creates the database if needed, connects, and builds the schema.
 * Returns true when MySQL is in use.
 */
export async function initDatabase(): Promise<boolean> {
  const config = getDbConfig()

  try {
    // Connect without a database first so we can create it on a fresh machine.
    const bootstrap = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
    })
    await bootstrap.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.database}\`
       CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    )
    await bootstrap.end()

    pool = mysql.createPool({
      ...config,
      waitForConnections: true,
      connectionLimit: 5,
      // Keep decimals as numbers rather than strings.
      decimalNumbers: true,
    })

    for (const statement of SCHEMA) {
      await pool.query(statement)
    }

    for (const statement of MIGRATIONS) {
      try {
        await pool.query(statement)
      } catch (error) {
        // ER_DUP_FIELDNAME just means the column is already there.
        const code = (error as { code?: string }).code
        if (code !== 'ER_DUP_FIELDNAME') {
          console.error(`  ✕ MySQL migration failed: ${(error as Error).message}`)
        }
      }
    }

    state = 'MYSQL'
    lastError = null
    return true
  } catch (error) {
    pool = null
    state = 'IN_MEMORY'
    lastError = (error as Error).message
    return false
  }
}

/** Null when the database is unavailable - callers skip persistence. */
export function db(): mysql.Pool | null {
  return pool
}

/** Runs a write and never throws: a storage hiccup must not break a request. */
export async function write(
  sql: string,
  params: unknown[] = [],
  label = 'write',
): Promise<void> {
  const p = pool
  if (!p) return

  try {
    await p.query(sql, params)
  } catch (error) {
    console.error(`  ✕ MySQL ${label} failed: ${(error as Error).message}`)
  }
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}

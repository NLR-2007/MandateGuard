// Reads everything back from MySQL at startup, and writes every change through.
//
// Why a cache at all: the deterministic engine and the route handlers read
// policies and today's spend synchronously. Keeping that shape means the
// security logic did not have to change to add a database.

import type { RowDataPacket } from 'mysql2'
import type { AuditEntry, SpendingPolicy } from '../types/index.js'
import { db, write } from './db.js'
import {
  auditLog,
  dailySpend,
  policies,
  setCounters,
  todayKey,
} from './memoryStore.js'
import type { MandateRecord } from '../services/mandateProof.js'
import { loadMandates } from '../services/mandateProof.js'
import type { FlowEvent } from '../services/flowService.js'
import { loadEvents } from '../services/flowService.js'

/** Highest numeric suffix of ids like MG-1007, so counters continue after a restart. */
function maxSuffix(ids: string[], prefix: string): number {
  let max = 0
  for (const id of ids) {
    if (!id?.startsWith(prefix)) continue
    const n = Number(id.slice(prefix.length))
    if (Number.isFinite(n) && n > max) max = n
  }
  return max
}

/** Fills the in-memory store from MySQL. Called once at startup. */
export async function loadAll(): Promise<{
  policies: number
  verifications: number
  mandates: number
  events: number
}> {
  const pool = db()
  if (!pool) return { policies: 0, verifications: 0, mandates: 0, events: 0 }

  // ── policies ────────────────────────────────────────────
  const [policyRows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM policies ORDER BY created_at ASC',
  )
  for (const r of policyRows) {
    const policy: SpendingPolicy = {
      id: r.id,
      product: r.product,
      quantity: Number(r.quantity),
      maxPrice: Number(r.max_price),
      approvedSeller: r.approved_seller,
      warrantyAllowed: Boolean(r.warranty_allowed),
      approvedReceiverWallet: r.approved_receiver_wallet,
      perTransactionLimit: Number(r.per_transaction_limit),
      dailyLimit: Number(r.daily_limit),
      expiresAt: r.expires_at,
      status: r.status,
    }
    policies.set(policy.id, policy)
  }

  // ── verifications (audit log, newest first) ─────────────
  const [auditRows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM verifications ORDER BY created_at DESC, verification_id DESC',
  )
  for (const r of auditRows) {
    const entry: AuditEntry = {
      requestId: r.request_id ?? null,
      verificationId: r.verification_id,
      policyId: r.policy_id,
      orderId: r.order_id,
      product: r.product,
      amount: Number(r.amount),
      seller: r.seller,
      decision: r.decision,
      violations: safeJson(r.violations),
      checkedAt: r.checked_at,
      executionStatus: r.execution_status,
      policySource: r.policy_source,
      orderSource: r.order_source,
      x402PaymentStatus: r.x402_payment_status,
      x402TransactionId: r.x402_transaction_id ?? null,
      x402Amount: r.x402_amount ?? null,
      blockchainNetwork: r.blockchain_network ?? null,
      paymentVerifiedAt: r.payment_verified_at ?? null,
      mandateHash: r.mandate_hash ?? null,
      mandateStatus: r.mandate_status ?? null,
    }
    auditLog.push(entry)
  }

  // ── mandates ────────────────────────────────────────────
  const [mandateRows] = await pool.query<RowDataPacket[]>('SELECT * FROM mandates')
  const mandateRecords: MandateRecord[] = mandateRows.map((r) => ({
    mandateId: r.mandate_id,
    mandateHash: r.mandate_hash,
    expiresAt: r.expires_at,
    used: Boolean(r.used),
    usedAt: r.used_at ?? null,
    registeredAt: r.registered_at,
    storage: 'MYSQL',
  }))
  loadMandates(mandateRecords)

  // ── daily spend ─────────────────────────────────────────
  const [spendRows] = await pool.query<RowDataPacket[]>('SELECT * FROM daily_spend')
  for (const r of spendRows) dailySpend.set(r.spend_date, Number(r.amount))

  // ── timeline events (oldest first) ──────────────────────
  const [eventRows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM flow_events ORDER BY id ASC',
  )
  const events: FlowEvent[] = eventRows.map((r) => ({
    requestId: r.request_id,
    at: r.at,
    step: r.step,
    detail: r.detail ?? '',
  }))
  loadEvents(events)

  // ── continue the id sequences ───────────────────────────
  setCounters({
    policy: Math.max(1000, maxSuffix([...policies.keys()], 'MG-')),
    verification: Math.max(1000, maxSuffix(auditLog.map((e) => e.verificationId), 'VER-')),
    request: Math.max(
      1000,
      maxSuffix(
        events.map((e) => e.requestId),
        'REQ-',
      ),
    ),
  })

  return {
    policies: policies.size,
    verifications: auditLog.length,
    mandates: mandateRecords.length,
    events: events.length,
  }
}

function safeJson(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[]
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// ────────────────────────────────────────────────────────────
// Write-through helpers. All are fire-and-forget with logging,
// so a storage problem can never fail a verification.
// ────────────────────────────────────────────────────────────

export function persistPolicy(p: SpendingPolicy): void {
  void write(
    `INSERT INTO policies
       (id, product, quantity, max_price, approved_seller, warranty_allowed,
        approved_receiver_wallet, per_transaction_limit, daily_limit, expires_at, status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE status = VALUES(status)`,
    [
      p.id, p.product, p.quantity, p.maxPrice, p.approvedSeller,
      p.warrantyAllowed ? 1 : 0, p.approvedReceiverWallet,
      p.perTransactionLimit, p.dailyLimit, p.expiresAt, p.status,
    ],
    'persistPolicy',
  )
}

export function persistMandate(m: MandateRecord): void {
  void write(
    `INSERT INTO mandates (mandate_id, mandate_hash, expires_at, used, used_at, registered_at)
     VALUES (?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE used = VALUES(used), used_at = VALUES(used_at)`,
    [m.mandateId, m.mandateHash, m.expiresAt, m.used ? 1 : 0, m.usedAt, m.registeredAt],
    'persistMandate',
  )
}

export function persistVerification(e: AuditEntry): void {
  void write(
    `INSERT INTO verifications
       (verification_id, request_id, policy_id, order_id, product, amount, seller,
        decision, violations, checked_at, execution_status, policy_source, order_source,
        x402_payment_status, x402_transaction_id, x402_amount, blockchain_network,
        payment_verified_at, mandate_hash, mandate_status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE
       decision = VALUES(decision),
       violations = VALUES(violations),
       execution_status = VALUES(execution_status),
       x402_payment_status = VALUES(x402_payment_status),
       x402_transaction_id = VALUES(x402_transaction_id),
       x402_amount = VALUES(x402_amount),
       blockchain_network = VALUES(blockchain_network),
       payment_verified_at = VALUES(payment_verified_at),
       mandate_hash = VALUES(mandate_hash),
       mandate_status = VALUES(mandate_status)`,
    [
      e.verificationId, e.requestId, e.policyId, e.orderId, e.product, e.amount, e.seller,
      e.decision, JSON.stringify(e.violations), e.checkedAt, e.executionStatus,
      e.policySource, e.orderSource, e.x402PaymentStatus, e.x402TransactionId,
      e.x402Amount, e.blockchainNetwork, e.paymentVerifiedAt, e.mandateHash, e.mandateStatus,
    ],
    'persistVerification',
  )
}

export function persistEvent(e: FlowEvent): void {
  void write(
    'INSERT INTO flow_events (request_id, at, step, detail) VALUES (?,?,?,?)',
    [e.requestId, e.at, e.step, e.detail],
    'persistEvent',
  )
}

export function persistDailySpend(amount: number, date = todayKey()): void {
  void write(
    `INSERT INTO daily_spend (spend_date, amount) VALUES (?,?)
     ON DUPLICATE KEY UPDATE amount = VALUES(amount)`,
    [date, amount],
    'persistDailySpend',
  )
}

/** Demo reset: empties the tables so a fresh run starts clean. */
export async function clearAll(): Promise<void> {
  const pool = db()
  if (!pool) return

  for (const table of ['flow_events', 'verifications', 'mandates', 'policies', 'daily_spend']) {
    await write(`DELETE FROM \`${table}\``, [], `clear ${table}`)
  }
}

import { addSpentToday, auditLog } from '../data/memoryStore.js'
import { getMandateStatus, markMandateUsed } from './mandateProof.js'
import type {
  AuditEntry,
  OrderSource,
  PolicySource,
  VerificationResult,
} from '../types/index.js'

/** Saves one verification into the in-memory audit log (newest first). */
export function recordVerification(
  result: VerificationResult,
  order: { product: string; price: number; seller: string },
  sources: {
    policySource?: PolicySource
    orderSource?: OrderSource
    requestId?: string | null
  } = {},
): AuditEntry {
  const entry: AuditEntry = {
    requestId: sources.requestId ?? null,
    verificationId: result.verificationId,
    policyId: result.policyId,
    orderId: result.orderId,
    product: order.product,
    amount: order.price,
    seller: order.seller,
    decision: result.decision,
    violations: result.violations,
    checkedAt: result.checkedAt,
    executionStatus: 'NOT_EXECUTED',
    policySource: sources.policySource ?? 'MANUAL',
    orderSource: sources.orderSource ?? 'MANUAL_DEMO',

    // Phase 6 defaults: the free endpoint involves no payment at all.
    x402PaymentStatus: 'NOT_PAID',
    x402TransactionId: null,
    x402Amount: null,
    blockchainNetwork: null,
    paymentVerifiedAt: null,
    mandateHash: null,
    mandateStatus: null,
  }

  auditLog.unshift(entry)
  return entry
}

/** Attaches real x402 / mandate proof to an audit row. Never fabricates. */
export function setPaymentProof(
  entry: AuditEntry,
  proof: Partial<
    Pick<
      AuditEntry,
      | 'x402PaymentStatus'
      | 'x402TransactionId'
      | 'x402Amount'
      | 'blockchainNetwork'
      | 'paymentVerifiedAt'
      | 'mandateHash'
      | 'mandateStatus'
    >
  >,
): AuditEntry {
  Object.assign(entry, proof)
  return entry
}

export function listAudit(): AuditEntry[] {
  return auditLog
}

export function findAudit(verificationId: string): AuditEntry | undefined {
  return auditLog.find((e) => e.verificationId === verificationId)
}

export interface ExecutionOutcome {
  ok: boolean
  status?: number
  error?: string
  entry?: AuditEntry
  spentToday?: number
  mandateStatus?: string
  /** True when this exact verification was executed earlier (refresh case). */
  alreadyExecuted?: boolean
}

/**
 * Marks an approved verification as "simulated executed".
 * This is the ONLY place that adds money to the daily spending total.
 * No real payment happens.
 */
export function recordExecution(verificationId: string): ExecutionOutcome {
  const entry = findAudit(verificationId)

  if (!entry) {
    return { ok: false, status: 404, error: 'Verification not found.' }
  }
  if (entry.decision === 'BLOCKED') {
    return {
      ok: false,
      status: 400,
      error: 'A blocked verification cannot be executed.',
    }
  }

  // Idempotency: a browser refresh must not spend twice.
  if (entry.executionStatus === 'SIMULATED_EXECUTED') {
    return {
      ok: false,
      status: 409,
      error: 'Execution already recorded.',
      entry,
      alreadyExecuted: true,
    }
  }

  // Replay protection: a consumed or expired mandate cannot execute again.
  const mandateStatus = getMandateStatus(entry.policyId)

  if (mandateStatus === 'USED') {
    return { ok: false, status: 409, error: 'Mandate has already been used.', entry }
  }
  if (mandateStatus === 'EXPIRED') {
    return { ok: false, status: 400, error: 'Mandate has expired.', entry }
  }

  entry.executionStatus = 'SIMULATED_EXECUTED'
  const spentToday = addSpentToday(entry.amount)

  // Consuming the mandate happens HERE and nowhere else - not when the policy
  // is created, not when the AI orders, not when the x402 fee is paid.
  const consumed = markMandateUsed(entry.policyId)
  if (consumed) {
    entry.mandateStatus = 'USED'
    console.log(`  ⛓ Mandate ${entry.policyId} marked USED after approved execution`)
  }

  return { ok: true, entry, spentToday, mandateStatus: getMandateStatus(entry.policyId) }
}

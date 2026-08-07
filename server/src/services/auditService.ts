import { addSpentToday, auditLog } from '../data/memoryStore.js'
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
  sources: { policySource?: PolicySource; orderSource?: OrderSource } = {},
): AuditEntry {
  const entry: AuditEntry = {
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
  }

  auditLog.unshift(entry)
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
  if (entry.executionStatus === 'SIMULATED_EXECUTED') {
    return {
      ok: false,
      status: 400,
      error: 'This verification was already executed.',
    }
  }

  entry.executionStatus = 'SIMULATED_EXECUTED'
  const spentToday = addSpentToday(entry.amount)

  return { ok: true, entry, spentToday }
}

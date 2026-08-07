// Phase 7 integration tests: execution, replay, daily limit, idempotency.
// No network, no wallet, no real Test USDC is spent.

import assert from 'node:assert/strict'
import test from 'node:test'
import { auditLog, dailySpend, getSpentToday } from '../data/memoryStore.js'
import type { AIOrder, SpendingPolicy, VerificationResult } from '../types/index.js'
import { recordExecution, recordVerification } from './auditService.js'
import { registerMandate, getMandateStatus, resetMandates } from './mandateProof.js'
import { verifyMandate } from './mandateVerifier.js'

const policy: SpendingPolicy = {
  id: 'MG-7001',
  product: '1TB SSD',
  quantity: 1,
  maxPrice: 5000,
  approvedSeller: 'SecureStore',
  warrantyAllowed: false,
  approvedReceiverWallet: 'ALGO-SECURE-STORE',
  perTransactionLimit: 5000,
  dailyLimit: 10000,
  expiresAt: '2030-12-31T23:59:00.000Z',
  status: 'ACTIVE',
}

const safeOrder: AIOrder = {
  orderId: 'AI-ORDER-7001',
  product: '1TB SSD',
  quantity: 1,
  price: 4800,
  seller: 'SecureStore',
  warrantyAdded: false,
  receiverWallet: 'ALGO-SECURE-STORE',
}

const unsafeOrder: AIOrder = {
  ...safeOrder,
  orderId: 'AI-ORDER-7002',
  quantity: 2,
  price: 4900,
  seller: 'OtherStore',
  warrantyAdded: true,
  receiverWallet: 'ALGO-UNKNOWN-WALLET',
}

function freshState() {
  auditLog.length = 0
  dailySpend.clear()
  resetMandates()
}

/** Runs a verification and stores it, the way the routes do. */
function runVerification(order: AIOrder, id: string, spentToday = 0) {
  const result: VerificationResult = verifyMandate(policy, order, {
    spentToday,
    verificationId: id,
  })
  registerMandate(policy)
  return recordVerification(result, order, { requestId: 'REQ-TEST' })
}

test('1. approved verification can be executed once', () => {
  freshState()
  runVerification(safeOrder, 'VER-7001')

  const outcome = recordExecution('VER-7001')

  assert.equal(outcome.ok, true)
  assert.equal(outcome.entry?.executionStatus, 'SIMULATED_EXECUTED')
  assert.equal(outcome.spentToday, 4800)
})

test('2. execution consumes the mandate (replay protection)', () => {
  freshState()
  runVerification(safeOrder, 'VER-7002')

  assert.equal(getMandateStatus('MG-7001'), 'ACTIVE', 'mandate is active before execution')
  recordExecution('VER-7002')
  assert.equal(getMandateStatus('MG-7001'), 'USED', 'mandate is used after execution')
})

test('3. paying and verifying alone must NOT consume the mandate', () => {
  freshState()
  runVerification(safeOrder, 'VER-7003')

  // No execution recorded yet.
  assert.equal(getMandateStatus('MG-7001'), 'ACTIVE')
  assert.equal(getSpentToday(), 0, 'verification never spends money')
})

test('4. a blocked verification can never be executed', () => {
  freshState()
  const entry = runVerification(unsafeOrder, 'VER-7004')
  assert.equal(entry.decision, 'BLOCKED')

  const outcome = recordExecution('VER-7004')

  assert.equal(outcome.ok, false)
  assert.match(outcome.error ?? '', /blocked verification cannot be executed/i)
  assert.equal(getSpentToday(), 0)
})

test('5. executing the same verification twice is refused (idempotency)', () => {
  freshState()
  runVerification(safeOrder, 'VER-7005')

  assert.equal(recordExecution('VER-7005').ok, true)

  const second = recordExecution('VER-7005')
  assert.equal(second.ok, false)
  assert.equal(second.status, 409)
  assert.equal(second.alreadyExecuted, true)
  assert.match(second.error ?? '', /already recorded/i)
  assert.equal(getSpentToday(), 4800, 'daily spend must not double')
})

test('6. a second order on a used mandate cannot execute', () => {
  freshState()
  runVerification(safeOrder, 'VER-7006')
  recordExecution('VER-7006')

  // A brand-new verification against the SAME policy.
  runVerification({ ...safeOrder, orderId: 'AI-ORDER-7007' }, 'VER-7007')

  const outcome = recordExecution('VER-7007')
  assert.equal(outcome.ok, false)
  assert.match(outcome.error ?? '', /mandate has already been used/i)
})

test('7. daily spend only grows through executions', () => {
  freshState()
  runVerification(safeOrder, 'VER-7008')
  runVerification({ ...safeOrder, orderId: 'X' }, 'VER-7009')

  assert.equal(getSpentToday(), 0, 'two verifications, no executions')

  recordExecution('VER-7008')
  assert.equal(getSpentToday(), 4800)
})

test('8. the daily limit blocks once enough has been executed', () => {
  freshState()

  // Daily limit 10000. Pretend 7000 has already been executed today.
  const result = verifyMandate(policy, { ...safeOrder, price: 4000 }, {
    spentToday: 7000,
    verificationId: 'VER-7010',
  })

  assert.equal(result.decision, 'BLOCKED')
  assert.ok(result.violations.includes('Daily spending limit would be exceeded.'))
})

test('9. an expired mandate cannot execute', () => {
  freshState()
  const expiredPolicy = { ...policy, expiresAt: '2020-01-01T00:00:00.000Z' }

  const result = verifyMandate(expiredPolicy, safeOrder, { verificationId: 'VER-7011' })
  registerMandate(expiredPolicy)
  recordVerification(result, safeOrder, { requestId: 'REQ-TEST' })

  assert.equal(result.decision, 'BLOCKED', 'expired policy is blocked at verification')

  const outcome = recordExecution('VER-7011')
  assert.equal(outcome.ok, false)
})

test('10. the audit row carries the request id that links the journey', () => {
  freshState()
  const entry = runVerification(safeOrder, 'VER-7012')
  assert.equal(entry.requestId, 'REQ-TEST')
})

import assert from 'node:assert/strict'
import test from 'node:test'
import type { AIOrder, SpendingPolicy } from '../types/index.js'
import { verifyMandate } from './mandateVerifier.js'

const basePolicy: SpendingPolicy = {
  id: 'MG-1001',
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

const baseOrder: AIOrder = {
  orderId: 'ORDER-1001',
  product: '1TB SSD',
  quantity: 1,
  price: 4800,
  seller: 'SecureStore',
  warrantyAdded: false,
  receiverWallet: 'ALGO-SECURE-STORE',
}

const policyWith = (patch: Partial<SpendingPolicy>): SpendingPolicy => ({
  ...basePolicy,
  ...patch,
})

const orderWith = (patch: Partial<AIOrder>): AIOrder => ({ ...baseOrder, ...patch })

// ── TEST 1 ────────────────────────────────────────────────
test('1. correct order is APPROVED', () => {
  const result = verifyMandate(basePolicy, baseOrder)
  assert.equal(result.decision, 'APPROVED')
  assert.deepEqual(result.violations, [])
  assert.equal(result.checks.length, 10)
  assert.ok(result.checks.every((c) => c.passed))
})

// ── TEST 2 ────────────────────────────────────────────────
test('2. price above maximum is BLOCKED', () => {
  const result = verifyMandate(basePolicy, orderWith({ price: 5500 }))
  assert.equal(result.decision, 'BLOCKED')
  assert.ok(result.violations.includes('Order price exceeds the approved maximum price.'))
})

// ── TEST 3 ────────────────────────────────────────────────
test('3. quantity changed is BLOCKED', () => {
  const result = verifyMandate(basePolicy, orderWith({ quantity: 2, price: 4900 }))
  assert.equal(result.decision, 'BLOCKED')
  assert.ok(result.violations.includes('Quantity changed from 1 to 2.'))
})

// ── TEST 4 ────────────────────────────────────────────────
test('4. wrong seller is BLOCKED', () => {
  const result = verifyMandate(basePolicy, orderWith({ seller: 'OtherStore', price: 4700 }))
  assert.equal(result.decision, 'BLOCKED')
  assert.ok(result.violations.includes('Seller is not approved.'))
})

// ── TEST 5 ────────────────────────────────────────────────
test('5. warranty added without approval is BLOCKED', () => {
  const result = verifyMandate(basePolicy, orderWith({ warrantyAdded: true, price: 4950 }))
  assert.equal(result.decision, 'BLOCKED')
  assert.ok(result.violations.includes('Warranty was added without human approval.'))
})

// ── TEST 6 ────────────────────────────────────────────────
test('6. wrong receiver wallet is BLOCKED', () => {
  const result = verifyMandate(basePolicy, orderWith({ receiverWallet: 'ALGO-UNKNOWN-WALLET' }))
  assert.equal(result.decision, 'BLOCKED')
  assert.ok(
    result.violations.includes(
      'Payment receiver wallet does not match the approved wallet.',
    ),
  )
})

// ── TEST 7 ────────────────────────────────────────────────
test('7. expired policy is BLOCKED', () => {
  const expired = policyWith({ expiresAt: '2020-01-01T00:00:00.000Z' })
  const result = verifyMandate(expired, baseOrder)
  assert.equal(result.decision, 'BLOCKED')
  assert.ok(result.violations.includes('Human spending policy has expired.'))
})

// ── TEST 8 ────────────────────────────────────────────────
test('8. per-transaction limit exceeded is BLOCKED', () => {
  const strict = policyWith({ maxPrice: 5000, perTransactionLimit: 2000 })
  const result = verifyMandate(strict, orderWith({ price: 4800 }))
  assert.equal(result.decision, 'BLOCKED')
  assert.ok(result.violations.includes('Per-transaction spending limit exceeded.'))
  // The max-price rule still passes - only the per-transaction rule failed.
  assert.equal(result.checks.find((c) => c.rule === 'Maximum Price')?.passed, true)
})

// ── TEST 9 ────────────────────────────────────────────────
test('9. daily limit exceeded is BLOCKED', () => {
  // Daily limit 10000, already spent 7000, this order 4000 -> 11000.
  const result = verifyMandate(basePolicy, orderWith({ price: 4000 }), {
    spentToday: 7000,
  })
  assert.equal(result.decision, 'BLOCKED')
  assert.ok(result.violations.includes('Daily spending limit would be exceeded.'))
})

test('9b. verification alone does not spend money (spentToday stays the caller\'s job)', () => {
  const first = verifyMandate(basePolicy, baseOrder, { spentToday: 0 })
  const second = verifyMandate(basePolicy, baseOrder, { spentToday: 0 })
  assert.equal(first.decision, 'APPROVED')
  assert.equal(second.decision, 'APPROVED')
})

// ── TEST 10 ───────────────────────────────────────────────
test('10. combined attack is BLOCKED with 4 violations', () => {
  const combined = orderWith({
    quantity: 2,
    price: 4900,
    seller: 'OtherStore',
    warrantyAdded: true,
    receiverWallet: 'ALGO-UNKNOWN-WALLET',
  })

  const result = verifyMandate(basePolicy, combined)

  assert.equal(result.decision, 'BLOCKED')
  assert.equal(result.violations.length, 4)
  assert.deepEqual(result.violations, [
    'Quantity changed from 1 to 2.',
    'Seller is not approved.',
    'Warranty was added without human approval.',
    'Payment receiver wallet does not match the approved wallet.',
  ])

  // The amount-only checks still pass - that is the whole point of the demo.
  assert.equal(result.checks.find((c) => c.rule === 'Maximum Price')?.passed, true)
  assert.equal(result.checks.find((c) => c.rule === 'Per Transaction Limit')?.passed, true)
  assert.equal(result.checks.find((c) => c.rule === 'Product')?.passed, true)
})

// ── Extra guards ──────────────────────────────────────────
test('11. product comparison ignores case and spaces', () => {
  const result = verifyMandate(basePolicy, orderWith({ product: '  1tb ssd  ' }))
  assert.equal(result.checks.find((c) => c.rule === 'Product')?.passed, true)
})

test('12. a different product is BLOCKED', () => {
  const result = verifyMandate(basePolicy, orderWith({ product: '2TB SSD' }))
  assert.equal(result.decision, 'BLOCKED')
  assert.ok(result.violations.includes('Product does not match the approved policy.'))
})

test('13. seller comparison ignores case and spaces', () => {
  const result = verifyMandate(basePolicy, orderWith({ seller: ' securestore ' }))
  assert.equal(result.checks.find((c) => c.rule === 'Approved Seller')?.passed, true)
})

test('14. receiver wallet comparison is exact (case matters)', () => {
  const result = verifyMandate(basePolicy, orderWith({ receiverWallet: 'algo-secure-store' }))
  assert.equal(result.decision, 'BLOCKED')
})

test('15. inactive policy is BLOCKED', () => {
  const result = verifyMandate(policyWith({ status: 'DISABLED' }), baseOrder)
  assert.equal(result.decision, 'BLOCKED')
  assert.ok(result.violations.includes('Policy is not active.'))
})

test('16. the same input always gives the same answer (deterministic)', () => {
  const now = new Date('2026-01-01T00:00:00.000Z')
  const a = verifyMandate(basePolicy, baseOrder, { now })
  const b = verifyMandate(basePolicy, baseOrder, { now })
  assert.deepEqual(a, b)
})

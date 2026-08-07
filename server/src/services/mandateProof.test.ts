// Tests for mandate hashing and replay protection.
// No network, no blockchain, no AI.

import assert from 'node:assert/strict'
import test from 'node:test'
import type { SpendingPolicy } from '../types/index.js'
import {
  canonicalMandate,
  getMandateStatus,
  hashMandate,
  isMandateValid,
  markMandateUsed,
  registerMandate,
  resetMandates,
} from './mandateProof.js'

const policy: SpendingPolicy = {
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

const policyWith = (patch: Partial<SpendingPolicy>): SpendingPolicy => ({
  ...policy,
  ...patch,
})

test('1. the same policy always gives the same hash', () => {
  assert.equal(hashMandate(policy), hashMandate({ ...policy }))
  assert.equal(hashMandate(policy).length, 64, 'SHA-256 hex is 64 characters')
})

test('2. spacing and letter case do not change the hash', () => {
  const messy = policyWith({ product: '  1tb ssd ', approvedSeller: ' SECURESTORE ' })
  assert.equal(hashMandate(policy), hashMandate(messy))
})

test('3. changing any important field changes the hash', () => {
  assert.notEqual(hashMandate(policy), hashMandate(policyWith({ quantity: 2 })))
  assert.notEqual(hashMandate(policy), hashMandate(policyWith({ maxPrice: 6000 })))
  assert.notEqual(
    hashMandate(policy),
    hashMandate(policyWith({ approvedReceiverWallet: 'ALGO-OTHER' })),
  )
})

test('4. the canonical text holds no natural language or AI output', () => {
  const text = canonicalMandate(policy)
  assert.equal(text.includes('instruction'), false)
  assert.equal(text.includes('nvapi'), false)
  assert.ok(text.includes('MG-1001'))
})

test('5. a fresh mandate is ACTIVE', () => {
  resetMandates()
  registerMandate(policy)
  assert.equal(getMandateStatus('MG-1001'), 'ACTIVE')
  assert.equal(isMandateValid('MG-1001'), true)
})

test('6. an unknown mandate is NOT_REGISTERED', () => {
  resetMandates()
  assert.equal(getMandateStatus('MG-9999'), 'NOT_REGISTERED')
})

// ── TEST 6 of the Phase 6 list: replay ────────────────────
test('7. a used mandate becomes USED and is no longer valid', () => {
  resetMandates()
  registerMandate(policy)
  markMandateUsed('MG-1001')

  assert.equal(getMandateStatus('MG-1001'), 'USED')
  assert.equal(isMandateValid('MG-1001'), false)
})

test('8. marking a mandate used twice is refused', () => {
  resetMandates()
  registerMandate(policy)
  assert.notEqual(markMandateUsed('MG-1001'), null)
  assert.equal(markMandateUsed('MG-1001'), null, 'second attempt must fail')
})

// ── TEST 7 of the Phase 6 list: expiry ────────────────────
test('9. an expired mandate reports EXPIRED', () => {
  resetMandates()
  registerMandate(policyWith({ expiresAt: '2020-01-01T00:00:00.000Z' }))

  assert.equal(getMandateStatus('MG-1001'), 'EXPIRED')
  assert.equal(isMandateValid('MG-1001'), false)
})

test('10. registering twice keeps the first record', () => {
  resetMandates()
  const first = registerMandate(policy)
  const second = registerMandate(policy)
  assert.equal(first.registeredAt, second.registeredAt)
})

test('11. proof is honestly labelled as off-chain in Phase 6', () => {
  resetMandates()
  const record = registerMandate(policy)
  assert.equal(record.storage, 'IN_MEMORY')
})

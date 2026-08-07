// Tests for the on-chain anchor.
//
// The rules that matter: the note format is exact, a bad transaction id is
// refused before we ever touch the network, and a mismatched note is refused
// even when the transaction is real.

import assert from 'node:assert/strict'
import test from 'node:test'
import { NOTE_PREFIX, expectedNote, verifyAnchor } from './chainAnchor.js'
import { hashMandate, registerMandate, resetMandates, setMandateAnchor } from './mandateProof.js'
import type { SpendingPolicy } from '../types/index.js'

const policy: SpendingPolicy = {
  id: 'MG-9001',
  product: '1TB SSD',
  quantity: 1,
  maxPrice: 100,
  approvedSeller: 'TrustedStore',
  warrantyAllowed: false,
  approvedReceiverWallet: 'WALLET-A',
  perTransactionLimit: 100,
  dailyLimit: 200,
  expiresAt: '2099-01-01T00:00:00.000Z',
  status: 'ACTIVE',
}

const HASH_64 = /^[0-9a-f]{64}$/

test('1. the note is the prefix plus the exact fingerprint', () => {
  const hash = hashMandate(policy)
  assert.match(hash, HASH_64)
  assert.equal(expectedNote(hash), `${NOTE_PREFIX}${hash}`)
  // Comfortably inside Algorand's 1000-byte note limit.
  assert.ok(Buffer.byteLength(expectedNote(hash)) < 1000)
})

test('2. editing the policy changes the note, so the chain stops agreeing', () => {
  const original = expectedNote(hashMandate(policy))
  const tampered = expectedNote(hashMandate({ ...policy, maxPrice: 100000 }))
  assert.notEqual(original, tampered)
})

test('3. a malformed transaction id is refused without a network call', async () => {
  const result = await verifyAnchor('not-a-real-id', hashMandate(policy))
  assert.equal(result.ok, false)
  assert.equal(result.anchor, null)
  assert.match(result.reason ?? '', /not a valid Algorand transaction id/i)
})

test('4. lowercase and wrong-length ids are refused too', async () => {
  for (const bad of ['', 'a'.repeat(52), 'ABC', 'A'.repeat(51), 'A'.repeat(53), 'A1'.repeat(26)]) {
    const result = await verifyAnchor(bad, hashMandate(policy))
    assert.equal(result.ok, false, `expected "${bad.slice(0, 10)}" to be refused`)
  }
})

test('5. a fresh mandate is never anchored', () => {
  resetMandates()
  const record = registerMandate(policy)
  assert.equal(record.anchorTxId, null)
  assert.equal(record.anchoredAt, null)
})

test('6. recording an anchor stores the id and the block time', () => {
  resetMandates()
  registerMandate(policy)

  const roundTime = 1_700_000_000
  const updated = setMandateAnchor(policy.id, 'B'.repeat(52), roundTime)

  assert.equal(updated?.anchorTxId, 'B'.repeat(52))
  // The timestamp comes from the block, not from our own clock.
  assert.equal(updated?.anchoredAt, new Date(roundTime * 1000).toISOString())
})

test('7. anchoring an unknown mandate does nothing', () => {
  resetMandates()
  assert.equal(setMandateAnchor('MG-DOES-NOT-EXIST', 'C'.repeat(52), 0), null)
})

test('8. the anchor never decides APPROVED or BLOCKED', async () => {
  // Proof of separation: nothing in this module can produce a verdict.
  const source = await import('node:fs/promises').then((fs) =>
    fs.readFile(new URL('./chainAnchor.ts', import.meta.url), 'utf8'),
  )
  assert.ok(!/'APPROVED'|'BLOCKED'/.test(source))
})

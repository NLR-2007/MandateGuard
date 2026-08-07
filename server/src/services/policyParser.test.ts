// Unit tests for the natural-language parser.
// NVIDIA is never called here - `complete` is replaced with a fake function,
// so these tests cost nothing and work offline.

import assert from 'node:assert/strict'
import test from 'node:test'
import type { CompleteFn } from './nimClient.js'
import { parseHumanInstruction, validateParsedPolicy } from './policyParser.js'

/** Builds a fake NIM that always replies with the given text. */
const fakeNim =
  (reply: string): CompleteFn =>
  async () =>
    reply

const fullReply = JSON.stringify({
  product: '1TB SSD',
  quantity: 1,
  maxPrice: 5000,
  approvedSeller: 'SecureStore',
  warrantyAllowed: false,
  approvedReceiverWallet: 'ALGO-SECURE-STORE',
  perTransactionLimit: 5000,
  dailyLimit: 10000,
  validForMinutes: 120,
})

// ── 1. simple instruction ─────────────────────────────────
test('1. a complete instruction produces a complete draft', async () => {
  const out = await parseHumanInstruction(
    'Buy one 1TB SSD below 5000 from SecureStore.',
    fakeNim(fullReply),
  )

  assert.equal(out.draft.product, '1TB SSD')
  assert.equal(out.draft.quantity, 1)
  assert.equal(out.draft.maxPrice, 5000)
  assert.equal(out.draft.approvedSeller, 'SecureStore')
  assert.equal(out.draft.warrantyAllowed, false)
  assert.equal(out.draft.approvedReceiverWallet, 'ALGO-SECURE-STORE')
  assert.deepEqual(out.missingFields, [])
})

// ── 2. complex instruction with fences and currency text ──
test('2. handles ```json fences, ₹ symbols and comma numbers', async () => {
  const messy =
    '```json\n' +
    JSON.stringify({
      product: '  1TB SSD ',
      quantity: 1,
      maxPrice: '₹5,000',
      approvedSeller: 'SecureStore',
      warrantyAllowed: 'no',
      approvedReceiverWallet: 'ALGO-SECURE-STORE',
      perTransactionLimit: '5000',
      dailyLimit: '₹10,000',
      validForMinutes: 120,
    }) +
    '\n```'

  const out = await parseHumanInstruction('anything', fakeNim(messy))

  assert.equal(out.draft.product, '1TB SSD')
  assert.equal(out.draft.maxPrice, 5000)
  assert.equal(out.draft.dailyLimit, 10000)
  assert.equal(out.draft.warrantyAllowed, false)
})

// ── 3. missing seller ─────────────────────────────────────
test('3. missing seller is reported, not invented', async () => {
  const reply = JSON.stringify({
    product: 'SSD',
    quantity: null,
    maxPrice: 5000,
    approvedSeller: null,
    warrantyAllowed: null,
    approvedReceiverWallet: null,
    perTransactionLimit: null,
    dailyLimit: null,
    validForMinutes: null,
  })

  const out = await parseHumanInstruction('Buy an SSD below 5000.', fakeNim(reply))

  assert.equal(out.draft.approvedSeller, null)
  assert.ok(out.missingFields.includes('approvedSeller'))
})

// ── 4. missing wallet ─────────────────────────────────────
test('4. missing receiver wallet is reported', async () => {
  const reply = JSON.stringify({ product: 'SSD', maxPrice: 5000 })
  const out = await parseHumanInstruction('Buy an SSD below 5000.', fakeNim(reply))

  assert.equal(out.draft.approvedReceiverWallet, null)
  assert.ok(out.missingFields.includes('approvedReceiverWallet'))
})

// ── 5. missing daily limit ────────────────────────────────
test('5. missing daily limit and expiry are reported', async () => {
  const reply = JSON.stringify({
    product: '1TB SSD',
    quantity: 1,
    maxPrice: 5000,
    approvedSeller: 'SecureStore',
    warrantyAllowed: false,
    approvedReceiverWallet: 'ALGO-SECURE-STORE',
    perTransactionLimit: 5000,
    dailyLimit: null,
    validForMinutes: null,
  })

  const out = await parseHumanInstruction('...', fakeNim(reply))

  assert.ok(out.missingFields.includes('dailyLimit'))
  assert.ok(out.missingFields.includes('expiresAt'))
})

// ── 6. invalid AI JSON ────────────────────────────────────
test('6. a non-JSON reply is rejected', async () => {
  await assert.rejects(
    () => parseHumanInstruction('...', fakeNim('Sure! I can help you buy an SSD.')),
    /did not return valid JSON/i,
  )
})

test('6b. a JSON array is rejected', async () => {
  await assert.rejects(
    () => parseHumanInstruction('...', fakeNim('[1,2,3]')),
    /valid JSON|JSON object/i,
  )
})

// ── 7. NVIDIA unavailable ─────────────────────────────────
test('7. an AI failure bubbles up instead of inventing a draft', async () => {
  const brokenNim: CompleteFn = async () => {
    throw new Error('connect ECONNREFUSED')
  }
  await assert.rejects(() => parseHumanInstruction('...', brokenNim), /ECONNREFUSED/)
})

// ── validation guards ─────────────────────────────────────
test('8. negative price is dropped, not accepted', () => {
  const out = validateParsedPolicy({ product: 'SSD', maxPrice: -100 })
  assert.equal(out.draft.maxPrice, null)
  assert.ok(out.warnings.some((w) => /negative/i.test(w)))
})

test('9. quantity of 0 or a fraction is dropped', () => {
  assert.equal(validateParsedPolicy({ quantity: 0 }).draft.quantity, null)
  assert.equal(validateParsedPolicy({ quantity: 1.5 }).draft.quantity, null)
  assert.equal(validateParsedPolicy({ quantity: 3 }).draft.quantity, 3)
})

test('10. an empty or "not specified" product becomes null', () => {
  assert.equal(validateParsedPolicy({ product: '   ' }).draft.product, null)
  assert.equal(validateParsedPolicy({ product: 'not specified' }).draft.product, null)
})

test('11. an unclear boolean is left empty with a warning', () => {
  const out = validateParsedPolicy({ warrantyAllowed: 'maybe' })
  assert.equal(out.draft.warrantyAllowed, null)
  assert.ok(out.warnings.length > 0)
})

test('12. limits lower than the max price raise a warning', () => {
  const out = validateParsedPolicy({
    maxPrice: 5000,
    perTransactionLimit: 1000,
    dailyLimit: 2000,
  })
  assert.ok(out.warnings.some((w) => /per-transaction limit is lower/i.test(w)))
  assert.ok(out.warnings.some((w) => /daily limit is lower/i.test(w)))
})

test('13. an empty instruction is refused before calling the AI', async () => {
  let called = false
  const spy: CompleteFn = async () => {
    called = true
    return '{}'
  }
  await assert.rejects(() => parseHumanInstruction('   ', spy), /type an instruction/i)
  assert.equal(called, false, 'the AI must not be called for empty input')
})

test('14. the parser never decides APPROVED or BLOCKED', async () => {
  const sneaky = JSON.stringify({
    product: '1TB SSD',
    decision: 'APPROVED',
    approved: true,
  })
  const out = await parseHumanInstruction('...', fakeNim(sneaky))

  assert.equal('decision' in out.draft, false)
  assert.equal('approved' in out.draft, false)
})

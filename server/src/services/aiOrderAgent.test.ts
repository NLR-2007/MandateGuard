// Unit tests for the AI shopping agent and for the end-to-end guarantee
// that MandateGuard - not the AI - makes the final decision.
// NVIDIA is never called here.

import assert from 'node:assert/strict'
import test from 'node:test'
import { SELLER_WALLETS, demoCatalog, manipulatedOrderTemplate } from '../data/demoCatalog.js'
import type { SpendingPolicy } from '../types/index.js'
import {
  buildOrderFromChoice,
  buildSimulatedUnsafeOrder,
  prepareAiOrder,
} from './aiOrderAgent.js'
import { verifyMandate } from './mandateVerifier.js'
import type { CompleteFn } from './nimClient.js'

const policy: SpendingPolicy = {
  id: 'MG-1001',
  product: '1TB SSD',
  quantity: 1,
  maxPrice: 5000,
  approvedSeller: 'SecureStore',
  warrantyAllowed: false,
  approvedReceiverWallet: SELLER_WALLETS.SecureStore,
  perTransactionLimit: 5000,
  dailyLimit: 10000,
  expiresAt: '2030-12-31T23:59:00.000Z',
  status: 'ACTIVE',
}

const fakeNim =
  (reply: string): CompleteFn =>
  async () =>
    reply

test('1. a good AI choice becomes a valid order', async () => {
  const prepared = await prepareAiOrder(
    policy,
    fakeNim(
      JSON.stringify({
        catalogId: 'SSD-001',
        quantity: 1,
        warrantyAdded: false,
        reason: 'Matches the approved product, seller and price.',
      }),
    ),
  )

  assert.equal(prepared.order.product, '1TB SSD')
  assert.equal(prepared.order.price, 4800)
  assert.equal(prepared.order.seller, 'SecureStore')
  assert.equal(prepared.order.receiverWallet, SELLER_WALLETS.SecureStore)
  assert.ok(prepared.order.orderId.startsWith('AI-ORDER-'))
})

test('2. price, seller and wallet always come from the catalog, never from the AI', () => {
  // The model tries to set its own price and payment address.
  const prepared = buildOrderFromChoice({
    catalogId: 'SSD-001',
    quantity: 1,
    warrantyAdded: false,
    price: 1,
    seller: 'EvilStore',
    receiverWallet: 'ALGO-ATTACKER',
  })

  assert.equal(prepared.order.price, 4800, 'price must come from the catalog')
  assert.equal(prepared.order.seller, 'SecureStore')
  assert.equal(prepared.order.receiverWallet, SELLER_WALLETS.SecureStore)
})

test('3. an item that is not in the catalog is rejected', () => {
  assert.throws(
    () => buildOrderFromChoice({ catalogId: 'SSD-999', quantity: 1 }),
    /not in the catalog/i,
  )
})

test('4. a non-JSON-object reply is rejected', () => {
  assert.throws(() => buildOrderFromChoice('hello'), /JSON object/i)
})

test('5. a missing or bad quantity falls back to 1', () => {
  assert.equal(buildOrderFromChoice({ catalogId: 'SSD-001' }).order.quantity, 1)
  assert.equal(
    buildOrderFromChoice({ catalogId: 'SSD-001', quantity: -3 }).order.quantity,
    1,
  )
})

test('6. the reason is kept short and never becomes chain-of-thought', () => {
  const long = 'x'.repeat(5000)
  const prepared = buildOrderFromChoice({ catalogId: 'SSD-001', reason: long })
  assert.ok(prepared.reason.length <= 160)
})

// ── The important guarantee ───────────────────────────────
test('7. a correct AI order is APPROVED by MandateGuard', async () => {
  const prepared = await prepareAiOrder(
    policy,
    fakeNim(JSON.stringify({ catalogId: 'SSD-001', quantity: 1, warrantyAdded: false })),
  )

  const result = verifyMandate(policy, prepared.order)
  assert.equal(result.decision, 'APPROVED')
})

test('8. the simulated unsafe order is BLOCKED with 4 violations', () => {
  const order = buildSimulatedUnsafeOrder(manipulatedOrderTemplate)
  const result = verifyMandate(policy, order)

  assert.equal(result.decision, 'BLOCKED')
  assert.equal(result.violations.length, 4)
  // The amount is still fine - that is the whole point of the demo.
  assert.equal(result.checks.find((c) => c.rule === 'Maximum Price')?.passed, true)
})

test('9. an AI that picks the wrong shop is BLOCKED, not trusted', async () => {
  // SSD-002 is the same product but from an unapproved seller.
  const prepared = await prepareAiOrder(
    policy,
    fakeNim(JSON.stringify({ catalogId: 'SSD-002', quantity: 1, warrantyAdded: false })),
  )

  const result = verifyMandate(policy, prepared.order)
  assert.equal(result.decision, 'BLOCKED')
  assert.ok(result.violations.includes('Seller is not approved.'))
})

test('10. an AI that adds warranty on its own is BLOCKED', async () => {
  const prepared = await prepareAiOrder(
    policy,
    fakeNim(JSON.stringify({ catalogId: 'SSD-001', quantity: 1, warrantyAdded: true })),
  )

  const result = verifyMandate(policy, prepared.order)
  assert.equal(result.decision, 'BLOCKED')
  assert.ok(result.violations.includes('Warranty was added without human approval.'))
})

test('11. an AI that picks the wrong product is BLOCKED', async () => {
  const prepared = await prepareAiOrder(
    policy,
    fakeNim(JSON.stringify({ catalogId: 'SSD-003', quantity: 1, warrantyAdded: false })),
  )

  assert.equal(prepared.order.product, '2TB SSD')
  const result = verifyMandate(policy, prepared.order)
  assert.equal(result.decision, 'BLOCKED')
  assert.ok(result.violations.includes('Product does not match the approved policy.'))
})

test('12. the catalog is real sample data with real seller wallets', () => {
  assert.ok(demoCatalog.length >= 3)
  assert.equal(demoCatalog[0].id, 'SSD-001')

  // Every wallet must be a genuine Algorand address, because an approved
  // seller actually receives test USDC at it.
  for (const item of demoCatalog) {
    assert.match(
      item.receiverWallet,
      /^[A-Z2-7]{58}$/,
      `${item.id} has a wallet that Algorand would reject`,
    )
  }
})

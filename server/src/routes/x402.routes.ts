// The paid MandateGuard endpoint - Phase 6.
//
// Order of events:
//   1. x402 middleware runs first. No valid payment -> 402, and nothing below
//      this line executes.
//   2. Only after the facilitator confirms the payment does the handler run.
//   3. The handler reuses the SAME deterministic Phase 4 engine.
//
// x402 checks PAYMENT. MandateGuard checks INTENT. They are separate answers.

import { Hono } from 'hono'
import { getSpentToday, nextVerificationId } from '../data/memoryStore.js'
import { recordVerification, setPaymentProof } from '../services/auditService.js'
import { addEvent, nextRequestId } from '../services/flowService.js'
import {
  getMandate,
  getMandateStatus,
  isMandateValid,
  markMandateUsed,
  registerMandate,
  setMandateAnchor,
} from '../services/mandateProof.js'
import { expectedNote, verifyAnchor } from '../services/chainAnchor.js'
import { verifyMandate } from '../services/mandateVerifier.js'
import { getPolicy, validateOrderInput } from '../services/policyService.js'
import type { AIOrder, OrderSource, PolicySource } from '../types/index.js'
import { createX402Middleware, readSettlement } from '../x402/paymentMiddleware.js'
import { NETWORK_LABEL, VERIFICATION_PRICE, explorerTxUrl } from '../x402/x402Config.js'

const POLICY_SOURCES: PolicySource[] = ['MANUAL', 'NVIDIA_NIM_ASSISTED']
const ORDER_SOURCES: OrderSource[] = ['MANUAL_DEMO', 'NVIDIA_NIM', 'SECURITY_SIMULATION']

export function createX402Routes(): Hono {
  const routes = new Hono()

  // ── PAYMENT GATE ────────────────────────────────────────
  // Everything after this line requires a settled Test USDC payment.
  routes.use('/x402/verify-mandate', createX402Middleware())

  routes.post('/x402/verify-mandate', async (c) => {
    console.log('  ✓ x402 PAYMENT VERIFIED - MandateGuard handler starting')

    // The middleware puts the facilitator's answer on the response headers.
    const settlement = readSettlement(c.res.headers.get('PAYMENT-RESPONSE'))

    if (settlement?.transaction) {
      console.log(`  ⛓ Algorand TestNet tx: ${settlement.transaction}`)
    } else {
      console.log('  ⛓ No transaction id was returned by the facilitator')
    }

    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json({ success: false, errors: ['Body must be valid JSON.'] }, 400)
    }

    const b = body as Record<string, unknown>

    if (typeof b?.policyId !== 'string' || b.policyId.trim() === '') {
      return c.json({ success: false, errors: ['Policy ID is required.'] }, 400)
    }

    const orderErrors = validateOrderInput(b.order)
    if (orderErrors.length > 0) {
      return c.json({ success: false, errors: orderErrors }, 400)
    }

    const policy = getPolicy(b.policyId)
    if (!policy) {
      return c.json({ success: false, error: 'Policy not found.' }, 404)
    }

    const order = b.order as unknown as AIOrder

    const requestId =
      typeof b.requestId === 'string' && b.requestId.trim() !== ''
        ? b.requestId.trim()
        : nextRequestId()

    addEvent(
      requestId,
      'x402 payment verified',
      settlement?.transaction ? `tx ${settlement.transaction}` : 'no transaction id returned',
    )

    // Mandate proof: fingerprint the policy so it can be checked for replay.
    const mandate = registerMandate(policy)
    const mandateStatusBefore = getMandateStatus(policy.id)

    console.log('  ▶ MandateGuard verification started')
    addEvent(requestId, 'MandateGuard verification started')

    // ── The deterministic Phase 4 engine. Unchanged. ──────
    const result = verifyMandate(policy, order, {
      spentToday: getSpentToday(),
      verificationId: nextVerificationId(),
    })

    // Replay protection: a consumed mandate can never approve again.
    const replayBlocked = !isMandateValid(policy.id)
    const violations = [...result.violations]
    let decision = result.decision

    if (replayBlocked && mandateStatusBefore === 'USED') {
      decision = 'BLOCKED'
      if (!violations.includes('Mandate has already been used.')) {
        violations.push('Mandate has already been used.')
      }
    }

    const policySource = POLICY_SOURCES.includes(b.policySource as PolicySource)
      ? (b.policySource as PolicySource)
      : 'MANUAL'
    const orderSource = ORDER_SOURCES.includes(b.orderSource as OrderSource)
      ? (b.orderSource as OrderSource)
      : 'MANUAL_DEMO'

    const finalResult = { ...result, decision, violations }

    const entry = recordVerification(finalResult, order, {
      policySource,
      orderSource,
      requestId,
    })

    addEvent(
      requestId,
      `MandateGuard ${decision}`,
      violations.length > 0 ? violations.join(' ') : 'all checks passed',
    )

    // Only real values from the facilitator are stored - never invented ones.
    setPaymentProof(entry, {
      x402PaymentStatus: settlement?.success ? 'VERIFIED' : 'UNKNOWN',
      x402TransactionId: settlement?.transaction ?? null,
      x402Amount: VERIFICATION_PRICE,
      blockchainNetwork: NETWORK_LABEL,
      paymentVerifiedAt: new Date().toISOString(),
      mandateHash: mandate.mandateHash,
      mandateStatus: getMandateStatus(policy.id),
    })

    console.log(
      `  ${decision === 'APPROVED' ? '✓' : '✕'} MandateGuard decision: ${decision} ` +
        `(${violations.length} violation(s))`,
    )

    return c.json({
      success: true,
      requestId,
      ...finalResult,
      payment: {
        protocol: 'x402',
        network: NETWORK_LABEL,
        status: settlement?.success ? 'VERIFIED' : 'UNKNOWN',
        amount: VERIFICATION_PRICE,
        asset: 'Test USDC',
        transactionId: settlement?.transaction ?? null,
        payer: settlement?.payer ?? null,
        explorerUrl: settlement?.transaction
          ? explorerTxUrl(settlement.transaction)
          : null,
        verifiedAt: new Date().toISOString(),
      },
      mandate: {
        mandateId: mandate.mandateId,
        mandateHash: mandate.mandateHash,
        status: getMandateStatus(policy.id),
        storage: mandate.storage,
        // True only when the fingerprint has actually been written to
        // Algorand TestNet and read back. Never assumed.
        onChain: Boolean(mandate.anchorTxId),
        anchorTxId: mandate.anchorTxId,
        anchorExplorerUrl: mandate.anchorTxId ? explorerTxUrl(mandate.anchorTxId) : null,
        note: mandate.anchorTxId
          ? `Fingerprint written to Algorand TestNet in transaction ${mandate.anchorTxId}.`
          : 'Fingerprint is recorded in MySQL. It has not been written to Algorand yet — use "Write proof to Algorand" on the dashboard.',
      },
    })
  })

  return routes
}

/**
 * Marks a mandate as used - separate from paying the verification fee.
 * Called only when the application records an executed purchase.
 */
export const mandateRoutes = new Hono()

mandateRoutes.post('/mandates/:id/mark-used', (c) => {
  const id = c.req.param('id')
  const status = getMandateStatus(id)

  if (status === 'NOT_REGISTERED') {
    return c.json({ success: false, error: 'Mandate is not registered.' }, 404)
  }
  if (status === 'USED') {
    return c.json({ success: false, error: 'Mandate has already been used.' }, 400)
  }
  if (status === 'EXPIRED') {
    return c.json({ success: false, error: 'Mandate has expired.' }, 400)
  }

  markMandateUsed(id)
  console.log(`  ⛓ Mandate ${id} marked USED (replay protection)`)

  return c.json({ success: true, mandateId: id, status: getMandateStatus(id) })
})

mandateRoutes.get('/mandates/:id', (c) => {
  const id = c.req.param('id')
  return c.json({ success: true, mandateId: id, status: getMandateStatus(id) })
})

/**
 * Confirms that a mandate fingerprint really was written to Algorand TestNet.
 *
 * The browser sends only a transaction id. The server then reads that
 * transaction from the public indexer and compares the note against the
 * fingerprint it computed itself. A mismatch is refused. Nothing is stored on
 * the browser's say-so, and no id is ever invented.
 */
mandateRoutes.post('/mandates/:id/anchor', async (c) => {
  const id = c.req.param('id')
  const record = getMandate(id)

  if (!record) {
    return c.json({ success: false, error: 'Mandate is not registered.' }, 404)
  }

  const body = await c.req.json().catch(() => null)
  const txId = (body as { txId?: string } | null)?.txId?.trim()

  if (!txId) {
    return c.json({ success: false, error: 'txId is required.' }, 400)
  }

  const check = await verifyAnchor(txId, record.mandateHash)

  if (!check.ok || !check.anchor) {
    console.log(`  ⛓ Anchor REFUSED for ${id}: ${check.reason}`)
    return c.json({ success: false, error: check.reason, verified: false }, 400)
  }

  const updated = setMandateAnchor(id, check.anchor.txId, check.anchor.roundTime)
  console.log(
    `  ⛓ Mandate ${id} anchored on Algorand TestNet: ${check.anchor.txId} ` +
      `(round ${check.anchor.confirmedRound})`,
  )

  return c.json({
    success: true,
    verified: true,
    mandateId: id,
    mandateHash: record.mandateHash,
    anchor: {
      ...check.anchor,
      anchoredAt: updated?.anchoredAt ?? null,
      network: NETWORK_LABEL,
    },
  })
})

/**
 * Re-reads the anchor from the chain every time it is asked.
 *
 * This is the demo's strongest claim: the proof does not live in our database,
 * it lives on Algorand, and it can be checked again at any moment by anyone.
 */
mandateRoutes.get('/mandates/:id/anchor', async (c) => {
  const id = c.req.param('id')
  const record = getMandate(id)

  if (!record) {
    return c.json({ success: false, error: 'Mandate is not registered.' }, 404)
  }

  if (!record.anchorTxId) {
    return c.json({
      success: true,
      mandateId: id,
      mandateHash: record.mandateHash,
      anchored: false,
      expectedNote: expectedNote(record.mandateHash),
      anchor: null,
    })
  }

  const check = await verifyAnchor(record.anchorTxId, record.mandateHash)

  return c.json({
    success: true,
    mandateId: id,
    mandateHash: record.mandateHash,
    anchored: true,
    /** Freshly re-checked against the chain, not read from our database. */
    stillMatches: check.ok,
    reason: check.reason,
    expectedNote: expectedNote(record.mandateHash),
    anchor: check.anchor
      ? { ...check.anchor, anchoredAt: record.anchoredAt, network: NETWORK_LABEL }
      : null,
  })
})

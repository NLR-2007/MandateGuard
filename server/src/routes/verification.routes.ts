import { Hono } from 'hono'
import { getSpentToday, nextVerificationId } from '../data/memoryStore.js'
import { recordVerification } from '../services/auditService.js'
import { addEvent } from '../services/flowService.js'
import { verifyMandate } from '../services/mandateVerifier.js'
import { getPolicy, validateOrderInput } from '../services/policyService.js'
import type { AIOrder, OrderSource, PolicySource } from '../types/index.js'

const POLICY_SOURCES: PolicySource[] = ['MANUAL', 'NVIDIA_NIM_ASSISTED']
const ORDER_SOURCES: OrderSource[] = ['MANUAL_DEMO', 'NVIDIA_NIM', 'SECURITY_SIMULATION']

export const verificationRoutes = new Hono()

/** POST /api/verify-mandate - the real MandateGuard decision */
verificationRoutes.post('/verify-mandate', async (c) => {
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

  // The decision itself - plain deterministic code, no AI involved.
  const result = verifyMandate(policy, order, {
    spentToday: getSpentToday(),
    verificationId: nextVerificationId(),
  })

  // Labels only - they never influence the decision.
  const policySource = POLICY_SOURCES.includes(b.policySource as PolicySource)
    ? (b.policySource as PolicySource)
    : 'MANUAL'
  const orderSource = ORDER_SOURCES.includes(b.orderSource as OrderSource)
    ? (b.orderSource as OrderSource)
    : 'MANUAL_DEMO'

  const requestId =
    typeof b.requestId === 'string' && b.requestId.trim() !== '' ? b.requestId.trim() : null

  if (requestId) {
    addEvent(requestId, `MandateGuard ${result.decision} (free route, no payment)`)
  }

  recordVerification(result, order, { policySource, orderSource, requestId })

  console.log(
    `  ${result.decision === 'APPROVED' ? '✓' : '✕'} ${result.verificationId} ` +
      `${result.decision} (${result.violations.length} violation(s))`,
  )

  return c.json({ success: true, ...result })
})

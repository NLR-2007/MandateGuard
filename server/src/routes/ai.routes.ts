import { Hono } from 'hono'
import { demoCatalog, manipulatedOrderTemplate } from '../data/demoCatalog.js'
import {
  buildSimulatedUnsafeOrder,
  prepareAiOrder,
} from '../services/aiOrderAgent.js'
import { addEvent, nextRequestId } from '../services/flowService.js'
import { describeNimError, getModelName, isNimConfigured } from '../services/nimClient.js'
import { parseHumanInstruction } from '../services/policyParser.js'
import { getPolicy } from '../services/policyService.js'

/** Uses the caller's request id when present, otherwise starts a new journey. */
function resolveRequestId(body: Record<string, unknown>): string {
  const supplied = body?.requestId
  return typeof supplied === 'string' && supplied.trim() !== ''
    ? supplied.trim()
    : nextRequestId()
}

export const aiRoutes = new Hono()

/** POST /api/ai/parse-policy - English instruction -> draft policy JSON */
aiRoutes.post('/ai/parse-policy', async (c) => {
  if (!isNimConfigured()) {
    return c.json(
      {
        success: false,
        error:
          'AI is not configured on the server. You can still create the policy manually.',
      },
      503,
    )
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ success: false, error: 'Body must be valid JSON.' }, 400)
  }

  const instruction = (body as Record<string, unknown>)?.instruction

  if (typeof instruction !== 'string' || instruction.trim() === '') {
    return c.json({ success: false, error: 'Please type an instruction first.' }, 400)
  }

  const requestId = resolveRequestId(body as Record<string, unknown>)
  addEvent(requestId, 'Human instruction submitted')

  try {
    const outcome = await parseHumanInstruction(instruction)

    console.log(
      `  ◇ NIM parsed an instruction (${outcome.missingFields.length} field(s) missing)`,
    )

    addEvent(requestId, 'NVIDIA NIM created draft', `model ${getModelName() ?? 'unknown'}`)

    return c.json({
      success: true,
      requestId,
      source: 'NVIDIA_NIM',
      model: getModelName(),
      draft: outcome.draft,
      missingFields: outcome.missingFields,
      warnings: outcome.warnings,
      note: 'This is a draft. A human must review and approve it before it becomes a policy.',
    })
  } catch (error) {
    console.error('  ✕ parse-policy failed:', (error as Error).message)
    return c.json({ success: false, error: describeNimError(error) }, 502)
  }
})

/** POST /api/ai/prepare-order - AI agent picks an item from the demo catalog */
aiRoutes.post('/ai/prepare-order', async (c) => {
  if (!isNimConfigured()) {
    return c.json(
      {
        success: false,
        error: 'AI is not configured on the server. You can still use the demo orders.',
      },
      503,
    )
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ success: false, error: 'Body must be valid JSON.' }, 400)
  }

  const policyId = (body as Record<string, unknown>)?.policyId

  if (typeof policyId !== 'string' || policyId.trim() === '') {
    return c.json({ success: false, error: 'Policy ID is required.' }, 400)
  }

  const policy = getPolicy(policyId)
  if (!policy) {
    return c.json({ success: false, error: 'Policy not found.' }, 404)
  }

  const requestId = resolveRequestId(body as Record<string, unknown>)

  try {
    const prepared = await prepareAiOrder(policy)

    console.log(`  ◇ NIM prepared ${prepared.order.orderId} from ${prepared.catalogId}`)

    addEvent(requestId, 'AI created order', `${prepared.order.orderId} (${prepared.catalogId})`)

    return c.json({
      success: true,
      requestId,
      source: 'NVIDIA_NIM',
      model: getModelName(),
      order: prepared.order,
      reason: prepared.reason,
      note: 'This AI order is not trusted. It must still be verified by MandateGuard.',
    })
  } catch (error) {
    console.error('  ✕ prepare-order failed:', (error as Error).message)
    return c.json({ success: false, error: describeNimError(error) }, 502)
  }
})

/**
 * POST /api/ai/simulate-unsafe-order
 * Controlled demo data - no AI is asked to misbehave.
 */
aiRoutes.post('/ai/simulate-unsafe-order', (c) => {
  return c.json({
    success: true,
    source: 'SECURITY_SIMULATION',
    order: buildSimulatedUnsafeOrder(manipulatedOrderTemplate),
    note: 'Security demo simulation. This order is fixed sample data, not produced by the AI.',
  })
})

/** GET /api/ai/catalog - the pretend shop, useful for the demo UI */
aiRoutes.get('/ai/catalog', (c) => {
  return c.json({ success: true, catalog: demoCatalog })
})

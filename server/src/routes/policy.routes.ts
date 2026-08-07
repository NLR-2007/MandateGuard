import { Hono } from 'hono'
import { addEvent } from '../services/flowService.js'
import { registerMandate } from '../services/mandateProof.js'
import { notifyPolicyCreated } from '../services/notifier.js'
import {
  createPolicy,
  getPolicy,
  listPolicies,
  validatePolicyInput,
  type PolicyInput,
} from '../services/policyService.js'

export const policyRoutes = new Hono()

/** POST /api/policies - create a human spending policy */
policyRoutes.post('/policies', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ success: false, errors: ['Body must be valid JSON.'] }, 400)
  }

  const errors = validatePolicyInput(body)
  if (errors.length > 0) {
    return c.json({ success: false, errors }, 400)
  }

  const policy = createPolicy(body as PolicyInput)

  // Fingerprint the mandate as soon as the human approves the policy.
  const mandate = registerMandate(policy)

  const requestId = (body as Record<string, unknown>).requestId
  if (typeof requestId === 'string' && requestId.trim() !== '') {
    addEvent(requestId, 'Human approved policy', policy.id)
    addEvent(requestId, 'Mandate proof registered', `hash ${mandate.mandateHash.slice(0, 12)}…`)
  }

  console.log(`  ✓ Policy created: ${policy.id} (mandate ${mandate.mandateHash.slice(0, 12)}…)`)

  // Tell the user on their phone. Never blocks the response.
  notifyPolicyCreated(policy)

  return c.json({ success: true, policy, mandate }, 201)
})

/** GET /api/policies - list every policy created since the server started */
policyRoutes.get('/policies', (c) => {
  return c.json({ success: true, policies: listPolicies() })
})

/** GET /api/policies/:id - one policy */
policyRoutes.get('/policies/:id', (c) => {
  const policy = getPolicy(c.req.param('id'))
  if (!policy) {
    return c.json({ success: false, error: 'Policy not found.' }, 404)
  }
  return c.json({ success: true, policy })
})

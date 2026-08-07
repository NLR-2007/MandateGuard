import { Hono } from 'hono'
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
  console.log(`  ✓ Policy created: ${policy.id}`)
  return c.json({ success: true, policy }, 201)
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

// The attack endpoints.
//
// Anyone can hit these, including a judge on their own laptop. That is the
// point: the claim is falsifiable, and here is the button that would falsify
// it if it were false.

import { Hono } from 'hono'
import { ATTACKS, runAttack } from '../services/redTeam.js'
import { listPolicies } from '../services/policyService.js'

export const redTeamRoutes = new Hono()

redTeamRoutes.get('/security/attacks', (c) =>
  c.json({ success: true, attacks: ATTACKS }),
)

/** Runs one attack, or every attack if no id is given. */
redTeamRoutes.post('/security/attack', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { attackId?: string; policyId?: string }

  const policy = body.policyId
    ? listPolicies().find((p) => p.id === body.policyId)
    : listPolicies().filter((p) => p.status === 'ACTIVE').at(-1)

  if (!policy) {
    return c.json({ success: false, error: 'There is no active rule to attack.' }, 404)
  }

  const chosen = body.attackId ? ATTACKS.filter((a) => a.id === body.attackId) : ATTACKS
  if (chosen.length === 0) {
    return c.json({ success: false, error: 'Unknown attack.' }, 404)
  }

  const results = []
  for (const attack of chosen) {
    const r = await runAttack(policy, attack)
    console.log(
      `  ☠ attack "${attack.id}" → AI ${r.aiObeyed ? 'OBEYED' : 'held'} · ${r.outcome}` +
        (r.moneyAtRisk ? ` · ₹${r.moneyAtRisk} at risk` : ''),
    )
    results.push(r)
  }

  const gotThrough = results.filter((r) => r.outcome === 'GOT_THROUGH').length
  const foolled = results.filter((r) => r.aiObeyed).length
  const saved = results.reduce((sum, r) => sum + r.moneyAtRisk, 0)

  return c.json({
    success: true,
    policy: { id: policy.id, product: policy.product, maxPrice: policy.maxPrice, seller: policy.approvedSeller },
    results,
    summary: {
      attacks: results.length,
      aiFooled: foolled,
      blockedByEngine: results.filter((r) => r.outcome === 'BLOCKED_BY_ENGINE').length,
      gotThrough,
      moneyProtected: saved,
      verdict:
        gotThrough === 0
          ? 'Every attack was stopped before money moved.'
          : `${gotThrough} attack(s) produced an order the rule allows.`,
    },
  })
})

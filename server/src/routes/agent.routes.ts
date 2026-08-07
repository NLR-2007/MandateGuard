// The agent's endpoints.
//
// One to start a shopping run, one for the browser to watch it. The browser
// has to watch, because approval can arrive from Telegram rather than from
// the page the user is looking at.

import { Hono } from 'hono'
import { getPolicy } from '../services/policyService.js'
import { decideRun, getRun, listRuns, runAgent, type AgentMode } from '../services/agentFlow.js'
import { setDecisionHandler } from '../services/telegramBot.js'
import { rupeesToUsdc } from '../services/notifier.js'

export const agentRoutes = new Hono()

// Telegram button taps land here.
setDecisionHandler(decideRun)

function view(run: ReturnType<typeof getRun>) {
  if (!run) return null
  return {
    requestId: run.requestId,
    policyId: run.policyId,
    mode: run.mode,
    state: run.state,
    order: run.order,
    item: run.item,
    reason: run.reason,
    decision: run.result.decision,
    violations: run.result.violations,
    checks: run.result.checks,
    priceUsdc: rupeesToUsdc(run.order.price),
    createdAt: run.createdAt,
  }
}

/** Start a shopping run. */
agentRoutes.post('/agent/shop', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    policyId?: string
    mode?: AgentMode
  }

  const policy = body.policyId ? getPolicy(body.policyId) : undefined
  if (!policy) {
    return c.json({ success: false, error: 'Unknown policy.' }, 404)
  }

  const mode: AgentMode = body.mode === 'AUTONOMOUS' ? 'AUTONOMOUS' : 'ASK'

  try {
    const run = await runAgent({ policy, mode })
    console.log(
      `  🤖 Agent run ${run.requestId}: ${run.result.decision} · ${run.state} · ${mode}`,
    )
    return c.json({ success: true, run: view(run) })
  } catch (error) {
    // The AI failed. Nothing is invented and nothing proceeds.
    return c.json(
      {
        success: false,
        error: `The shopping agent could not produce an order: ${(error as Error).message}`,
      },
      502,
    )
  }
})

/** The browser polls this while waiting for a Telegram tap. */
agentRoutes.get('/agent/run/:id', (c) => {
  const run = getRun(c.req.param('id'))
  if (!run) return c.json({ success: false, error: 'Unknown request.' }, 404)
  return c.json({ success: true, run: view(run) })
})

agentRoutes.get('/agent/runs', (c) =>
  c.json({ success: true, runs: listRuns().map(view) }),
)

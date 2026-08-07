// The agent's endpoints.
//
// One to start a shopping run, one for the browser to watch it. The browser
// has to watch, because approval can arrive from Telegram rather than from
// the page the user is looking at.

import { Hono } from 'hono'
import { getPolicy } from '../services/policyService.js'
import {
  decideRun,
  getAgentMode,
  getRun,
  listRuns,
  runAgent,
  type AgentMode,
} from '../services/agentFlow.js'
import {
  setBuyHandler,
  setDecisionHandler,
  setPayHandler,
  setWantHandler,
} from '../services/telegramBot.js'
import { agentBuys } from '../services/agentBuyer.js'
import { isAgentWalletConfigured } from '../services/agentWallet.js'
import { listPolicies } from '../services/policyService.js'
import { sendMessage } from '../services/telegram.js'
import { askWhatToBuy } from '../services/notifier.js'
import { markRunPaid } from '../services/agentFlow.js'
import { rupeesToUsdc } from '../services/notifier.js'

export const agentRoutes = new Hono()

// Telegram button taps land here.
setDecisionHandler(decideRun)

/**
 * /buy — a whole shopping trip from the phone, with no browser open.
 *
 * This is the only path where nothing human happens at all: the agent
 * searches, MandateGuard rules on the pick, and if it passes the agent pays
 * from its own wallet. If it does not pass, the run stops here and the user is
 * told why - approval is never even offered for an order that breaks the rule.
 */
setBuyHandler(async () => {
  if (!isAgentWalletConfigured()) {
    void sendMessage('⚠️ The agent has no wallet of its own yet, so it cannot buy without you.')
    return
  }
  if (!activeRule()) {
    void sendMessage(
      '⚠️ There is no active rule. Approve one on the dashboard first, or send /resume if you froze spending.',
    )
    return
  }

  void askWhatToBuy()
})

/**
 * The newest active rule.
 *
 * Newest rather than first: older rules linger from earlier runs, and a demo
 * that silently obeys a stale one is worse than no demo at all.
 */
function activeRule() {
  return listPolicies()
    .filter((p) => p.status === 'ACTIVE')
    .at(-1)
}

/**
 * The user chose what they want. The agent goes and finds it, and
 * MandateGuard rules on whatever it comes back with.
 *
 * Note that we do NOT steer the agent towards something that will pass. If
 * the rule allows an SSD and the user asks for a laptop, the agent really
 * does fetch a laptop and really does get refused. Hiding that would hide the
 * whole point.
 */
setWantHandler(async (want: string) => {
  const policy = activeRule()
  if (!policy) {
    void sendMessage('⚠️ There is no active rule any more.')
    return
  }

  const label = want === 'laptop' ? 'a gaming laptop' : 'an SSD'
  const mode = getAgentMode()
  void sendMessage(`🔎 Looking for ${label}…`)

  let run
  try {
    run = await runAgent({ policy, mode, want: label })
  } catch (error) {
    void sendMessage(`⚠️ The agent could not choose anything: ${(error as Error).message}`)
    return
  }

  console.log(
    `  🤖 /buy(${want}) [${mode}] → ${run.order.product} ₹${run.order.price} ` +
      `from ${run.order.seller} · ${run.result.decision}`,
  )
  if (run.result.violations.length > 0) {
    console.log(`     refused: ${run.result.violations.join(' ')}`)
  }

  // Blocked runs have already told the user why, and asked nothing.
  // In ASK mode the run is now waiting on a tap, so we stop here too.
  if (run.state !== 'READY_TO_PAY' || !run.item) return

  // AUTONOMOUS: the engine approved it and nobody is being asked. Pay.
  await payForRun(run.requestId)
})

/** Pays for a run the engine approved and the flow released. */
async function payForRun(requestId: string): Promise<void> {
  const run = getRun(requestId)
  if (!run?.item || run.state !== 'READY_TO_PAY') return

  try {
    await agentBuys({ itemId: run.item.id, verificationId: null, mandateId: run.policyId })
    markRunPaid(requestId)
    // The receipt with its transaction link is sent by the shop route.
  } catch (error) {
    void sendMessage(`⚠️ The payment failed: ${(error as Error).message}`)
  }
}

/**
 * The user tapped "Yes, buy it".
 *
 * decideRun() releases the run; only then does the agent pay. A refused run
 * can never reach this point - decideRun rejects it outright.
 */
setPayHandler(payForRun)

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

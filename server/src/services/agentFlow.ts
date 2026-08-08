// The agent's shopping run, start to finish.
//
//   1. the AI searches the catalogue and picks something
//   2. MandateGuard checks that pick against the human's rule
//   3. depending on the mode, the user is asked or simply told
//
// Step 2 always happens, in both modes. "Autonomous" means nobody is asked -
// it does NOT mean nothing is checked. And a Telegram Approve only moves a
// run past step 3; it can never overturn step 2.

import { getSpentToday } from '../data/memoryStore.js'
import { demoCatalog, type CatalogItem } from '../data/demoCatalog.js'
import { buildOrderFromChoice, prepareAiOrder } from './aiOrderAgent.js'
import { verifyMandate } from './mandateVerifier.js'
import { askApproval, notifyAgentPicked, notifyBlocked } from './notifier.js'
import { editButtons, sendMessage } from './telegram.js'
import { startLive, updateLive } from './liveSession.js'
import { rupeesToUsdc } from './notifier.js'
import type { AIOrder, SpendingPolicy, VerificationResult } from '../types/index.js'

export type AgentMode = 'ASK' | 'AUTONOMOUS'

export type RunState =
  /** MandateGuard refused. The run is over. */
  | 'BLOCKED'
  /** Passed the rules, waiting for the user to tap Approve. */
  | 'PENDING_APPROVAL'
  /** Cleared to pay. */
  | 'READY_TO_PAY'
  /** The user said no. */
  | 'REJECTED'
  | 'PAID'

export interface AgentRun {
  requestId: string
  policyId: string
  mode: AgentMode
  state: RunState
  order: AIOrder
  item: CatalogItem | null
  reason: string
  result: VerificationResult
  createdAt: string
  /** The Telegram message carrying the buttons, so we can retire them. */
  messageId?: number
}

const runs = new Map<string, AgentRun>()
let counter = 1000

/**
 * How the agent behaves when it is told to buy something.
 *
 * ASK        - it finds something, then waits for a human to say yes.
 * AUTONOMOUS - it acts alone. Nobody is asked; everything is still checked.
 *
 * Defaults to ASK because surprising someone with a purchase is worse than
 * making them tap once.
 */
let currentMode: AgentMode = 'ASK'

export function getAgentMode(): AgentMode {
  return currentMode
}

export function setAgentMode(mode: AgentMode): void {
  currentMode = mode
}

function nextRequestId(): string {
  counter += 1
  return `RUN-${counter}`
}

export function getRun(id: string): AgentRun | undefined {
  return runs.get(id)
}

export function listRuns(): AgentRun[] {
  return [...runs.values()]
}

/**
 * One shopping run.
 *
 * Note the order of events: the engine decides BEFORE the user is asked
 * anything. We never ask "shall I buy this?" about an order that already
 * breaks the rules - it is simply refused and the user is told why.
 */
export async function runAgent(params: {
  policy: SpendingPolicy
  mode: AgentMode
  /** What the user asked for. Absent means "anything that fits the rule". */
  want?: string
  /** Where the instruction came from, so the shop can say so. */
  source?: 'TELEGRAM' | 'WEB'
  /**
   * A product the user named outright.
   *
   * When someone picks an exact item there is nothing to search for, so the
   * AI step is skipped rather than dressed up. What does NOT change is the
   * checking: a hand-picked item goes through all ten rules exactly like an
   * AI-chosen one, and can be refused just the same.
   */
  itemId?: string
}): Promise<AgentRun> {
  const { policy, mode, want, source = 'WEB', itemId } = params
  const chosen = itemId ? demoCatalog.find((i) => i.id === itemId) : undefined

  // Publish each step so the storefront can show it happening.
  startLive(source, chosen ? chosen.product : (want ?? 'something'))

  // 1. Either the user named a product, or the AI goes and finds one.
  //    Untrusted output either way.
  const prepared = chosen
    ? buildOrderFromChoice(
        { catalogId: chosen.id, quantity: 1, warrantyAdded: false, reason: 'Chosen by the buyer.' },
        demoCatalog,
      )
    : await prepareAiOrder(policy, undefined, undefined, want)

  const item = demoCatalog.find((i) => i.id === prepared.catalogId) ?? null

  updateLive({
    phase: 'SELECTED',
    headline: `Chose ${prepared.order.product} from ${prepared.order.seller}`,
    itemId: item?.id ?? null,
    product: prepared.order.product,
    price: prepared.order.price,
    priceUsdc: rupeesToUsdc(prepared.order.price),
    seller: prepared.order.seller,
    reason: prepared.reason,
  })

  notifyAgentPicked({
    product: prepared.order.product,
    price: prepared.order.price,
    seller: prepared.order.seller,
    reason: prepared.reason,
  })

  // 2. MandateGuard decides. Always. In both modes.
  updateLive({ phase: 'CHECKING', headline: 'MandateGuard is checking it against your rule…' })

  const result = verifyMandate(policy, prepared.order, {
    spentToday: getSpentToday(),
  })

  updateLive({
    decision: result.decision,
    violations: result.violations,
    checksPassed: result.checks.filter((c) => c.passed).length,
    checksTotal: result.checks.length,
  })

  const requestId = nextRequestId()
  const run: AgentRun = {
    requestId,
    policyId: policy.id,
    mode,
    state: result.decision === 'BLOCKED' ? 'BLOCKED' : 'READY_TO_PAY',
    order: prepared.order,
    item,
    reason: prepared.reason,
    result,
    createdAt: new Date().toISOString(),
  }

  if (result.decision === 'BLOCKED') {
    updateLive({
      phase: 'BLOCKED',
      requestId,
      headline: `Refused — ${result.violations.length} rule${result.violations.length === 1 ? '' : 's'} broken. Nothing was paid.`,
    })
    notifyBlocked(prepared.order, policy, result.violations)
    runs.set(requestId, run)
    return run
  }

  // 3. Passed the rules. Ask, or just proceed.
  if (mode === 'ASK') {
    run.state = 'PENDING_APPROVAL'
    updateLive({
      phase: 'AWAITING_APPROVAL',
      requestId,
      headline: 'All ten rules passed. Waiting for the buyer to confirm.',
    })
    const sent = await askApproval(requestId, {
      product: prepared.order.product,
      price: prepared.order.price,
      seller: prepared.order.seller,
    })
    run.messageId = sent.messageId
  } else {
    updateLive({
      phase: 'PAYING',
      requestId,
      headline: 'All ten rules passed. Paying the seller…',
    })
    void sendMessage(
      [
        '🤖 <b>Acting on its own</b>',
        '',
        `Buying <b>${prepared.order.product}</b> for ₹${prepared.order.price.toLocaleString('en-IN')} from ${prepared.order.seller}.`,
        '',
        'You are not being asked, because this fits the rule you already approved.',
        'All ten checks passed. Send /stop to freeze spending.',
      ].join('\n'),
    )
  }

  runs.set(requestId, run)
  return run
}

/**
 * The user tapped Approve or Reject in Telegram.
 *
 * Approve does NOT mean "buy it" - the engine already decided that. It only
 * releases a run that was waiting on a human. A run that was blocked can
 * never be released here.
 */
export async function decideRun(requestId: string, approved: boolean): Promise<string> {
  const run = runs.get(requestId)

  if (!run) return '⚠️ That request is not known any more.'

  if (run.state === 'BLOCKED') {
    return '🛑 That order was refused by MandateGuard. Approving it here changes nothing.'
  }
  if (run.state !== 'PENDING_APPROVAL') {
    return `ℹ️ That request was already handled (${run.state}).`
  }

  // Retire the buttons so the same question cannot be answered twice.
  if (run.messageId) await editButtons(run.messageId, [])

  run.state = approved ? 'READY_TO_PAY' : 'REJECTED'

  updateLive(
    approved
      ? { phase: 'PAYING', headline: 'Confirmed. Paying the seller…' }
      : { phase: 'REJECTED', headline: 'The buyer declined. Nothing was paid.' },
  )

  return approved
    ? `✅ Approved. Paying ${run.order.seller} now…`
    : `✖ Rejected. Nothing was paid.`
}

/** Marks a run as paid once the seller payment settles. */
export function markRunPaid(requestId: string): void {
  const run = runs.get(requestId)
  if (run) run.state = 'PAID'
}

/** The purchase settled. Only real values arrive here. */
export function markLivePaid(details: {
  orderId: string
  transactionId: string | null
  explorerUrl: string | null
}): void {
  updateLive({
    phase: 'PAID',
    headline: 'Paid. The seller has the money.',
    ...details,
  })
}

/** Test helper. */
export function resetRuns(): void {
  runs.clear()
}

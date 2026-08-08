// The command brain.
//
// Everything here either reports state or changes the POLICY. Nothing here
// approves a purchase - /stop and /resume work by flipping a policy between
// ACTIVE and DISABLED, and rule 1 of the engine ("Policy Active") does the
// actual refusing. The kill switch is therefore enforced by the same code
// that enforces every other rule.

import { policies, getSpentToday } from '../data/memoryStore.js'
import { persistPolicy } from '../data/repository.js'
import { listAudit } from './auditService.js'
import { getModelName, isNimConfigured } from './nimClient.js'
import { rupees } from './notifier.js'
import { answerCallback, sendMessage, startPolling, type Incoming } from './telegram.js'
import { describeStorage } from '../data/db.js'
import { describeAgentWallet } from './agentWallet.js'
import { getAgentMode, setAgentMode } from './agentFlow.js'
import { getLiveSession } from './liveSession.js'
import { describeX402, isX402Configured } from '../x402/x402Config.js'

/** Called when the user taps Approve or Reject. Set by the agent routes. */
type DecisionHandler = (requestId: string, approved: boolean) => Promise<string>
let onDecision: DecisionHandler | null = null

export function setDecisionHandler(handler: DecisionHandler): void {
  onDecision = handler
}

/** Shows the shopping menu. Set by the agent routes. */
type BuyHandler = (what: string) => Promise<void>
let onBuy: BuyHandler | null = null

export function setBuyHandler(handler: BuyHandler): void {
  onBuy = handler
}

/** The user picked what they want from the menu. */
type WantHandler = (want: string) => Promise<void>
let onWant: WantHandler | null = null

export function setWantHandler(handler: WantHandler): void {
  onWant = handler
}

/** The user tapped one exact product from the shop's catalogue. */
type PickHandler = (itemId: string) => Promise<void>
let onPick: PickHandler | null = null

export function setPickHandler(handler: PickHandler): void {
  onPick = handler
}

/** The user confirmed the purchase, so the agent pays. */
type PayHandler = (requestId: string) => Promise<void>
let onPay: PayHandler | null = null

export function setPayHandler(handler: PayHandler): void {
  onPay = handler
}

const HELP = [
  '🛡 <b>MandateGuard</b>',
  '',
  '/shop    — what the shop is doing right now',
  '/buy     — send the agent shopping now',
  '/auto    — let the agent buy without asking',
  '/ask     — make it ask me first (default)',
  '/wallet  — the agent’s own balance',
  '/status  — is everything running',
  '/spend   — how much has been spent today',
  '/orders  — the last few decisions',
  '/stop    — freeze all AI spending now',
  '/resume  — allow spending again',
  '/help    — this list',
].join('\n')

function spendSummary(): string {
  const active = [...policies.values()].filter((p) => p.status === 'ACTIVE')
  const limit = active[0]?.dailyLimit ?? 0
  const used = getSpentToday()
  const left = Math.max(0, limit - used)
  const pct = limit > 0 ? Math.round((used / limit) * 100) : 0
  const filled = Math.min(10, Math.round(pct / 10))

  return [
    '💰 <b>Spending today</b>',
    '',
    `Daily limit  ${rupees(limit)}`,
    `Used         ${rupees(used)}`,
    `Remaining    <b>${rupees(left)}</b>`,
    '',
    `<code>${'█'.repeat(filled)}${'░'.repeat(10 - filled)}</code> ${pct}%`,
  ].join('\n')
}

/** How much MandateGuard refused. Worded as attempts, because that is what
    it is - no money was ever at risk of leaving. */
function blockedSummary(): string {
  const blocked = listAudit().filter((e) => e.decision === 'BLOCKED')
  const total = blocked.reduce((sum, e) => sum + e.amount, 0)
  if (blocked.length === 0) return ''
  return `\n\n🛡 Refused <b>${blocked.length}</b> unsafe order${blocked.length === 1 ? '' : 's'} worth ${rupees(total)}.`
}

function statusSummary(): string {
  const active = [...policies.values()].filter((p) => p.status === 'ACTIVE').length
  const disabled = [...policies.values()].filter((p) => p.status === 'DISABLED').length
  const x402 = describeX402()

  return [
    '📊 <b>System status</b>',
    '',
    `Engine    ✅ 10 rules, deterministic`,
    `AI        ${isNimConfigured() ? `✅ ${getModelName()}` : '⚠ not configured'}`,
    `Payments  ${isX402Configured() ? `✅ x402 · ${x402.price} · ${x402.network}` : '⚠ off'}`,
    `Storage   ${describeStorage().state === 'MYSQL' ? '✅ MySQL' : '⚠ memory only'}`,
    '',
    `Mode      ${getAgentMode() === 'AUTONOMOUS' ? '🤖 autonomous — buys without asking' : '🙋 asks me first'}`,
    '',
    `Rules active   ${active}`,
    disabled > 0 ? `Rules frozen   ${disabled}  ⛔` : '',
    blockedSummary(),
  ]
    .filter(Boolean)
    .join('\n')
}

function recentOrders(): string {
  const recent = listAudit().slice(-5).reverse()
  if (recent.length === 0) return 'No orders yet.'

  return [
    '📒 <b>Recent decisions</b>',
    '',
    ...recent.map(
      (e) =>
        `${e.decision === 'APPROVED' ? '✅' : '🛑'} ${e.product} · ${rupees(e.amount)} · ${e.seller}\n` +
        `<code>${e.verificationId}</code>`,
    ),
  ].join('\n\n')
}

/** Freezes or unfreezes every policy. Returns how many changed. */
function setAllPolicies(status: 'ACTIVE' | 'DISABLED'): number {
  const from = status === 'DISABLED' ? 'ACTIVE' : 'DISABLED'
  let changed = 0

  for (const policy of policies.values()) {
    if (policy.status === from) {
      policy.status = status
      persistPolicy(policy)
      changed++
    }
  }
  return changed
}

/** A newline, written this way so no edit tool can mangle it. */
const NL = String.fromCharCode(10)

async function handle(msg: Incoming): Promise<void> {
  // A tapped button.
  if (msg.callback) {
    const [action, value] = msg.callback.split(':')
    if (msg.callbackId) await answerCallback(msg.callbackId, 'Got it')

    // "I want an SSD" - the agent goes and searches.
    if (action === 'want') {
      if (onWant) await onWant(value)
      return
    }

    // One exact product tapped from the catalogue.
    if (action === 'pick') {
      if (onPick) await onPick(value)
      return
    }

    // Yes / No on a specific order.
    if (!onDecision) return
    const approved = action === 'ok'
    const reply = await onDecision(value, approved)
    if (reply) void sendMessage(reply)

    // Releasing a run is not the same as paying for it. Pay only after the
    // engine-approved run has actually been released.
    if (approved && onPay) await onPay(value)
    return
  }

  switch (msg.command) {
    case '/start':
    case '/help':
      void sendMessage(HELP)
      return

    case '/status':
      void sendMessage(statusSummary())
      return

    case '/auto':
      setAgentMode('AUTONOMOUS')
      console.log('  ⚙ Agent mode → AUTONOMOUS')
      void sendMessage(
        [
          '🤖 <b>Autonomous mode</b>',
          '',
          'The agent will now buy without asking me anything.',
          '',
          'It is still checked every single time — MandateGuard runs all ten',
          'rules and refuses anything outside them. Nobody being asked is not',
          'the same as nothing being checked.',
          '',
          'Send /ask to make it ask again, or /stop to freeze spending.',
        ].join(NL),
      )
      return

    case '/ask':
      setAgentMode('ASK')
      console.log('  ⚙ Agent mode → ASK')
      void sendMessage(
        '🙋 <b>Ask-first mode</b>' + NL + NL + 'The agent will ask me before it buys anything.',
      )
      return

    case '/shop': {
      const live = getLiveSession()

      if (live.phase === 'IDLE') {
        void sendMessage(
          [
            '🏬 <b>NovaMart</b>',
            '',
            'Nothing happening right now.',
            '',
            'Send /buy and watch the shop react.',
          ].join(NL),
        )
        return
      }

      void sendMessage(
        [
          '🏬 <b>NovaMart — right now</b>',
          '',
          live.headline,
          '',
          live.product ? `Item    ${live.product}` : '',
          live.price != null ? `Price   ₹${live.price.toLocaleString('en-IN')} → ${live.priceUsdc} USDC` : '',
          live.seller ? `Seller  ${live.seller}` : '',
          live.checksTotal > 0 ? `Rules   ${live.checksPassed}/${live.checksTotal} passed` : '',
          live.violations.length > 0
            ? NL + '<b>Refused because:</b>' + NL + live.violations.map((v, i) => `${i + 1}. ${v}`).join(NL)
            : '',
          live.orderId ? NL + `Order   <code>${live.orderId}</code>` : '',
          live.explorerUrl ? `<a href="${live.explorerUrl}">View payment on Algorand</a>` : '',
        ]
          .filter(Boolean)
          .join(NL),
      )
      return
    }

    case '/wallet': {
      const w = await describeAgentWallet()
      void sendMessage(
        [
          '👛 <b>The agent’s wallet</b>',
          '',
          w.address ? `<code>${w.address}</code>` : 'not configured',
          '',
          w.balance
            ? `ALGO  ${w.balance.algo.toFixed(3)}${NL}USDC  ${w.balance.optedIn ? w.balance.usdc?.toFixed(3) : 'not opted in'}`
            : '',
          '',
          w.ready ? '✅ The agent can buy on its own.' : `⚠️ ${w.note}`,
          '',
          '<i>This is the agent’s money, not yours. MandateGuard decides what it may spend it on.</i>',
        ]
          .filter(Boolean)
          .join(String.fromCharCode(10)),
      )
      return
    }

    case '/buy': {
      if (!onBuy) return
      // Everything after the command word is what the user asked for.
      const what = (msg.text ?? '').replace(/^\/buy(@\S+)?\s*/i, '').trim()
      await onBuy(what)
      return
    }

    case '/spend':
      void sendMessage(spendSummary())
      return

    case '/orders':
      void sendMessage(recentOrders())
      return

    case '/stop': {
      const n = setAllPolicies('DISABLED')
      console.log(`  ⛔ Telegram /stop — ${n} policy(ies) frozen`)
      void sendMessage(
        [
          '⛔ <b>Spending frozen</b>',
          '',
          `${n} rule${n === 1 ? '' : 's'} disabled.`,
          'Every new order will now be refused by rule 1 (Policy Active).',
          '',
          'Send /resume to allow spending again.',
        ].join('\n'),
      )
      return
    }

    case '/resume': {
      const n = setAllPolicies('ACTIVE')
      console.log(`  ▶ Telegram /resume — ${n} policy(ies) reactivated`)
      void sendMessage(
        `▶️ <b>Spending allowed again</b>\n\n${n} rule${n === 1 ? '' : 's'} reactivated.`,
      )
      return
    }
  }

  if (msg.text && !msg.command) {
    void sendMessage('I did not understand that. Send /help for the list.')
  }
}

export function startTelegramBot(): void {
  startPolling(handle)
}

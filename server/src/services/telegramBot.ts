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
import { describeX402, isX402Configured } from '../x402/x402Config.js'

/** Called when the user taps Approve or Reject. Set by the agent routes. */
type DecisionHandler = (requestId: string, approved: boolean) => Promise<string>
let onDecision: DecisionHandler | null = null

export function setDecisionHandler(handler: DecisionHandler): void {
  onDecision = handler
}

const HELP = [
  '🛡 <b>MandateGuard</b>',
  '',
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

async function handle(msg: Incoming): Promise<void> {
  // A tapped Approve/Reject button.
  if (msg.callback) {
    const [action, requestId] = msg.callback.split(':')
    if (msg.callbackId) await answerCallback(msg.callbackId, 'Got it')

    if (!onDecision) return
    const reply = await onDecision(requestId, action === 'ok')
    if (reply) void sendMessage(reply)
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

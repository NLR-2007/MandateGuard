// What the user is told, and how it is worded.
//
// Every message here reports something that already happened. Nothing in this
// file decides anything, and no message is ever sent for an event that did not
// occur - if there is no transaction id, the message says so rather than
// inventing one.

import { explorerTxUrl } from '../x402/x402Config.js'
import { sendMessage, type InlineButton } from './telegram.js'
import type { AIOrder, SpendingPolicy } from '../types/index.js'

/**
 * Demo money.
 *
 * Policies and prices are written in rupees because that is how a person
 * thinks about a budget. Test USDC is what actually moves. This fixed rate
 * converts between them and is shown to the user every time, so nobody is
 * left thinking ₹4,800 of real money changed hands.
 */
export const RUPEES_PER_USDC = 10_000
export const DEMO_RATE_NOTE = '₹1,000 = 0.10 test USDC (demo rate)'

/** ₹4,800 -> 0.48. Rounded to 6 decimals, the smallest unit USDC has. */
export function rupeesToUsdc(rupees: number): number {
  return Math.round((rupees / RUPEES_PER_USDC) * 1e6) / 1e6
}

export function rupees(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`
}

function usdcLine(amountRupees: number): string {
  return `${rupees(amountRupees)} → <b>${rupeesToUsdc(amountRupees)} test USDC</b>`
}

/**
 * The shopping menu: everything the shop sells.
 *
 * Real products with real prices, not two canned choices. Some of them the
 * user's rule allows and some it does not, and the buttons do not say which -
 * finding that out is MandateGuard's job, and hinting at it would give the
 * game away.
 */
export function askWhatToBuy(
  items: { id: string; product: string; price: number; seller: string; inStock: boolean }[],
): Promise<{ ok: boolean; messageId?: number }> {
  const buttons: InlineButton[][] = items
    .filter((i) => i.inStock)
    .map((i) => [
      {
        text: `${i.product} · ${rupees(i.price)} · ${i.seller}`,
        callback_data: `pick:${i.id}`,
      },
    ])

  // A shortcut for the demo: let the agent go and choose for itself.
  buttons.unshift([
    { text: '🤖 Let the agent choose', callback_data: 'want:ssd' },
  ])

  return sendMessage(
    [
      '🏬 <b>NovaMart</b>',
      '',
      'Pick something, or let the agent find one for you.',
      '',
      'Whatever is chosen, MandateGuard checks it against your rule before',
      'a single rupee moves.',
    ].join(String.fromCharCode(10)),
    buttons,
  )
}

/** The agent has chosen something and is about to be checked. */
export function notifyAgentPicked(item: {
  product: string
  price: number
  seller: string
  reason: string
}): void {
  void sendMessage(
    [
      '🔎 <b>Agent found a product</b>',
      '',
      `<b>${item.product}</b>`,
      `Price   ${rupees(item.price)}`,
      `Seller  ${item.seller}`,
      '',
      `<i>${item.reason}</i>`,
      '',
      'Checking it against your rules…',
    ].join('\n'),
  )
}

/** Asks the user before going further. Buttons carry the request id, so an
    old message can never approve a new order. */
export function askApproval(
  requestId: string,
  item: { product: string; price: number; seller: string },
): Promise<{ ok: boolean; messageId?: number }> {
  const buttons: InlineButton[][] = [
    [
      { text: '✅ Yes, buy it', callback_data: `ok:${requestId}` },
      { text: '⏸ No, wait', callback_data: `no:${requestId}` },
    ],
  ]

  return sendMessage(
    [
      '🛒 <b>Should I buy this?</b>',
      '',
      `<b>${item.product}</b>`,
      `Price   ${usdcLine(item.price)}`,
      `Seller  ${item.seller}`,
      '',
      '✅ <b>MandateGuard checked it — all 10 rules passed.</b>',
      'I will pay from my own wallet. Nothing has been paid yet.',
      '',
      `<code>${requestId}</code>`,
    ].join('\n'),
    buttons,
  )
}

/** The engine refused. This is the message that matters most. */
export function notifyBlocked(
  order: AIOrder,
  policy: SpendingPolicy,
  violations: string[],
): void {
  void sendMessage(
    [
      '🛑 <b>Stopped an order</b>',
      '',
      `Your agent tried to buy <b>${order.product}</b> for ${rupees(order.price)} from <b>${order.seller}</b>.`,
      '',
      `<b>Refused for ${violations.length} reason${violations.length === 1 ? '' : 's'}:</b>`,
      ...violations.map((v, i) => `${i + 1}. ${v}`),
      '',
      `Your rule: ${policy.quantity} × ${policy.product} up to ${rupees(policy.maxPrice)} from ${policy.approvedSeller}.`,
      '',
      '<b>Nothing was paid.</b>',
    ].join('\n'),
  )
}

/** Approved, and about to be paid for. */
export function notifyApproved(order: AIOrder): void {
  void sendMessage(
    [
      '✅ <b>Approved by MandateGuard</b>',
      '',
      `<b>${order.product}</b> from ${order.seller}`,
      `Amount  ${usdcLine(order.price)}`,
      '',
      'All ten rules passed. Paying the seller now…',
    ].join('\n'),
  )
}

/** Money actually moved. Links are real or absent - never invented. */
export function notifyPaid(params: {
  order: AIOrder
  orderId: string
  txId: string | null
  seller: string
  sellerWallet: string
}): void {
  const { order, orderId, txId, seller, sellerWallet } = params

  void sendMessage(
    [
      '💸 <b>Payment complete</b>',
      '',
      `<b>${order.product}</b>`,
      `Paid    ${usdcLine(order.price)}`,
      `Seller  ${seller}`,
      `Wallet  <code>${sellerWallet.slice(0, 8)}…${sellerWallet.slice(-6)}</code>`,
      `Order   <code>${orderId}</code>`,
      '',
      txId
        ? `⛓ <a href="${explorerTxUrl(txId)}">View payment on Algorand</a>\n<code>${txId}</code>`
        : '⛓ No transaction id was returned, so none is shown.',
      '',
      `<i>${DEMO_RATE_NOTE}</i>`,
    ].join('\n'),
  )
}

/** The rule itself was written to the chain. */
export function notifyAnchored(policyId: string, txId: string): void {
  void sendMessage(
    [
      '⛓ <b>Your rule is now on Algorand</b>',
      '',
      `Policy <code>${policyId}</code> has been fingerprinted onto the public ledger.`,
      'If anyone changes the rule from now on, the chain stops agreeing.',
      '',
      `<a href="${explorerTxUrl(txId)}">View proof on Algorand</a>`,
    ].join('\n'),
  )
}

/** A new rule was approved by the human. */
export function notifyPolicyCreated(policy: SpendingPolicy): void {
  void sendMessage(
    [
      '📋 <b>New rule approved</b>',
      '',
      `<code>${policy.id}</code>`,
      `Buy      ${policy.quantity} × ${policy.product}`,
      `Up to    ${rupees(policy.maxPrice)}`,
      `Seller   ${policy.approvedSeller}`,
      `Warranty ${policy.warrantyAllowed ? 'allowed' : 'not allowed'}`,
      `Per txn  ${rupees(policy.perTransactionLimit)}`,
      `Daily    ${rupees(policy.dailyLimit)}`,
      '',
      'Your agent may now act on its own inside this rule.',
      'Send /stop at any time to freeze all spending.',
    ].join('\n'),
  )
}

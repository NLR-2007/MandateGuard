// ════════════════════════════════════════════════════════════
// THE CORE OF MANDATEGUARD
//
// This file decides APPROVED or BLOCKED.
//
// It is plain, deterministic TypeScript: the same policy and the
// same order always produce the same answer. No AI, no model, no
// network call, no randomness is involved in the decision.
// ════════════════════════════════════════════════════════════

import type {
  AIOrder,
  SpendingPolicy,
  VerificationCheck,
  VerificationResult,
} from '../types/index.js'

/** Text is compared after trimming spaces and lowercasing. */
function normalize(text: string): string {
  return text.trim().toLowerCase()
}

export interface VerifyOptions {
  /** Money already marked as executed today. Defaults to 0. */
  spentToday?: number
  /** Lets tests pin the clock. Defaults to the real time. */
  now?: Date
  /** Supplied by the caller so the audit log and the result agree. */
  verificationId?: string
}

/**
 * Compares the human-approved policy against the AI's final order.
 *
 * Every rule is checked (we never stop at the first failure), so the
 * user always sees the complete list of what went wrong.
 */
export function verifyMandate(
  policy: SpendingPolicy,
  order: AIOrder,
  options: VerifyOptions = {},
): VerificationResult {
  const now = options.now ?? new Date()
  const spentToday = options.spentToday ?? 0
  const checks: VerificationCheck[] = []

  // ── CHECK 1 - policy is active ────────────────────────────
  checks.push({
    rule: 'Policy Active',
    passed: policy.status === 'ACTIVE',
    expected: 'ACTIVE',
    actual: policy.status,
    message:
      policy.status === 'ACTIVE'
        ? 'Policy is active.'
        : 'Policy is not active.',
  })

  // ── CHECK 2 - policy has not expired ──────────────────────
  const expiryTime = new Date(policy.expiresAt).getTime()
  const expiryIsValid = Number.isFinite(expiryTime)
  const notExpired = expiryIsValid && now.getTime() < expiryTime
  checks.push({
    rule: 'Policy Not Expired',
    passed: notExpired,
    expected: policy.expiresAt,
    actual: now.toISOString(),
    message: notExpired
      ? 'Policy is still valid.'
      : 'Human spending policy has expired.',
  })

  // ── CHECK 3 - product ─────────────────────────────────────
  const productMatches = normalize(policy.product) === normalize(order.product)
  checks.push({
    rule: 'Product',
    passed: productMatches,
    expected: policy.product,
    actual: order.product,
    message: productMatches
      ? 'Product matches the approved policy.'
      : 'Product does not match the approved policy.',
  })

  // ── CHECK 4 - quantity ────────────────────────────────────
  const quantityMatches = order.quantity === policy.quantity
  checks.push({
    rule: 'Quantity',
    passed: quantityMatches,
    expected: policy.quantity,
    actual: order.quantity,
    message: quantityMatches
      ? 'Quantity matches the approved policy.'
      : `Quantity changed from ${policy.quantity} to ${order.quantity}.`,
  })

  // ── CHECK 5 - maximum price ───────────────────────────────
  const withinMaxPrice = order.price <= policy.maxPrice
  checks.push({
    rule: 'Maximum Price',
    passed: withinMaxPrice,
    expected: policy.maxPrice,
    actual: order.price,
    message: withinMaxPrice
      ? 'Order price is within the approved maximum price.'
      : 'Order price exceeds the approved maximum price.',
  })

  // ── CHECK 6 - per transaction limit ───────────────────────
  const withinPerTransaction = order.price <= policy.perTransactionLimit
  checks.push({
    rule: 'Per Transaction Limit',
    passed: withinPerTransaction,
    expected: policy.perTransactionLimit,
    actual: order.price,
    message: withinPerTransaction
      ? 'Order is within the per-transaction limit.'
      : 'Per-transaction spending limit exceeded.',
  })

  // ── CHECK 7 - approved seller ─────────────────────────────
  const sellerMatches =
    normalize(policy.approvedSeller) === normalize(order.seller)
  checks.push({
    rule: 'Approved Seller',
    passed: sellerMatches,
    expected: policy.approvedSeller,
    actual: order.seller,
    message: sellerMatches
      ? 'Seller is approved.'
      : 'Seller is not approved.',
  })

  // ── CHECK 8 - warranty / extra add-on ─────────────────────
  const warrantyAllowedHere = policy.warrantyAllowed || !order.warrantyAdded
  checks.push({
    rule: 'Warranty Policy',
    passed: warrantyAllowedHere,
    expected: policy.warrantyAllowed,
    actual: order.warrantyAdded,
    message: warrantyAllowedHere
      ? 'No unapproved add-on was included.'
      : 'Warranty was added without human approval.',
  })

  // ── CHECK 9 - receiver wallet (exact match) ───────────────
  const receiverMatches =
    policy.approvedReceiverWallet === order.receiverWallet
  checks.push({
    rule: 'Receiver Wallet',
    passed: receiverMatches,
    expected: policy.approvedReceiverWallet,
    actual: order.receiverWallet,
    message: receiverMatches
      ? 'Payment receiver matches the approved wallet.'
      : 'Payment receiver wallet does not match the approved wallet.',
  })

  // ── CHECK 10 - daily spending limit ───────────────────────
  const projected = spentToday + order.price
  const withinDailyLimit = projected <= policy.dailyLimit
  checks.push({
    rule: 'Daily Limit',
    passed: withinDailyLimit,
    expected: policy.dailyLimit,
    actual: projected,
    message: withinDailyLimit
      ? 'Order stays within the daily spending limit.'
      : 'Daily spending limit would be exceeded.',
  })

  // ── FINAL DECISION ────────────────────────────────────────
  // Every check is mandatory. One failure blocks the order.
  const violations = checks.filter((c) => !c.passed).map((c) => c.message)

  return {
    verificationId: options.verificationId ?? 'VER-PREVIEW',
    policyId: policy.id,
    orderId: order.orderId,
    decision: violations.length === 0 ? 'APPROVED' : 'BLOCKED',
    checks,
    violations,
    checkedAt: now.toISOString(),
  }
}

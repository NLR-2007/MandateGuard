// MandateGuard - demo data for the UI.
//
// These are the sample policies and AI orders used in the demo pages.
// The APPROVED / BLOCKED decision is NOT made here - the backend does that.

import type {
  AIOrder,
  AttackScenario,
  DemoMode,
  PolicySource,
  ScenarioDemo,
  SpendingPolicy,
} from '../types'

/** Fallback policy used when the user has not created one yet. */
export const demoPolicy: SpendingPolicy = {
  id: 'MG-DEMO',
  product: '1TB SSD',
  quantity: 1,
  maxPrice: 5000,
  approvedSeller: 'SecureStore',
  warrantyAllowed: false,
  approvedReceiverWallet: 'ALGO-SECURE-STORE',
  perTransactionLimit: 5000,
  dailyLimit: 10000,
  expiresAt: '2030-12-31T23:59',
  status: 'ACTIVE',
}

/** Values used to create a policy on the backend when none exists yet. */
export const defaultPolicyInput = {
  product: demoPolicy.product,
  quantity: demoPolicy.quantity,
  maxPrice: demoPolicy.maxPrice,
  approvedSeller: demoPolicy.approvedSeller,
  warrantyAllowed: demoPolicy.warrantyAllowed,
  approvedReceiverWallet: demoPolicy.approvedReceiverWallet,
  perTransactionLimit: demoPolicy.perTransactionLimit,
  dailyLimit: demoPolicy.dailyLimit,
  expiresAt: demoPolicy.expiresAt,
}

/** DEMO A - the AI stayed inside the rules. */
export const safeOrder: AIOrder = {
  orderId: 'ORDER-SAFE',
  product: '1TB SSD',
  quantity: 1,
  price: 4800,
  seller: 'SecureStore',
  warrantyAdded: false,
  receiverWallet: 'ALGO-SECURE-STORE',
}

/** DEMO B - the AI changed the deal on its own. */
export const unsafeOrder: AIOrder = {
  orderId: 'ORDER-UNSAFE',
  product: '1TB SSD',
  quantity: 2,
  price: 4900,
  seller: 'OtherStore',
  warrantyAdded: true,
  receiverWallet: 'ALGO-UNKNOWN-WALLET',
}

// ────────────────────────────────────────────────────────────
// PHASE 3 - "Without MandateGuard" problem demo
//
// Every order below stays UNDER the ₹5,000 limit on purpose.
// The violation lists are written by hand - the Phase 3 page
// deliberately does not verify anything itself.
// ────────────────────────────────────────────────────────────

/** The rules the human approved for the problem demo. */
export const humanPolicy: SpendingPolicy = {
  id: 'MG-2001',
  product: '1TB SSD',
  quantity: 1,
  maxPrice: 5000,
  approvedSeller: 'SecureStore',
  warrantyAllowed: false,
  approvedReceiverWallet: 'ALGO-SECURE-STORE',
  perTransactionLimit: 5000,
  dailyLimit: 10000,
  expiresAt: '2030-12-31T23:59',
  status: 'ACTIVE',
}

export const correctOrder: AIOrder = {
  orderId: 'ORDER-CORRECT',
  product: '1TB SSD',
  quantity: 1,
  price: 4800,
  seller: 'SecureStore',
  warrantyAdded: false,
  receiverWallet: 'ALGO-SECURE-STORE',
}

export const quantityAttackOrder: AIOrder = {
  orderId: 'ORDER-QTY',
  product: '1TB SSD',
  quantity: 2,
  price: 4900,
  seller: 'SecureStore',
  warrantyAdded: false,
  receiverWallet: 'ALGO-SECURE-STORE',
}

export const sellerAttackOrder: AIOrder = {
  orderId: 'ORDER-SELLER',
  product: '1TB SSD',
  quantity: 1,
  price: 4700,
  seller: 'OtherStore',
  warrantyAdded: false,
  receiverWallet: 'ALGO-SECURE-STORE',
}

export const warrantyAttackOrder: AIOrder = {
  orderId: 'ORDER-WARRANTY',
  product: '1TB SSD',
  quantity: 1,
  price: 4950,
  seller: 'SecureStore',
  warrantyAdded: true,
  receiverWallet: 'ALGO-SECURE-STORE',
}

export const receiverAttackOrder: AIOrder = {
  orderId: 'ORDER-RECEIVER',
  product: '1TB SSD',
  quantity: 1,
  price: 4800,
  seller: 'SecureStore',
  warrantyAdded: false,
  receiverWallet: 'ALGO-UNKNOWN-WALLET',
}

export const combinedAttackOrder: AIOrder = {
  orderId: 'ORDER-COMBINED',
  product: '1TB SSD',
  quantity: 2,
  price: 4900,
  seller: 'OtherStore',
  warrantyAdded: true,
  receiverWallet: 'ALGO-UNKNOWN-WALLET',
}

const quantityViolation = {
  title: 'Quantity Changed',
  humanApproved: '1',
  aiSelected: '2',
}

const sellerViolation = {
  title: 'Seller Changed',
  humanApproved: 'SecureStore',
  aiSelected: 'OtherStore',
}

const warrantyViolation = {
  title: 'Extra Warranty Added',
  humanApproved: 'No warranty',
  aiSelected: 'Warranty added',
}

const receiverViolation = {
  title: 'Receiver Changed',
  humanApproved: 'ALGO-SECURE-STORE',
  aiSelected: 'ALGO-UNKNOWN-WALLET',
}

/** The six buttons on the problem demo page. */
export const scenarios: Record<AttackScenario, ScenarioDemo> = {
  safe: {
    id: 'safe',
    label: 'Correct Order',
    order: correctOrder,
    changed: {},
    note: 'No visible problem. This order matches what the human approved.',
    violations: [],
  },
  quantity: {
    id: 'quantity',
    label: 'Quantity Attack',
    order: quantityAttackOrder,
    changed: { quantity: true },
    note: 'Amount is valid, but quantity changed.',
    violations: [quantityViolation],
  },
  seller: {
    id: 'seller',
    label: 'Seller Attack',
    order: sellerAttackOrder,
    changed: { seller: true },
    note: 'Amount is valid, but seller changed.',
    violations: [sellerViolation],
  },
  warranty: {
    id: 'warranty',
    label: 'Warranty Attack',
    order: warrantyAttackOrder,
    changed: { warranty: true },
    note: 'An unwanted add-on was included.',
    violations: [warrantyViolation],
  },
  receiver: {
    id: 'receiver',
    label: 'Receiver Attack',
    order: receiverAttackOrder,
    changed: { receiver: true },
    note: 'Payment destination changed.',
    violations: [receiverViolation],
  },
  combined: {
    id: 'combined',
    label: 'Combined Attack',
    order: combinedAttackOrder,
    changed: { quantity: true, seller: true, warranty: true, receiver: true },
    note: 'PAYMENT WOULD PROCEED WITHOUT FULL POLICY VERIFICATION',
    violations: [
      quantityViolation,
      sellerViolation,
      warrantyViolation,
      receiverViolation,
    ],
  },
}

/** Button order on the page. */
export const scenarioOrder: AttackScenario[] = [
  'safe',
  'quantity',
  'seller',
  'warranty',
  'receiver',
  'combined',
]

// ────────────────────────────────────────────────────────────
// Small localStorage helpers so pages can share demo state
// ────────────────────────────────────────────────────────────

const POLICY_KEY = 'mg_policy'
const DEMO_KEY = 'mg_demo_mode'
const RESULT_KEY = 'mg_last_verification'
const SOURCE_KEY = 'mg_policy_source'

export function savePolicy(policy: SpendingPolicy): void {
  localStorage.setItem(POLICY_KEY, JSON.stringify(policy))
}

export function loadPolicy(): SpendingPolicy | null {
  const raw = localStorage.getItem(POLICY_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SpendingPolicy
  } catch {
    return null
  }
}

export function clearPolicy(): void {
  localStorage.removeItem(POLICY_KEY)
}

/** Remembers whether the stored policy was typed by hand or drafted by the AI. */
export function savePolicySource(source: PolicySource): void {
  localStorage.setItem(SOURCE_KEY, source)
}

export function loadPolicySource(): PolicySource {
  return localStorage.getItem(SOURCE_KEY) === 'NVIDIA_NIM_ASSISTED'
    ? 'NVIDIA_NIM_ASSISTED'
    : 'MANUAL'
}

export function saveDemoMode(mode: DemoMode): void {
  localStorage.setItem(DEMO_KEY, mode)
}

export function loadDemoMode(): DemoMode {
  return localStorage.getItem(DEMO_KEY) === 'unsafe' ? 'unsafe' : 'safe'
}

/** The last answer from the backend, so /verify can display it. */
export function saveVerification(result: unknown): void {
  localStorage.setItem(RESULT_KEY, JSON.stringify(result))
}

export function loadVerification<T>(): T | null {
  const raw = localStorage.getItem(RESULT_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

// Everything NovaMart knows about MandateGuard.
//
// This is the entire integration surface. The shop holds no policy logic, no
// rules and no wallet keys - it lists products, and before money moves it asks
// one endpoint whether this purchase is allowed. Swapping MandateGuard out
// would mean deleting this file and nothing else.

const GUARD = import.meta.env.VITE_GUARD_API ?? 'http://localhost:4021'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${GUARD}${path}`)
  if (!res.ok) throw new Error(`NovaMart could not reach the checkout guard (${res.status}).`)
  return res.json() as Promise<T>
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${GUARD}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => null)) as T & { error?: string }
  if (!res.ok) throw new Error(data?.error ?? `Checkout failed (${res.status}).`)
  return data
}

// ── Catalogue ─────────────────────────────────────────────

export interface Product {
  id: string
  product: string
  price: number
  priceUsdc: number
  seller: string
  warrantyAvailable: boolean
  receiverWallet: string
  category: 'storage' | 'books' | 'laptops' | 'accessories'
  rating: number
  inStock: boolean
}

export async function getProducts(): Promise<{ products: Product[]; demoRate: string }> {
  return get('/api/shop/products')
}

// ── The live agent session ────────────────────────────────

export type LivePhase =
  | 'IDLE'
  | 'BROWSING'
  | 'SELECTED'
  | 'CHECKING'
  | 'BLOCKED'
  | 'AWAITING_APPROVAL'
  | 'REJECTED'
  | 'PAYING'
  | 'PAID'

export interface LiveSession {
  phase: LivePhase
  headline: string
  requestId: string | null
  itemId: string | null
  product: string | null
  price: number | null
  priceUsdc: number | null
  seller: string | null
  reason: string | null
  decision: 'APPROVED' | 'BLOCKED' | null
  violations: string[]
  checksPassed: number
  checksTotal: number
  orderId: string | null
  transactionId: string | null
  explorerUrl: string | null
  source: 'TELEGRAM' | 'WEB' | null
  updatedAt: string
}

export async function getLive(): Promise<LiveSession> {
  const data = await get<{ live: LiveSession }>('/api/agent/live')
  return data.live
}

// ── The checkout guard ────────────────────────────────────
//
// The whole point of the product, in one call.

export interface Policy {
  id: string
  product: string
  quantity: number
  maxPrice: number
  approvedSeller: string
  warrantyAllowed: boolean
  approvedReceiverWallet: string
  perTransactionLimit: number
  dailyLimit: number
  expiresAt: string
  status: string
}

export async function getPolicies(): Promise<Policy[]> {
  const data = await get<{ policies: Policy[] }>('/api/policies')
  return data.policies
}

export interface GuardVerdict {
  verificationId: string
  decision: 'APPROVED' | 'BLOCKED'
  violations: string[]
  checks: { rule: string; passed: boolean; message: string }[]
}

/**
 * Ask the guard whether this basket may be bought.
 *
 * A shop calls this the way it would call a payment processor: describe the
 * order, get a yes or no. The shop does not decide, and cannot overrule it.
 */
export async function askGuard(policyId: string, product: Product): Promise<GuardVerdict> {
  return post<GuardVerdict>('/api/verify-mandate', {
    policyId,
    order: {
      orderId: `NM-${Date.now().toString(36).toUpperCase()}`,
      product: product.product,
      quantity: 1,
      price: product.price,
      seller: product.seller,
      warrantyAdded: false,
      receiverWallet: product.receiverWallet,
    },
  })
}

/** Sends the shop's own AI assistant looking for something. */
export async function sendAgent(policyId: string, want: string, mode: 'ASK' | 'AUTONOMOUS') {
  return post<{ run: unknown }>('/api/agent/shop', { policyId, want, mode })
}

export function rupees(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`
}

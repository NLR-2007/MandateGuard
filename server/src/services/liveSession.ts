// What the agent is doing, right now, in one small object.
//
// The storefront is a separate website that knows nothing about our internals.
// It polls this and renders it. That keeps the integration honest: a real shop
// would only ever see what we choose to publish here, and nothing in this file
// influences a decision - it only describes one that is being made elsewhere.

export type LivePhase =
  | 'IDLE'
  /** The agent is looking through the catalogue. */
  | 'BROWSING'
  /** It has chosen something; nothing has been checked yet. */
  | 'SELECTED'
  /** MandateGuard is evaluating the choice. */
  | 'CHECKING'
  /** Refused. The run is over. */
  | 'BLOCKED'
  /** Passed the rules, waiting for a human to say yes. */
  | 'AWAITING_APPROVAL'
  /** The human said no. */
  | 'REJECTED'
  /** Paying the seller. */
  | 'PAYING'
  | 'PAID'

export interface LiveSession {
  phase: LivePhase
  /** Plain-English line for a person watching from across a room. */
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
  /** Where the instruction came from, so the shop can say so. */
  source: 'TELEGRAM' | 'WEB' | null
  updatedAt: string
}

const IDLE: LiveSession = {
  phase: 'IDLE',
  headline: 'Waiting for an instruction.',
  requestId: null,
  itemId: null,
  product: null,
  price: null,
  priceUsdc: null,
  seller: null,
  reason: null,
  decision: null,
  violations: [],
  checksPassed: 0,
  checksTotal: 0,
  orderId: null,
  transactionId: null,
  explorerUrl: null,
  source: null,
  updatedAt: new Date().toISOString(),
}

let session: LiveSession = { ...IDLE }

export function getLiveSession(): LiveSession {
  return session
}

/** Merges a change in and stamps the time. */
export function updateLive(patch: Partial<LiveSession>): LiveSession {
  session = { ...session, ...patch, updatedAt: new Date().toISOString() }
  return session
}

/** Starts a fresh run, clearing anything left from the last one. */
export function startLive(source: 'TELEGRAM' | 'WEB', want: string): LiveSession {
  session = {
    ...IDLE,
    phase: 'BROWSING',
    headline: `Looking for ${want}…`,
    source,
    updatedAt: new Date().toISOString(),
  }
  return session
}

export function resetLive(): void {
  session = { ...IDLE, updatedAt: new Date().toISOString() }
}

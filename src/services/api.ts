// Talks to the MandateGuard Policy Engine (server/).
// No blockchain, no x402, no AI - just plain HTTP to localhost:4021.

import type {
  AIOrder,
  AuditEntry,
  FlowEvent,
  HealthResponse,
  OrderSource,
  ParsePolicyResponse,
  PolicySource,
  PreparedOrderResponse,
  SpendingPolicy,
  SystemStatus,
  VerificationResult,
} from '../types'

export const API_BASE = 'http://localhost:4021'

/** Shown to the user when the backend is not running. */
export const BACKEND_DOWN_MESSAGE =
  'Cannot reach the MandateGuard server. Start it with: cd server && npm run dev'

/** NVIDIA can take a while; everything else should be quick. */
const DEFAULT_TIMEOUT_MS = 90_000

async function request<T>(
  path: string,
  init?: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  // Without this, a stalled request leaves the button spinning forever with
  // no explanation. A timeout turns silence into a readable message.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      ...init,
    })
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      throw new Error(
        `No answer from the server after ${Math.round(timeoutMs / 1000)} seconds. ` +
          'It may still be working, or the AI service may be slow. Please try again.',
      )
    }
    throw new Error(BACKEND_DOWN_MESSAGE)
  } finally {
    clearTimeout(timer)
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const body = data as { error?: string; errors?: string[] } | null
    const message =
      body?.errors?.join(' ') ?? body?.error ?? `Request failed (HTTP ${response.status})`
    const error = new Error(message) as Error & { status?: number }
    error.status = response.status
    throw error
  }

  return data as T
}

export type NewPolicy = Omit<SpendingPolicy, 'id' | 'status'>

export async function createPolicy(input: NewPolicy): Promise<SpendingPolicy> {
  const data = await request<{ policy: SpendingPolicy }>('/api/policies', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return data.policy
}

export async function listPolicies(): Promise<SpendingPolicy[]> {
  const data = await request<{ policies: SpendingPolicy[] }>('/api/policies')
  return data.policies
}

export async function verifyMandate(
  policyId: string,
  order: AIOrder,
  sources: { policySource?: PolicySource; orderSource?: OrderSource } = {},
): Promise<VerificationResult> {
  return request<VerificationResult>('/api/verify-mandate', {
    method: 'POST',
    body: JSON.stringify({ policyId, order, ...sources }),
  })
}

// ── Phase 5 - NVIDIA NIM assistance ───────────────────────

/** English instruction -> draft policy. The AI never creates a real policy. */
export async function parsePolicyInstruction(
  instruction: string,
): Promise<ParsePolicyResponse> {
  return request<ParsePolicyResponse>('/api/ai/parse-policy', {
    method: 'POST',
    body: JSON.stringify({ instruction }),
  })
}

/** Asks the AI agent to pick an item from the demo catalog. */
export async function prepareAiOrder(policyId: string): Promise<PreparedOrderResponse> {
  return request<PreparedOrderResponse>('/api/ai/prepare-order', {
    method: 'POST',
    body: JSON.stringify({ policyId }),
  })
}

/** Fixed sample "manipulated" order for the security demo. No AI involved. */
export async function simulateUnsafeOrder(): Promise<{ order: AIOrder; note: string }> {
  return request<{ order: AIOrder; note: string }>('/api/ai/simulate-unsafe-order', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health')
}

export async function getAudit(): Promise<{ entries: AuditEntry[]; spentToday: number }> {
  return request<{ entries: AuditEntry[]; spentToday: number }>('/api/audit')
}

export async function recordExecution(verificationId: string): Promise<AuditEntry> {
  const data = await request<{ entry: AuditEntry }>('/api/executions', {
    method: 'POST',
    body: JSON.stringify({ verificationId }),
  })
  return data.entry
}

// ── Phase 7 - system status, timeline, demo reset ─────────

export async function getSystemStatus(): Promise<SystemStatus> {
  return request<SystemStatus>('/api/system/status')
}

export async function getTimeline(requestId: string): Promise<FlowEvent[]> {
  const data = await request<{ events: FlowEvent[] }>(
    `/api/system/timeline/${encodeURIComponent(requestId)}`,
  )
  return data.events
}

export async function getAuditEntry(
  verificationId: string,
): Promise<{ entry: AuditEntry; timeline: FlowEvent[] }> {
  return request<{ entry: AuditEntry; timeline: FlowEvent[] }>(
    `/api/audit/${encodeURIComponent(verificationId)}`,
  )
}

/** Clears the in-memory demo state. Cannot touch Algorand history. */
export async function resetDemo(): Promise<{ message: string; note: string }> {
  return request<{ message: string; note: string }>('/api/demo/reset', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

/** Policy creation that also carries the journey's request id. */
export async function createPolicyForRequest(
  input: NewPolicy,
  requestId: string,
): Promise<SpendingPolicy> {
  const data = await request<{ policy: SpendingPolicy }>('/api/policies', {
    method: 'POST',
    body: JSON.stringify({ ...input, requestId }),
  })
  return data.policy
}

export async function parsePolicyForRequest(
  instruction: string,
  requestId?: string,
): Promise<ParsePolicyResponse & { requestId: string }> {
  return request<ParsePolicyResponse & { requestId: string }>('/api/ai/parse-policy', {
    method: 'POST',
    body: JSON.stringify({ instruction, requestId }),
  })
}

export async function prepareAiOrderForRequest(
  policyId: string,
  requestId: string,
): Promise<PreparedOrderResponse & { requestId: string }> {
  return request<PreparedOrderResponse & { requestId: string }>('/api/ai/prepare-order', {
    method: 'POST',
    body: JSON.stringify({ policyId, requestId }),
  })
}

/**
 * On-chain anchor - Algorand TestNet.
 *
 * The fingerprint of an approved policy can be written into the note field of
 * a real TestNet transaction. These two calls read that status and confirm a
 * transaction the wallet has just sent. The server re-reads the chain itself
 * before believing anything, so a transaction id alone proves nothing here.
 */
export interface AnchorDetails {
  txId: string
  note: string
  sender: string
  confirmedRound: number
  roundTime: number
  explorerUrl: string
  anchoredAt: string | null
  network: string
}

export interface AnchorStatus {
  mandateId: string
  mandateHash: string
  anchored: boolean
  /** Re-checked against Algorand on every read, never cached. */
  stillMatches?: boolean
  reason?: string | null
  expectedNote: string
  anchor: AnchorDetails | null
}

export async function getMandateAnchor(mandateId: string): Promise<AnchorStatus> {
  return request<AnchorStatus>(`/api/mandates/${mandateId}/anchor`)
}

export async function confirmMandateAnchor(
  mandateId: string,
  txId: string,
): Promise<{ verified: boolean; mandateHash: string; anchor: AnchorDetails }> {
  return request<{ verified: boolean; mandateHash: string; anchor: AnchorDetails }>(
    `/api/mandates/${mandateId}/anchor`,
    { method: 'POST', body: JSON.stringify({ txId }) },
  )
}

// ── The shop and the agent ────────────────────────────────

export interface ShopProduct {
  id: string
  product: string
  price: number
  priceUsdc: number
  seller: string
  warrantyAvailable: boolean
  receiverWallet: string
  category: string
  rating: number
  inStock: boolean
}

export type AgentMode = 'ASK' | 'AUTONOMOUS'
export type RunState =
  | 'BLOCKED'
  | 'PENDING_APPROVAL'
  | 'READY_TO_PAY'
  | 'REJECTED'
  | 'PAID'

export interface AgentRun {
  requestId: string
  policyId: string
  mode: AgentMode
  state: RunState
  order: AIOrder
  item: ShopProduct | null
  reason: string
  decision: 'APPROVED' | 'BLOCKED'
  violations: string[]
  checks: VerificationResult['checks']
  priceUsdc: number
  createdAt: string
}

export async function getShopProducts(): Promise<{
  products: ShopProduct[]
  demoRate: string
}> {
  return request<{ products: ShopProduct[]; demoRate: string }>('/api/shop/products')
}

export async function sendAgentShopping(
  policyId: string,
  mode: AgentMode,
  /** What to look for. The agent searches for this, not for what will pass. */
  want?: string,
): Promise<AgentRun> {
  const data = await request<{ run: AgentRun }>('/api/agent/shop', {
    method: 'POST',
    body: JSON.stringify({ policyId, mode, want }),
  })
  return data.run
}

export async function getAgentRun(requestId: string): Promise<AgentRun> {
  const data = await request<{ run: AgentRun }>(`/api/agent/run/${requestId}`)
  return data.run
}

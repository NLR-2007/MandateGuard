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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })
  } catch {
    throw new Error(BACKEND_DOWN_MESSAGE)
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

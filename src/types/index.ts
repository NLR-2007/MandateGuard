// MandateGuard - frontend types.
// These match the backend models in server/src/types/index.ts.

export type PolicyStatus = 'ACTIVE' | 'EXPIRED' | 'DISABLED'

/** Rules a human approves before the AI agent is allowed to spend. */
export interface SpendingPolicy {
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
  status: PolicyStatus
}

/** The order an AI agent prepared and wants to pay for. */
export interface AIOrder {
  orderId: string
  product: string
  quantity: number
  price: number
  seller: string
  warrantyAdded: boolean
  receiverWallet: string
}

/** One rule the backend checked. */
export interface VerificationCheck {
  rule: string
  passed: boolean
  expected: string | number | boolean
  actual: string | number | boolean
  message: string
}

export type Decision = 'APPROVED' | 'BLOCKED'

/** The full answer from POST /api/verify-mandate. */
export interface VerificationResult {
  verificationId: string
  policyId: string
  orderId: string
  decision: Decision
  checks: VerificationCheck[]
  violations: string[]
  checkedAt: string
}

export type ExecutionStatus = 'NOT_EXECUTED' | 'SIMULATED_EXECUTED'

/** How the policy was written. */
export type PolicySource = 'MANUAL' | 'NVIDIA_NIM_ASSISTED'

/** Where the order came from. */
export type OrderSource = 'MANUAL_DEMO' | 'NVIDIA_NIM' | 'SECURITY_SIMULATION'

export type X402PaymentStatus = 'NOT_PAID' | 'VERIFIED' | 'UNKNOWN'

/** One row from GET /api/audit. */
export interface AuditEntry {
  requestId: string | null
  verificationId: string
  policyId: string
  orderId: string
  product: string
  amount: number
  seller: string
  decision: Decision
  violations: string[]
  checkedAt: string
  executionStatus: ExecutionStatus
  policySource: PolicySource
  orderSource: OrderSource

  // Phase 6 - blockchain proof. Real values only, never invented.
  x402PaymentStatus: X402PaymentStatus
  x402TransactionId: string | null
  x402Amount: string | null
  blockchainNetwork: string | null
  paymentVerifiedAt: string | null
  mandateHash: string | null
  mandateStatus: string | null
}

// ────────────────────────────────────────────────────────────
// Phase 5 - NVIDIA NIM assistance
// ────────────────────────────────────────────────────────────

/** AI output. Every field may be null: null means "the human did not say". */
export interface PolicyDraft {
  product: string | null
  quantity: number | null
  maxPrice: number | null
  approvedSeller: string | null
  warrantyAllowed: boolean | null
  approvedReceiverWallet: string | null
  perTransactionLimit: number | null
  dailyLimit: number | null
  validForMinutes: number | null
}

export interface ParsePolicyResponse {
  success: true
  source: 'NVIDIA_NIM'
  model: string | null
  draft: PolicyDraft
  missingFields: string[]
  warnings: string[]
  note: string
}

export interface PreparedOrderResponse {
  success: true
  source: 'NVIDIA_NIM'
  model: string | null
  order: AIOrder
  reason: string
  note: string
}

/** Where the human is in the review of an AI draft. */
export type AiDraftStatus = 'GENERATED' | 'REVIEWED' | 'APPROVED_BY_HUMAN'

export interface HealthResponse {
  status: string
  service: string
  phase: number
  mandateGuard: boolean
  nvidiaNimConfigured: boolean
  nvidiaModel: string | null
  x402: boolean
  algorand: boolean
}

/** Which demo the user loaded on the AI Order page. */
export type DemoMode = 'safe' | 'unsafe'

// ────────────────────────────────────────────────────────────
// Phase 3 - "Without MandateGuard" problem demo
// ────────────────────────────────────────────────────────────

export type AttackScenario =
  | 'safe'
  | 'quantity'
  | 'seller'
  | 'warranty'
  | 'receiver'
  | 'combined'

/** Which rows the AI order card should paint red. Written by hand in demo data. */
export interface ChangedFields {
  quantity?: boolean
  seller?: boolean
  warranty?: boolean
  receiver?: boolean
}

/** One "what went wrong" card on the Phase 3 page. Sample text, not calculated. */
export interface Violation {
  title: string
  humanApproved: string
  aiSelected: string
}

/** Everything the problem demo needs for one button. */
export interface ScenarioDemo {
  id: AttackScenario
  label: string
  order: AIOrder
  changed: ChangedFields
  note: string
  violations: Violation[]
}

// ────────────────────────────────────────────────────────────
// Phase 7 - end-to-end integration
// ────────────────────────────────────────────────────────────

export type ServiceState = 'OK' | 'NOT_CONFIGURED' | 'ERROR'

export interface ServiceInfo {
  state: ServiceState
  name: string
  model?: string | null
  rules?: number
  price?: string
  receiver?: string | null
  facilitator?: string | null
  network?: string
  asset?: string
  assetId?: number | null
  applicationId?: string | null
  note?: string
}

export interface SystemStatus {
  success: true
  services: {
    ai: ServiceInfo
    mandateGuard: ServiceInfo
    x402: ServiceInfo
    algorand: ServiceInfo
    smartContract: ServiceInfo
  }
  spend: {
    dailyLimit: number | null
    spentToday: number
    remaining: number | null
  }
  counts: {
    policies: number
    verifications: number
    approved: number
    blocked: number
    executed: number
  }
  latestPolicyId: string | null
}

/** One line of the audit timeline, with a real timestamp. */
export interface FlowEvent {
  requestId: string
  at: string
  step: string
  detail: string
}

/** Payment state - kept separate from the MandateGuard decision. */
export type PaymentState =
  | 'NOT_STARTED'
  | 'PAYMENT_REQUIRED'
  | 'WAITING_FOR_WALLET'
  | 'SUBMITTED'
  | 'VERIFYING'
  | 'VERIFIED'
  | 'FAILED'
  | 'CANCELLED'

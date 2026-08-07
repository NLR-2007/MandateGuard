// MandateGuard Policy Engine - Phase 4
// No blockchain, no x402, no AI. Plain TypeScript models.

export type PolicyStatus = 'ACTIVE' | 'EXPIRED' | 'DISABLED'

/** The rules a human approved before an AI agent is allowed to spend. */
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

/** The final order an AI agent wants to pay for. */
export interface AIOrder {
  orderId: string
  product: string
  quantity: number
  price: number
  seller: string
  warrantyAdded: boolean
  receiverWallet: string
}

/** One rule that MandateGuard checked. */
export interface VerificationCheck {
  rule: string
  passed: boolean
  expected: string | number | boolean
  actual: string | number | boolean
  message: string
}

export type Decision = 'APPROVED' | 'BLOCKED'

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

/** One row of the audit log. */
export interface AuditEntry {
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
}

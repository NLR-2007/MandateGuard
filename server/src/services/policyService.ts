import { nextPolicyId, policies } from '../data/memoryStore.js'
import type { SpendingPolicy } from '../types/index.js'

/** What the client is allowed to send when creating a policy. */
export interface PolicyInput {
  product: string
  quantity: number
  maxPrice: number
  approvedSeller: string
  warrantyAllowed: boolean
  approvedReceiverWallet: string
  perTransactionLimit: number
  dailyLimit: number
  expiresAt: string
}

/** Returns a list of problems. Empty list means the input is fine. */
export function validatePolicyInput(body: unknown): string[] {
  const errors: string[] = []

  if (typeof body !== 'object' || body === null) {
    return ['Request body must be a JSON object.']
  }

  const b = body as Record<string, unknown>

  const requireText = (field: string, label: string) => {
    const value = b[field]
    if (typeof value !== 'string' || value.trim() === '') {
      errors.push(`${label} is required.`)
    }
  }

  const requireNumber = (field: string, label: string, min: number) => {
    const value = b[field]
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      errors.push(`${label} must be a number.`)
      return
    }
    if (value < min) {
      errors.push(`${label} must be at least ${min}.`)
    }
  }

  requireText('product', 'Product')
  requireText('approvedSeller', 'Approved seller')
  requireText('approvedReceiverWallet', 'Approved receiver wallet')

  requireNumber('quantity', 'Quantity', 1)
  requireNumber('maxPrice', 'Maximum price', 0)
  requireNumber('perTransactionLimit', 'Per-transaction limit', 0)
  requireNumber('dailyLimit', 'Daily limit', 0)

  if (typeof b.warrantyAllowed !== 'boolean') {
    errors.push('Warranty allowed must be true or false.')
  }

  if (typeof b.expiresAt !== 'string' || b.expiresAt.trim() === '') {
    errors.push('Expiry time is required.')
  } else if (!Number.isFinite(new Date(b.expiresAt).getTime())) {
    errors.push('Expiry time is not a valid date.')
  }

  return errors
}

export function createPolicy(input: PolicyInput): SpendingPolicy {
  const policy: SpendingPolicy = {
    id: nextPolicyId(),
    product: input.product.trim(),
    quantity: input.quantity,
    maxPrice: input.maxPrice,
    approvedSeller: input.approvedSeller.trim(),
    warrantyAllowed: input.warrantyAllowed,
    approvedReceiverWallet: input.approvedReceiverWallet.trim(),
    perTransactionLimit: input.perTransactionLimit,
    dailyLimit: input.dailyLimit,
    expiresAt: input.expiresAt,
    status: 'ACTIVE',
  }

  policies.set(policy.id, policy)
  return policy
}

export function getPolicy(id: string): SpendingPolicy | undefined {
  return policies.get(id)
}

export function listPolicies(): SpendingPolicy[] {
  return [...policies.values()]
}

/** Returns a list of problems with an incoming AI order. */
export function validateOrderInput(body: unknown): string[] {
  const errors: string[] = []

  if (typeof body !== 'object' || body === null) {
    return ['Order must be a JSON object.']
  }

  const o = body as Record<string, unknown>

  if (typeof o.orderId !== 'string' || o.orderId.trim() === '') {
    errors.push('Order ID is required.')
  }
  if (typeof o.product !== 'string' || o.product.trim() === '') {
    errors.push('Product is required.')
  }
  if (typeof o.seller !== 'string' || o.seller.trim() === '') {
    errors.push('Seller is required.')
  }
  if (typeof o.receiverWallet !== 'string' || o.receiverWallet.trim() === '') {
    errors.push('Receiver wallet is required.')
  }
  if (typeof o.quantity !== 'number' || !Number.isFinite(o.quantity) || o.quantity <= 0) {
    errors.push('Quantity must be greater than 0.')
  }
  if (typeof o.price !== 'number' || !Number.isFinite(o.price) || o.price < 0) {
    errors.push('Price cannot be negative.')
  }
  if (typeof o.warrantyAdded !== 'boolean') {
    errors.push('Warranty added must be true or false.')
  }

  return errors
}

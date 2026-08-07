// Mandate proof - Phase 6
//
// Two jobs:
//   1. Turn a policy into a short, stable SHA-256 fingerprint (Part Q).
//   2. Track whether a mandate has been consumed, for replay protection.
//
// ⚠️ SCOPE NOTE: this registry lives in MySQL, NOT on Algorand. The on-chain
// contract is documented as blocked - see README. Nothing here pretends to be
// blockchain data, and no fake IDs are produced.

import { createHash } from 'node:crypto'
import { storageState } from '../data/db.js'
import { persistMandate } from '../data/repository.js'
import type { SpendingPolicy } from '../types/index.js'

export type MandateStatus = 'ACTIVE' | 'USED' | 'EXPIRED' | 'NOT_REGISTERED'

export interface MandateRecord {
  mandateId: string
  mandateHash: string
  expiresAt: string
  used: boolean
  usedAt: string | null
  registeredAt: string
  /** Where the record lives locally. */
  storage: 'IN_MEMORY' | 'MYSQL'
  /**
   * Algorand TestNet transaction carrying this fingerprint in its note field.
   * null until the human's wallet has written it to the chain.
   */
  anchorTxId: string | null
  anchoredAt: string | null
}

const mandates = new Map<string, MandateRecord>()

/**
 * Canonical text for a policy: fixed field order, trimmed, lowercased text.
 * The same policy always produces the same fingerprint.
 *
 * Only compact identifying fields go in - never natural language, AI output
 * or personal data.
 */
export function canonicalMandate(policy: SpendingPolicy): string {
  const canonical = {
    policyId: policy.id,
    product: policy.product.trim().toLowerCase(),
    quantity: policy.quantity,
    maxPrice: policy.maxPrice,
    seller: policy.approvedSeller.trim().toLowerCase(),
    warrantyAllowed: policy.warrantyAllowed,
    receiverWallet: policy.approvedReceiverWallet.trim(),
    perTransactionLimit: policy.perTransactionLimit,
    dailyLimit: policy.dailyLimit,
    expiresAt: policy.expiresAt,
  }

  // JSON.stringify with an explicit key list keeps the order stable.
  return JSON.stringify(canonical, Object.keys(canonical).sort())
}

/** SHA-256 of the canonical mandate, as lowercase hex. */
export function hashMandate(policy: SpendingPolicy): string {
  return createHash('sha256').update(canonicalMandate(policy)).digest('hex')
}

/** Registers the fingerprint. Re-registering the same policy is harmless. */
export function registerMandate(policy: SpendingPolicy): MandateRecord {
  const existing = mandates.get(policy.id)
  if (existing) return existing

  const record: MandateRecord = {
    mandateId: policy.id,
    mandateHash: hashMandate(policy),
    expiresAt: policy.expiresAt,
    used: false,
    usedAt: null,
    registeredAt: new Date().toISOString(),
    storage: storageState() === 'MYSQL' ? 'MYSQL' : 'IN_MEMORY',
    anchorTxId: null,
    anchoredAt: null,
  }

  mandates.set(policy.id, record)
  persistMandate(record)
  return record
}

export function getMandate(mandateId: string): MandateRecord | undefined {
  return mandates.get(mandateId)
}

export function getMandateStatus(
  mandateId: string,
  now: Date = new Date(),
): MandateStatus {
  const record = mandates.get(mandateId)
  if (!record) return 'NOT_REGISTERED'
  if (record.used) return 'USED'

  const expiry = new Date(record.expiresAt).getTime()
  if (!Number.isFinite(expiry) || now.getTime() >= expiry) return 'EXPIRED'

  return 'ACTIVE'
}

export function isMandateValid(mandateId: string, now: Date = new Date()): boolean {
  return getMandateStatus(mandateId, now) === 'ACTIVE'
}

/**
 * Marks a mandate as consumed.
 *
 * ⚠️ Only call this when an approved purchase is actually executed.
 * Paying the x402 verification fee must NEVER consume a mandate - those are
 * two different things.
 */
export function markMandateUsed(mandateId: string): MandateRecord | null {
  const record = mandates.get(mandateId)
  if (!record || record.used) return null

  record.used = true
  record.usedAt = new Date().toISOString()
  persistMandate(record)
  return record
}

/**
 * Records the Algorand transaction that carries this fingerprint.
 *
 * Only call this AFTER chainAnchor.verifyAnchor() has read the note back off
 * the chain. Storing an unverified id would be inventing evidence.
 */
export function setMandateAnchor(
  mandateId: string,
  txId: string,
  roundTimeSeconds: number,
): MandateRecord | null {
  const record = mandates.get(mandateId)
  if (!record) return null

  record.anchorTxId = txId
  // The block's own timestamp, so the record matches what the chain says.
  record.anchoredAt = roundTimeSeconds
    ? new Date(roundTimeSeconds * 1000).toISOString()
    : new Date().toISOString()

  persistMandate(record)
  return record
}

/** Test helper - clears the registry. */
export function resetMandates(): void {
  mandates.clear()
}

/** Replaces the registry with rows loaded from MySQL. */
export function loadMandates(records: MandateRecord[]): void {
  mandates.clear()
  for (const r of records) mandates.set(r.mandateId, r)
}

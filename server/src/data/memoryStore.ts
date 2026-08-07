// Phase 4 keeps everything in memory on purpose.
// There is no database yet, so all data resets when the server restarts.

import type { AuditEntry, SpendingPolicy } from '../types/index.js'

export const policies = new Map<string, SpendingPolicy>()

/** Newest audit entry is pushed to the front. */
export const auditLog: AuditEntry[] = []

/** Money counted as actually spent, per calendar day: 'YYYY-MM-DD' -> amount. */
export const dailySpend = new Map<string, number>()

let policyCounter = 1000
let verificationCounter = 1000

export function nextPolicyId(): string {
  policyCounter += 1
  return `MG-${policyCounter}`
}

export function nextVerificationId(): string {
  verificationCounter += 1
  return `VER-${verificationCounter}`
}

/** Today as 'YYYY-MM-DD'. */
export function todayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/** How much has been marked as executed today. Verifications do NOT count. */
export function getSpentToday(now: Date = new Date()): number {
  return dailySpend.get(todayKey(now)) ?? 0
}

/** Called only when a simulated execution is recorded. */
export function addSpentToday(amount: number, now: Date = new Date()): number {
  const key = todayKey(now)
  const total = (dailySpend.get(key) ?? 0) + amount
  dailySpend.set(key, total)
  return total
}

// In-process read cache. MySQL is the source of truth - see data/db.ts and
// data/repository.ts. Everything here is refilled from MySQL at startup and
// written through on every change.

import type { AuditEntry, SpendingPolicy } from '../types/index.js'
import { persistDailySpend } from './repository.js'
import { setRequestCounter } from '../services/flowService.js'

export const policies = new Map<string, SpendingPolicy>()

/** Newest audit entry is pushed to the front. */
export const auditLog: AuditEntry[] = []

/** Money counted as actually spent, per calendar day: 'YYYY-MM-DD' -> amount. */
export const dailySpend = new Map<string, number>()

let policyCounter = 1000
let verificationCounter = 1000

/** Called after loading from MySQL so ids continue instead of restarting at 1001. */
export function setCounters(next: { policy?: number; verification?: number; request?: number }): void {
  if (next.policy !== undefined) policyCounter = next.policy
  if (next.verification !== undefined) verificationCounter = next.verification
  if (next.request !== undefined) setRequestCounter(next.request)
}

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
  persistDailySpend(total, key)
  return total
}

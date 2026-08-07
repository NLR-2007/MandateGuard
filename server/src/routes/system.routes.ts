import { Hono } from 'hono'
import { auditLog, dailySpend, getSpentToday, policies } from '../data/memoryStore.js'
import { getTimeline, resetEvents } from '../services/flowService.js'
import { resetMandates } from '../services/mandateProof.js'
import { getModelName, isNimConfigured } from '../services/nimClient.js'
import { describeX402, isX402Configured } from '../x402/x402Config.js'

export const systemRoutes = new Hono()

export type ServiceState = 'OK' | 'NOT_CONFIGURED' | 'ERROR'

/**
 * GET /api/system/status
 * A single call that tells the UI which lights are green.
 * Contains no keys, no secrets, no wallet credentials.
 */
systemRoutes.get('/system/status', (c) => {
  const x402 = describeX402()

  const nim: ServiceState = isNimConfigured() ? 'OK' : 'NOT_CONFIGURED'
  const payment: ServiceState = isX402Configured() ? 'OK' : 'NOT_CONFIGURED'

  const approved = auditLog.filter((e) => e.decision === 'APPROVED').length
  const blocked = auditLog.filter((e) => e.decision === 'BLOCKED').length
  const executed = auditLog.filter(
    (e) => e.executionStatus === 'SIMULATED_EXECUTED',
  ).length

  // The most recently created policy drives the daily-limit display.
  const allPolicies = [...policies.values()]
  const latest = allPolicies[allPolicies.length - 1] ?? null
  const spentToday = getSpentToday()
  const dailyLimit = latest?.dailyLimit ?? null

  return c.json({
    success: true,
    services: {
      ai: {
        state: nim,
        name: 'NVIDIA NIM',
        model: getModelName(),
      },
      mandateGuard: {
        state: 'OK' as ServiceState,
        name: 'MandateGuard',
        rules: 10,
      },
      x402: {
        state: payment,
        name: 'x402',
        price: x402.price,
        receiver: x402.receiver,
        facilitator: x402.facilitator,
      },
      algorand: {
        state: payment,
        name: 'Algorand TestNet',
        network: 'testnet',
        asset: x402.asset,
        assetId: x402.assetId,
      },
      smartContract: {
        // Honest: no contract is deployed in this build.
        state: 'NOT_CONFIGURED' as ServiceState,
        name: 'Mandate proof contract',
        applicationId: null,
        note: 'Mandate proof is stored in server memory. No contract is deployed.',
      },
    },
    spend: {
      dailyLimit,
      spentToday,
      remaining: dailyLimit === null ? null : Math.max(dailyLimit - spentToday, 0),
    },
    counts: {
      policies: allPolicies.length,
      verifications: auditLog.length,
      approved,
      blocked,
      executed,
    },
    latestPolicyId: latest?.id ?? null,
  })
})

/** GET /api/system/timeline/:requestId - real timestamps for one journey. */
systemRoutes.get('/system/timeline/:requestId', (c) => {
  return c.json({ success: true, events: getTimeline(c.req.param('requestId')) })
})

/**
 * POST /api/demo/reset
 * Clears the in-memory demo state so a demo can be repeated.
 *
 * It does NOT and CANNOT delete anything already written to Algorand -
 * blockchain history is permanent.
 */
systemRoutes.post('/demo/reset', (c) => {
  policies.clear()
  auditLog.length = 0
  dailySpend.clear()
  resetMandates()
  resetEvents()

  console.log('  ↺ demo state reset (server memory only)')

  return c.json({
    success: true,
    message: 'Demo state cleared.',
    note: 'Algorand transactions already on TestNet are permanent and were not touched.',
  })
})

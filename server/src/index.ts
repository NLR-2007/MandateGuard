/**
 * MandateGuard - AI Agent Spend Policy Engine
 *
 * Layers:
 *   NVIDIA NIM  - reads English, drafts policies and orders (assistance only)
 *   x402        - payment layer: has the caller paid the API fee?
 *   Algorand    - TestNet ledger that records the payment
 *   MandateGuard- deterministic engine: does the order match human intent?
 *
 * Not connected: MainNet, database, authentication. All data is in memory
 * and resets when this process restarts.
 */

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { aiRoutes } from './routes/ai.routes.js'
import { auditRoutes } from './routes/audit.routes.js'
import { policyRoutes } from './routes/policy.routes.js'
import { verificationRoutes } from './routes/verification.routes.js'
import { systemRoutes } from './routes/system.routes.js'
import { createX402Routes, mandateRoutes } from './routes/x402.routes.js'
import { getModelName, isNimConfigured } from './services/nimClient.js'
import { describeX402, isX402Configured } from './x402/x402Config.js'

const PORT = 4021

/**
 * Keep the service alive during a live demo.
 *
 * The x402 library initialises its facilitator connection in the background.
 * If the network or the facilitator is down, that rejection used to reach the
 * top level and kill the whole process - taking MandateGuard, the AI and every
 * free route with it. We log it loudly and carry on; the paid route answers 503
 * on its own.
 */
process.on('unhandledRejection', (reason) => {
  console.error(
    '⚠ Unhandled rejection (service kept running):',
    reason instanceof Error ? reason.message : reason,
  )
})

process.on('uncaughtException', (error) => {
  const code = (error as NodeJS.ErrnoException).code

  // A failure to take the port is fatal: pretending to run would leave a
  // zombie that answers nothing. Say so plainly and stop.
  if (code === 'EADDRINUSE') {
    console.error(
      `\n✕ Port ${PORT} is already in use — another MandateGuard server is running.\n` +
        '  Stop it first, then start this one again.\n' +
        '  Windows:  Get-NetTCPConnection -LocalPort 4021 -State Listen |\n' +
        '              ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }\n',
    )
    process.exit(1)
  }

  console.error('⚠ Uncaught exception (service kept running):', error.message)
})

const app = new Hono()

/**
 * CORS - must be the FIRST middleware.
 *
 * x402 needs wildcard allow/expose headers so the browser client can read the
 * PAYMENT-REQUIRED and PAYMENT-RESPONSE headers. Hono's built-in cors() helper
 * is too restrictive for this, so the headers are set by hand.
 */
app.use('*', async (c, next) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE, HEAD',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Expose-Headers': '*',
    'Access-Control-Max-Age': '86400',
  }

  if (c.req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  Object.entries(corsHeaders).forEach(([key, value]) => c.header(key, value))
  await next()
})

// Simple request log.
app.use('*', async (c, next) => {
  console.log(`[${new Date().toISOString()}] ${c.req.method} ${c.req.path}`)
  await next()
})

// No keys, no wallet secrets - only whether things are configured.
app.get('/health', (c) =>
  c.json({
    status: 'ok',
    service: 'MandateGuard',
    phase: 8,
    mandateGuard: true,
    nvidiaNimConfigured: isNimConfigured(),
    nvidiaModel: getModelName(),
    x402: isX402Configured(),
    algorand: isX402Configured(),
    network: 'testnet',
    payment: describeX402(),
  }),
)

app.route('/api', policyRoutes)
app.route('/api', verificationRoutes)
app.route('/api', auditRoutes)
app.route('/api', aiRoutes)
app.route('/api', mandateRoutes)
app.route('/api', systemRoutes)

// The paid endpoint. Mounted only when a receiving address is configured,
// so a missing AVM_ADDRESS never breaks the free Phase 4/5 endpoints.
if (isX402Configured()) {
  app.route('/api', createX402Routes())
} else {
  app.post('/api/x402/verify-mandate', (c) =>
    c.json(
      { success: false, error: 'AVM_ADDRESS is required for x402 payments.' },
      503,
    ),
  )
}

app.notFound((c) =>
  c.json({ success: false, error: 'Endpoint not found.', path: c.req.path }, 404),
)

// Any unexpected throw becomes a 500 instead of killing the server.
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ success: false, error: 'Internal server error.' }, 500)
})

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log('\n' + '═'.repeat(56))
  console.log('  MandateGuard — AI Agent Spend Policy Engine')
  console.log('═'.repeat(56))
  console.log(`  API:     http://localhost:${PORT}`)
  console.log(`  Health:  http://localhost:${PORT}/health`)
  console.log('  Store:   in-memory (data resets on restart)')
  console.log(
    `  NVIDIA NIM: ${isNimConfigured() ? `configured (${getModelName()})` : 'NOT configured - manual mode only'}`,
  )

  if (isX402Configured()) {
    const x402 = describeX402()
    console.log(`  x402:    ON  — ${x402.price} Test USDC on ${x402.network}`)
    console.log(`           receiver ${x402.receiver}`)
    console.log(`           facilitator ${x402.facilitator}`)
    console.log(`           paid route POST /api/x402/verify-mandate`)
  } else {
    console.log('  x402:    OFF — AVM_ADDRESS is required for x402 payments.')
  }
  console.log('═'.repeat(56) + '\n')
})

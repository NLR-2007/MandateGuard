/**
 * MandateGuard - AI Agent Spend Policy Engine
 *
 * Layers:
 *   NVIDIA NIM  - reads English, drafts policies and orders (assistance only)
 *   x402        - payment layer: has the caller paid the API fee?
 *   Algorand    - TestNet ledger that records the payment
 *   MandateGuard- deterministic engine: does the order match human intent?
 *
 * Storage: MySQL (see server/.env). The in-memory maps are a read cache for
 * the running process; MySQL is the source of truth across restarts.
 *
 * Not connected: MainNet, authentication.
 */

import { serve } from '@hono/node-server'
import { describeStorage, initDatabase, storageState } from './data/db.js'
import { loadAll } from './data/repository.js'
import { Hono } from 'hono'
import { aiRoutes } from './routes/ai.routes.js'
import { auditRoutes } from './routes/audit.routes.js'
import { policyRoutes } from './routes/policy.routes.js'
import { verificationRoutes } from './routes/verification.routes.js'
import { systemRoutes } from './routes/system.routes.js'
import { createX402Routes, mandateRoutes } from './routes/x402.routes.js'
import { createShopRoutes, shopRoutes } from './routes/shop.routes.js'
import { agentRoutes } from './routes/agent.routes.js'
import { redTeamRoutes } from './routes/redTeam.routes.js'
import { getModelName, isNimConfigured } from './services/nimClient.js'
import { describeTelegram, isTelegramConfigured } from './services/telegram.js'
import { agentAddress, describeAgentWallet, isAgentWalletConfigured } from './services/agentWallet.js'
import { startTelegramBot } from './services/telegramBot.js'
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
  // Never call process.exit() from here. On Windows that trips a libuv
  // assertion (UV_HANDLE_CLOSING) and takes the process down hard, which is
  // exactly the silent-death we are trying to avoid. Port conflicts are
  // handled on the server's own 'error' event instead - see below.
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
    storage: describeStorage(),
    payment: describeX402(),
    telegram: describeTelegram(),
    agentWallet: { configured: isAgentWalletConfigured(), address: agentAddress() },
  }),
)

app.route('/api', policyRoutes)
app.route('/api', verificationRoutes)
app.route('/api', auditRoutes)
app.route('/api', aiRoutes)
app.route('/api', mandateRoutes)
app.route('/api', systemRoutes)
app.route('/api', shopRoutes)
app.route('/api', agentRoutes)
app.route('/api', redTeamRoutes)

// The paid endpoint. Mounted only when a receiving address is configured,
// so a missing AVM_ADDRESS never breaks the free Phase 4/5 endpoints.
if (isX402Configured()) {
  app.route('/api', createX402Routes())
  // Paying the seller. Separate from the verification fee on purpose.
  app.route('/api', createShopRoutes())
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

// Connect to MySQL and load existing data before answering any request.
const dbReady = await initDatabase()
let loaded = { policies: 0, verifications: 0, mandates: 0, events: 0 }

if (dbReady) {
  loaded = await loadAll()
} else {
  console.error(
    [
      '',
      '⚠ MySQL is not reachable — running with IN-MEMORY storage.',
      `  ${describeStorage().error}`,
      '  Data will be lost on restart. Start MySQL (XAMPP), then restart this server.',
      '',
    ].join('\n'),
  )
}

const server = serve({ fetch: app.fetch, port: PORT }, () => {
  console.log('\n' + '═'.repeat(56))
  console.log('  MandateGuard — AI Agent Spend Policy Engine')
  console.log('═'.repeat(56))
  console.log(`  API:     http://localhost:${PORT}`)
  console.log(`  Health:  http://localhost:${PORT}/health`)
  if (storageState() === 'MYSQL') {
    const st = describeStorage()
    console.log(`  Storage: MySQL — ${st.database} at ${st.host}:${st.port}`)
    console.log(
      `           loaded ${loaded.policies} policies, ${loaded.verifications} verifications, ` +
        `${loaded.mandates} mandates, ${loaded.events} events`,
    )
  } else {
    console.log('  Storage: IN-MEMORY (MySQL unavailable — data resets on restart)')
  }
  console.log(
    `  NVIDIA NIM: ${isNimConfigured() ? `configured (${getModelName()})` : 'NOT configured - manual mode only'}`,
  )

  if (isAgentWalletConfigured()) {
    void describeAgentWallet().then((w) => {
      console.log(`  Agent wallet: ${w.address}`)
      console.log(`           ${w.ready ? '✓ funded and ready' : '⚠ ' + w.note}`)
    })
  }

  if (isTelegramConfigured()) {
    startTelegramBot()
  } else {
    console.log('  Telegram: OFF — TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required.')
  }

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

/**
 * A port clash is the one failure worth stopping for: a server that cannot
 * listen is useless, and leaving it "running" hides the problem.
 * Handling it here (not in uncaughtException) means a clean exit.
 */
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      [
        '',
        `✕ Port ${PORT} is already in use — another MandateGuard server is running.`,
        '  Stop it, then start this one again:',
        '  Get-NetTCPConnection -LocalPort 4021 -State Listen |',
        '    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }',
        '',
      ].join('\n'),
    )
    process.exitCode = 1
    server.close()
    return
  }

  console.error('✕ Server error:', error.message)
})

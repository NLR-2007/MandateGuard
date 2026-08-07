/**
 * MandateGuard Policy Engine - Phase 4
 *
 * A small Hono server that compares a human-approved policy against an
 * AI agent's final order and answers APPROVED or BLOCKED.
 *
 * Not connected yet: x402, Algorand, blockchain, AI, database, auth.
 * All data lives in memory and resets when this process restarts.
 */

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { aiRoutes } from './routes/ai.routes.js'
import { auditRoutes } from './routes/audit.routes.js'
import { policyRoutes } from './routes/policy.routes.js'
import { verificationRoutes } from './routes/verification.routes.js'
import { getModelName, isNimConfigured } from './services/nimClient.js'

const PORT = 4021

const app = new Hono()

// Let the Vite dev server talk to us.
app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  }),
)

// Simple request log.
app.use('*', async (c, next) => {
  console.log(`[${new Date().toISOString()}] ${c.req.method} ${c.req.path}`)
  await next()
})

// The API key is never included here - only whether it is present.
app.get('/health', (c) =>
  c.json({
    status: 'ok',
    service: 'MandateGuard',
    phase: 5,
    mandateGuard: true,
    nvidiaNimConfigured: isNimConfigured(),
    nvidiaModel: getModelName(),
    x402: false,
    algorand: false,
  }),
)

app.route('/api', policyRoutes)
app.route('/api', verificationRoutes)
app.route('/api', auditRoutes)
app.route('/api', aiRoutes)

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
  console.log('  MandateGuard Policy Engine — Phase 4')
  console.log('═'.repeat(56))
  console.log(`  API:     http://localhost:${PORT}`)
  console.log(`  Health:  http://localhost:${PORT}/health`)
  console.log('  Store:   in-memory (data resets on restart)')
  console.log(
    `  NVIDIA NIM: ${isNimConfigured() ? `configured (${getModelName()})` : 'NOT configured - manual mode only'}`,
  )
  console.log('  x402 / Algorand: not connected')
  console.log('═'.repeat(56) + '\n')
})

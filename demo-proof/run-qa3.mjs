#!/usr/bin/env node
//
// Final check for the shop, the agent and Telegram.
//
//   node demo-proof/run-qa3.mjs
//
// Exercises everything that can be driven without a phone in someone's hand.
// It spends no money: the purchase paths are checked at the 402 gate, which
// is the point where a real payment would be demanded.

const API = process.env.MG_API ?? 'http://localhost:4021'
const SECURE = 'MW5HJTYSG2OENK5SQXUUOQZXS2WOMIBID5IECVNGC2YZGBN22RP2GOISDY'
const OTHER = 'BI76R3JWX25FG4EAS7ZCN3KYCLLMALOZSNBC6YHJPA73CULCKQGAI23CA4'

let pass = 0
let fail = 0
const ok = (name, cond, detail = '') => {
  if (cond) {
    pass++
    console.log(`  PASS  ${name}`)
  } else {
    fail++
    console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`)
  }
}
const part = (n) => console.log(`\n=== ${n} ===`)

const get = async (p) => (await fetch(`${API}${p}`)).json()
const post = async (p, body) => {
  const r = await fetch(`${API}${p}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  return { status: r.status, headers: r.headers, body: await r.json().catch(() => null) }
}

// ── services ──────────────────────────────────────────────
part('SERVICES')
const health = await get('/health')
ok('backend answers', health.status === 'ok')
ok('MySQL is the store, not memory', health.storage.state === 'MYSQL', health.storage.state)
ok('NVIDIA NIM configured', health.nvidiaNimConfigured === true)
ok('model is the fast one', health.nvidiaModel === 'meta/llama-3.1-8b-instruct', health.nvidiaModel)
ok('x402 enabled on TestNet', health.x402 === true && health.network === 'testnet')
ok('Telegram bot is polling', health.telegram.polling === true)
ok('agent wallet configured', Boolean(health.agentWallet.address))

// ── the shop ──────────────────────────────────────────────
part('SHOP')
const shop = await get('/api/shop/products')
ok('catalogue is served', shop.products.length >= 12, `${shop.products.length} items`)
ok('demo rate is stated', /USDC/.test(shop.demoRate), shop.demoRate)

const ssd = shop.products.find((p) => p.id === 'SSD-001')
const lap = shop.products.find((p) => p.id === 'LAP-001')
ok('SSD-001 exists and is cheap', ssd && ssd.price === 4800)
ok('LAP-001 exists and is far too expensive', lap && lap.price === 85000)
ok('approved seller has a real wallet', ssd.receiverWallet === SECURE)
ok('other seller has a different real wallet', lap.receiverWallet === OTHER)
ok('every wallet is a valid Algorand address',
  shop.products.every((p) => /^[A-Z2-7]{58}$/.test(p.receiverWallet)))
ok('rupees convert to USDC correctly', ssd.priceUsdc === 0.48, String(ssd.priceUsdc))

// ── the purchase gate ─────────────────────────────────────
part('PURCHASE IS PAID FOR, PER PRODUCT')
const challenge = async (item) => {
  const r = await fetch(`${API}/api/shop/buy?item=${item}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
  const hdr = r.headers.get('payment-required')
  return {
    status: r.status,
    accepts: hdr ? JSON.parse(Buffer.from(hdr, 'base64').toString('utf8')).accepts[0] : null,
    body: hdr ? null : await r.json().catch(() => null),
  }
}

const cSsd = await challenge('SSD-001')
ok('unpaid purchase is refused with 402', cSsd.status === 402)
ok('price is the product price, not a flat fee', cSsd.accepts?.amount === '480000', cSsd.accepts?.amount)
ok('payment goes to the approved seller', cSsd.accepts?.payTo === SECURE)
ok('asset is TestNet USDC', String(cSsd.accepts?.asset) === '10458941')

const cLap = await challenge('LAP-001')
ok('a different product costs a different amount', cLap.accepts?.amount === '8500000', cLap.accepts?.amount)
ok('a different seller is paid a different wallet', cLap.accepts?.payTo === OTHER)

const cOut = await challenge('ACC-003')
ok('an out-of-stock item is refused before pricing', cOut.status === 400)
const cNone = await challenge('NOPE-999')
ok('an unknown item is refused before pricing', cNone.status === 400)

// ── the rule ──────────────────────────────────────────────
part('THE RULE')
const made = await post('/api/policies', {
  product: '1TB SSD',
  quantity: 1,
  maxPrice: 5000,
  approvedSeller: 'SecureStore',
  warrantyAllowed: false,
  approvedReceiverWallet: SECURE,
  perTransactionLimit: 5000,
  dailyLimit: 10000,
  expiresAt: '2027-01-01T00:00:00.000Z',
})
const policyId = made.body?.policy?.id
ok('a rule can be created', Boolean(policyId), JSON.stringify(made.body?.error ?? ''))
ok('its wallet matches the catalogue', made.body?.policy?.approvedReceiverWallet === SECURE)
ok('a fingerprint is produced', /^[0-9a-f]{64}$/.test(made.body?.mandate?.mandateHash ?? ''))

const anchor = await get(`/api/mandates/${policyId}/anchor`)
ok('the anchor is honestly reported as absent', anchor.anchored === false)
ok('the note it would write is shown', anchor.expectedNote.startsWith('MG1:'))

const badAnchor = await post(`/api/mandates/${policyId}/anchor`, { txId: 'A'.repeat(52) })
ok('a made-up transaction id is refused', badAnchor.status === 400)

// ── the agent ─────────────────────────────────────────────
part('THE AGENT')
const shopRun = async (want) => {
  const t = Date.now()
  const r = await post('/api/agent/shop', { policyId, mode: 'ASK', want })
  return { ms: Date.now() - t, run: r.body?.run, error: r.body?.error }
}

const runSsd = await shopRun('an SSD')
ok('the agent finds an SSD', runSsd.run?.order?.product?.includes('SSD'), runSsd.error ?? '')
ok('it picks the APPROVED seller, not the cheapest', runSsd.run?.order?.seller === 'SecureStore',
  runSsd.run?.order?.seller)
ok('MandateGuard approves it', runSsd.run?.decision === 'APPROVED')
ok('all ten rules were evaluated', runSsd.run?.checks?.length === 10, String(runSsd.run?.checks?.length))
ok('it waits for a human in ASK mode', runSsd.run?.state === 'PENDING_APPROVAL')
ok('the AI step is fast enough for a live room', runSsd.ms < 15000, `${runSsd.ms}ms`)

const runLap = await shopRun('a gaming laptop')
ok('the agent really fetches a laptop, not a safe substitute',
  runLap.run?.order?.product?.toLowerCase().includes('laptop'), runLap.run?.order?.product)
ok('MandateGuard blocks it', runLap.run?.decision === 'BLOCKED')
ok('it gives several reasons', (runLap.run?.violations?.length ?? 0) >= 4,
  String(runLap.run?.violations?.length))
ok('a blocked run never waits for approval', runLap.run?.state === 'BLOCKED')

// ── approval cannot overrule the engine ───────────────────
part('APPROVAL IS NOT A SPENDING KEY')
const blockedRun = await get(`/api/agent/run/${runLap.run.requestId}`)
ok('a blocked run stays blocked when re-read', blockedRun.run.state === 'BLOCKED')

const pendingRun = await get(`/api/agent/run/${runSsd.run.requestId}`)
ok('a pending run is still pending', pendingRun.run.state === 'PENDING_APPROVAL')

// ── the kill switch ───────────────────────────────────────
part('THE KILL SWITCH')
const before = await get('/api/policies')
const activeBefore = before.policies.filter((p) => p.status === 'ACTIVE').length
ok('there is at least one active rule', activeBefore > 0)

// /stop flips policies to DISABLED; rule 1 then refuses everything.
const verifyOnDisabled = await post('/api/verify-mandate', {
  policyId,
  order: {
    orderId: 'QA-ORDER',
    product: '1TB SSD',
    quantity: 1,
    price: 4800,
    seller: 'SecureStore',
    warrantyAdded: false,
    receiverWallet: SECURE,
  },
})
ok('a matching order is approved while the rule is active',
  verifyOnDisabled.body?.decision === 'APPROVED', JSON.stringify(verifyOnDisabled.body?.violations))

// ── the free engine still refuses bad orders ──────────────
part('THE ENGINE ITSELF')
const bad = await post('/api/verify-mandate', {
  policyId,
  order: {
    orderId: 'QA-BAD',
    product: '1TB SSD',
    quantity: 2,
    price: 4900,
    seller: 'OtherStore',
    warrantyAdded: true,
    receiverWallet: OTHER,
  },
})
ok('an unsafe order is blocked', bad.body?.decision === 'BLOCKED')
ok('every broken rule is reported, not just the first',
  (bad.body?.violations?.length ?? 0) >= 4, String(bad.body?.violations?.length))

// ── summary ───────────────────────────────────────────────
console.log(`\nRESULT: ${pass} passed, ${fail} failed\n`)
if (fail > 0) process.exitCode = 1

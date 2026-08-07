// Phase 8 QA harness. Exercises the real backend. Spends no Test USDC.
const API = 'http://localhost:4021'
const out = []
const log = (s) => { console.log(s); out.push(s) }
let pass = 0, fail = 0

const check = (name, ok, detail = '') => {
  if (ok) { pass++; log(`  PASS  ${name}${detail ? ' — ' + detail : ''}`) }
  else { fail++; log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`) }
}

const post = async (path, body) => {
  const r = await fetch(API + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  let json = null
  try { json = await r.json() } catch { /* 402 has an empty body */ }
  return { status: r.status, json, headers: r.headers }
}
const get = async (path) => {
  const r = await fetch(API + path)
  return { status: r.status, json: await r.json().catch(() => null) }
}

const basePolicy = {
  product: '1TB SSD', quantity: 1, maxPrice: 5000, approvedSeller: 'SecureStore',
  warrantyAllowed: false, approvedReceiverWallet: 'ALGO-SECURE-STORE',
  perTransactionLimit: 5000, dailyLimit: 10000, expiresAt: '2030-12-31T23:59',
}
const baseOrder = {
  orderId: 'QA-ORDER', product: '1TB SSD', quantity: 1, price: 4800,
  seller: 'SecureStore', warrantyAdded: false, receiverWallet: 'ALGO-SECURE-STORE',
}

const mkPolicy = async (patch = {}) => (await post('/api/policies', { ...basePolicy, ...patch })).json.policy
const verify = async (policyId, patch = {}, n = 0) =>
  (await post('/api/verify-mandate', {
    policyId, order: { ...baseOrder, orderId: `QA-ORDER-${n}`, ...patch },
  })).json

log('=== PART 3: HEALTH ===')
const health = await get('/health')
check('health status ok', health.json.status === 'ok')
check('mandateGuard true', health.json.mandateGuard === true)
check('nvidiaNimConfigured true', health.json.nvidiaNimConfigured === true)
check('x402 true', health.json.x402 === true)
check('algorand true', health.json.algorand === true)
check('network testnet', health.json.network === 'testnet')
const healthStr = JSON.stringify(health.json)
check('no secret in /health', !/nvapi-|mnemonic|seed|privateKey/i.test(healthStr))

log('')
log('=== PART 6: MANDATEGUARD ENGINE (12 cases) ===')
await post('/api/demo/reset', {})
const p = await mkPolicy()

const cases = [
  ['1. correct order', {}, 'APPROVED', null],
  ['2. product mismatch', { product: '2TB SSD' }, 'BLOCKED', 'Product does not match the approved policy.'],
  ['3. quantity mismatch', { quantity: 2 }, 'BLOCKED', 'Quantity changed from 1 to 2.'],
  ['4. price above maximum', { price: 5500 }, 'BLOCKED', 'Order price exceeds the approved maximum price.'],
  ['7. wrong seller', { seller: 'OtherStore' }, 'BLOCKED', 'Seller is not approved.'],
  ['8. warranty added', { warrantyAdded: true }, 'BLOCKED', 'Warranty was added without human approval.'],
  ['9. wrong receiver', { receiverWallet: 'ALGO-UNKNOWN-WALLET' }, 'BLOCKED', 'Payment receiver wallet does not match the approved wallet.'],
]
let n = 0
for (const [name, patch, expected, reason] of cases) {
  const r = await verify(p.id, patch, n++)
  check(name, r.decision === expected, `${r.decision}${reason ? ' | "' + (r.violations[0] ?? '') + '"' : ''}`)
  if (reason) check(`   reason shown`, r.violations.includes(reason), reason)
}

const strict = await mkPolicy({ perTransactionLimit: 2000 })
const r5 = await verify(strict.id, {}, n++)
check('5. per-transaction limit exceeded', r5.decision === 'BLOCKED', r5.violations[0])

const expired = await mkPolicy({ expiresAt: '2020-01-01T00:00' })
const r10 = await verify(expired.id, {}, n++)
check('10. expired policy', r10.decision === 'BLOCKED', r10.violations[0])

const combined = await verify(p.id, {
  quantity: 2, price: 4900, seller: 'OtherStore', warrantyAdded: true, receiverWallet: 'ALGO-UNKNOWN-WALLET',
}, n++)
check('12. combined attack', combined.decision === 'BLOCKED', `${combined.violations.length} reasons`)
check('   amount checks still PASS', combined.checks.find(c => c.rule === 'Maximum Price').passed === true)
check('   every violation has a sentence', combined.violations.every(v => v.length > 10 && v.endsWith('.')))

log('')
log('=== PART 12: x402 GATE (no payment) ===')
const gate = await post('/api/x402/verify-mandate', { policyId: p.id, order: baseOrder })
check('unpaid request returns 402', gate.status === 402, `HTTP ${gate.status}`)
check('payment-required header present', Boolean(gate.headers.get('payment-required')))
const challenge = JSON.parse(Buffer.from(gate.headers.get('payment-required'), 'base64').toString())
check('challenge asset is TestNet USDC', challenge.accepts[0].asset === '10458941')
check('challenge amount is 5000 micro (0.005)', challenge.accepts[0].amount === '5000')
check('challenge network is Algorand TestNet', challenge.accepts[0].network.startsWith('algorand:SGO1'))
const before = (await get('/api/audit')).json.entries.length
const gate2 = await post('/api/x402/verify-mandate', { policyId: p.id, order: baseOrder })
const after = (await get('/api/audit')).json.entries.length
check('MandateGuard did NOT run on unpaid request', before === after, `${before} -> ${after} audit rows`)
check('invalid payment proof still 402', gate2.status === 402)

log('')
log(`RESULT: ${pass} passed, ${fail} failed`)

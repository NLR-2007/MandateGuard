const API = 'http://localhost:4021'
let pass = 0, fail = 0
const log = console.log
const check = (n, ok, d = '') => { ok ? (pass++, log(`  PASS  ${n}${d?' — '+d:''}`)) : (fail++, log(`  FAIL  ${n}${d?' — '+d:''}`)) }
const post = async (p, b) => { const r = await fetch(API+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}); return { status:r.status, json: await r.json().catch(()=>null) } }
const get = async (p) => { const r = await fetch(API+p); return { status:r.status, json: await r.json().catch(()=>null) } }

const basePolicy = { product:'1TB SSD', quantity:1, maxPrice:5000, approvedSeller:'SecureStore',
  warrantyAllowed:false, approvedReceiverWallet:'ALGO-SECURE-STORE',
  perTransactionLimit:5000, dailyLimit:10000, expiresAt:'2030-12-31T23:59' }
const order = (patch={}) => ({ orderId:'QA', product:'1TB SSD', quantity:1, price:4800,
  seller:'SecureStore', warrantyAdded:false, receiverWallet:'ALGO-SECURE-STORE', ...patch })

await post('/api/demo/reset', {})

log('=== PART 22/20: EXECUTION, DUPLICATE, REPLAY ===')
const p1 = (await post('/api/policies', { ...basePolicy, requestId:'REQ-QA' })).json.policy
const v1 = (await post('/api/verify-mandate', { requestId:'REQ-QA', policyId:p1.id, order:order({orderId:'O-1'}) })).json
check('safe order APPROVED', v1.decision === 'APPROVED')

const e1 = await post('/api/executions', { verificationId: v1.verificationId })
check('execution recorded', e1.json.success === true, `spentToday ${e1.json.spentToday}`)
check('mandate now USED (replay protection armed)', e1.json.mandateStatus === 'USED')

const e2 = await post('/api/executions', { verificationId: v1.verificationId })
check('duplicate execution refused', e2.status === 409 && e2.json.success === false, e2.json.error)
const spend1 = (await get('/api/system/status')).json.spend
check('daily spend did NOT double', spend1.spentToday === 4800, `spentToday ${spend1.spentToday}`)

const v2 = (await post('/api/verify-mandate', { requestId:'REQ-QA', policyId:p1.id, order:order({orderId:'O-2'}) })).json
const e3 = await post('/api/executions', { verificationId: v2.verificationId })
check('replay on used mandate refused', e3.json.success === false, e3.json.error)
check('reason mentions the mandate', /already been used/i.test(e3.json.error))

log('')
log('=== PART 23: DAILY LIMIT ===')
await post('/api/demo/reset', {})
const p2 = (await post('/api/policies', basePolicy)).json.policy
// Execute 7000 first (two orders: 4000 + 3000) using separate policies so the mandate is not the blocker.
const p3 = (await post('/api/policies', basePolicy)).json.policy
const a = (await post('/api/verify-mandate', { policyId:p2.id, order:order({orderId:'O-A', price:4000}) })).json
await post('/api/executions', { verificationId: a.verificationId })
const b = (await post('/api/verify-mandate', { policyId:p3.id, order:order({orderId:'O-B', price:3000}) })).json
await post('/api/executions', { verificationId: b.verificationId })
const spend2 = (await get('/api/system/status')).json.spend
check('spent today is 7000', spend2.spentToday === 7000, JSON.stringify(spend2))

const p4 = (await post('/api/policies', basePolicy)).json.policy
const c = (await post('/api/verify-mandate', { policyId:p4.id, order:order({orderId:'O-C', price:4000}) })).json
check('6. daily limit exceeded -> BLOCKED', c.decision === 'BLOCKED', `projected ${c.checks.find(x=>x.rule==='Daily Limit').actual}`)
check('   reason shown', c.violations.includes('Daily spending limit would be exceeded.'))

log('')
log('=== PART 24/25: AUDIT + TRANSACTION DETAIL ===')
const audit = (await get('/api/audit')).json
const row = audit.entries[0]
const fields = ['verificationId','policyId','orderId','product','amount','seller','decision','violations',
  'checkedAt','executionStatus','x402PaymentStatus','x402TransactionId','mandateStatus','requestId']
check('audit row has every required field', fields.every(f => f in row), fields.filter(f=>!(f in row)).join(',') || 'all present')

const detail = await get(`/api/audit/${audit.entries.at(-1).verificationId}`)
check('transaction detail endpoint works', detail.json.success === true)
check('detail includes a timeline', Array.isArray(detail.json.timeline))

log('')
log('=== PART 34: DEMO RESET ===')
const reset = await post('/api/demo/reset', {})
const after = (await get('/api/system/status')).json
check('reset clears counts', after.counts.verifications === 0 && after.counts.policies === 0)
check('reset clears daily spend', after.spend.spentToday === 0)
check('reset does not claim to touch the chain', /permanent/i.test(reset.json.note))

log('')
log(`RESULT: ${pass} passed, ${fail} failed`)

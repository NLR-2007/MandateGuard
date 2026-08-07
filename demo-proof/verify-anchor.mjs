#!/usr/bin/env node
//
// Independent proof that a policy really is anchored on Algorand TestNet.
//
//   node demo-proof/verify-anchor.mjs MG-1001
//
// This script deliberately does NOT trust MandateGuard's answer. It:
//   1. reads the policy from the API,
//   2. recomputes the SHA-256 fingerprint here, with its own copy of the rule,
//   3. reads the transaction straight from a public Algorand indexer,
//   4. compares all three.
//
// A judge can run this. If we had faked anything, step 4 would fail.

import { createHash } from 'node:crypto'

const API = process.env.MG_API ?? 'http://localhost:4021'
const INDEXER = 'https://testnet-idx.algonode.cloud'
const mandateId = process.argv[2] ?? 'MG-1001'

const pass = (m) => console.log(`  ✓ ${m}`)
const fail = (m) => { console.log(`  ✗ ${m}`); process.exitCode = 1 }

// Note: this script sets process.exitCode and returns. It never calls
// process.exit(), which on Windows can abort the process while a network
// socket is still open.

// Our own copy of the canonical form documented in README.md.
function fingerprint(policy) {
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
  const text = JSON.stringify(canonical, Object.keys(canonical).sort())
  return createHash('sha256').update(text).digest('hex')
}

async function main() {
console.log(`\nIndependent anchor check for ${mandateId}`)
console.log('='.repeat(56))

// ── 1. the policy, from the API ───────────────────────────
const policyRes = await fetch(`${API}/api/policies/${mandateId}`)
if (!policyRes.ok) {
  fail(`No policy ${mandateId} (is the server running?)`)
  return
}
const { policy } = await policyRes.json()
pass(`policy found: ${policy.quantity} x ${policy.product} from ${policy.approvedSeller}`)

// ── 2. our own fingerprint ────────────────────────────────
const mine = fingerprint(policy)
console.log(`\n  computed here : ${mine}`)

// ── 3. what the server claims ─────────────────────────────
const status = await (await fetch(`${API}/api/mandates/${mandateId}/anchor`)).json()
console.log(`  server says   : ${status.mandateHash}`)

if (mine === status.mandateHash) pass('fingerprints agree — the server did not invent one')
else fail('FINGERPRINT MISMATCH — the server is not hashing the policy it showed us')

if (!status.anchored) {
  console.log('\n  This policy is not anchored yet.')
  console.log('  Dashboard → step 4 → "Write proof to Algorand".')
  return
}

// ── 4. the chain itself, read directly ────────────────────
const txId = status.anchor.txId
console.log(`\n  reading Algorand TestNet directly: ${txId}`)

const chainRes = await fetch(`${INDEXER}/v2/transactions/${txId}`)
if (!chainRes.ok) {
  fail(`the indexer has no transaction ${txId}`)
  return
}

const { transaction } = await chainRes.json()
const noteOnChain = Buffer.from(transaction.note ?? '', 'base64').toString('utf8')

console.log(`  note on chain : ${noteOnChain}`)
console.log(`  expected      : MG1:${mine}`)

if (noteOnChain === `MG1:${mine}`) pass('the chain carries exactly this policy’s fingerprint')
else fail('the note on chain does not match this policy')

pass(`confirmed in block ${transaction['confirmed-round']} at ${new Date(transaction['round-time'] * 1000).toISOString()}`)
pass(`signed by ${transaction.sender}`)

console.log(`\n  Explorer: https://lora.algokit.io/testnet/transaction/${txId}`)
console.log('='.repeat(56))
console.log(process.exitCode ? '\nFAILED\n' : '\nAll checks passed.\n')

}

await main()
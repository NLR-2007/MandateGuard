/**
 * Optional live check against the real NVIDIA NIM API.
 *
 *   npm run test:nim
 *
 * This one DOES spend API credits, so run it only when you need to confirm
 * the key and model work. The normal `npm test` never touches the network.
 */

import { demoCatalog } from '../src/data/demoCatalog.js'
import { prepareAiOrder } from '../src/services/aiOrderAgent.js'
import { verifyMandate } from '../src/services/mandateVerifier.js'
import { getModelName, isNimConfigured } from '../src/services/nimClient.js'
import { parseHumanInstruction } from '../src/services/policyParser.js'
import type { SpendingPolicy } from '../src/types/index.js'

const line = (s = '') => console.log(s)

async function main() {
  if (!isNimConfigured()) {
    line('NVIDIA NIM is not configured.')
    line('Copy .env.example to .env and fill in NVIDIA_API_KEY / NVIDIA_MODEL.')
    process.exit(1)
  }

  line('═'.repeat(60))
  line(`  LIVE NVIDIA NIM CHECK — model: ${getModelName()}`)
  line('═'.repeat(60))

  // ── 1. natural language -> draft policy ────────────────
  const instruction =
    'Buy one 1TB SSD below ₹5000 from SecureStore. No warranty. ' +
    'Only pay ALGO-SECURE-STORE. Maximum ₹5000 per transaction. Daily limit ₹10000.'

  line('\n[1] Instruction sent to NIM:')
  line(`    "${instruction}"`)

  const parsed = await parseHumanInstruction(instruction)
  line('\n    Draft returned:')
  line(JSON.stringify(parsed.draft, null, 6))
  line(`    missing fields: ${JSON.stringify(parsed.missingFields)}`)
  if (parsed.warnings.length) line(`    warnings: ${JSON.stringify(parsed.warnings)}`)

  // ── 2. no-invention check ──────────────────────────────
  line('\n[2] No-invention check — "Buy an SSD below 5000." (nothing else stated)')
  const vague = await parseHumanInstruction('Buy an SSD below 5000.')
  line(`    approvedSeller: ${vague.draft.approvedSeller}`)
  line(`    approvedReceiverWallet: ${vague.draft.approvedReceiverWallet}`)
  line(`    dailyLimit: ${vague.draft.dailyLimit}`)
  const invented =
    vague.draft.approvedSeller !== null ||
    vague.draft.approvedReceiverWallet !== null ||
    vague.draft.dailyLimit !== null
  line(`    -> ${invented ? '⚠ MODEL INVENTED SOMETHING' : '✓ nothing invented'}`)

  // ── 3. AI order from the demo catalog ──────────────────
  const policy: SpendingPolicy = {
    id: 'MG-LIVE-TEST',
    product: parsed.draft.product ?? '1TB SSD',
    quantity: parsed.draft.quantity ?? 1,
    maxPrice: parsed.draft.maxPrice ?? 5000,
    approvedSeller: parsed.draft.approvedSeller ?? 'SecureStore',
    warrantyAllowed: parsed.draft.warrantyAllowed ?? false,
    approvedReceiverWallet: parsed.draft.approvedReceiverWallet ?? 'ALGO-SECURE-STORE',
    perTransactionLimit: parsed.draft.perTransactionLimit ?? 5000,
    dailyLimit: parsed.draft.dailyLimit ?? 10000,
    expiresAt: '2030-12-31T23:59:00.000Z',
    status: 'ACTIVE',
  }

  line(`\n[3] Asking NIM to choose from ${demoCatalog.length} catalog items…`)
  const prepared = await prepareAiOrder(policy)
  line(`    chose ${prepared.catalogId}: ${JSON.stringify(prepared.order)}`)
  line(`    reason: ${prepared.reason}`)

  // ── 4. MandateGuard has the final word ─────────────────
  const decision = verifyMandate(policy, prepared.order)
  line(`\n[4] MandateGuard decision: ${decision.decision}`)
  decision.violations.forEach((v) => line(`      ✕ ${v}`))

  line('\n' + '═'.repeat(60))
  line('  Live check finished. The decision above came from TypeScript,')
  line('  not from the model.')
  line('═'.repeat(60))
}

main().catch((error) => {
  console.error('\nLive NIM check failed:', (error as Error).message)
  process.exit(1)
})

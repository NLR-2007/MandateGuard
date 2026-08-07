// x402 client - Phase 6
//
// Wraps fetch so that a 402 answer automatically turns into:
//   read payment requirements -> build Algorand TestNet payment ->
//   wallet signs -> retry the same request with the payment proof.
//
// The wallet signs in its own UI. This file never sees a private key,
// a mnemonic or a seed phrase.

import { ExactAvmScheme } from '@x402-avm/avm/exact/client'
import { ALGORAND_TESTNET_CAIP2, type ClientAvmSigner } from '@x402-avm/avm'
import { wrapFetchWithPayment, x402Client } from '@x402-avm/fetch'
import { API_BASE } from './api'
import type { AIOrder, OrderSource, PolicySource, VerificationResult } from '../types'

/** Stages shown in the UI while the payment happens. */
export type PaymentStage =
  | 'idle'
  | 'requesting'
  | 'payment-required'
  | 'awaiting-wallet'
  | 'payment-submitted'
  | 'verifying-payment'
  | 'running-mandateguard'
  | 'done'
  | 'failed'

export const STAGE_LABELS: Record<PaymentStage, string> = {
  idle: 'Ready',
  requesting: '1. Requesting Verification',
  'payment-required': '2. Payment Required',
  'awaiting-wallet': '3. Waiting for Wallet Approval',
  'payment-submitted': '4. Payment Submitted',
  'verifying-payment': '5. Verifying Payment',
  'running-mandateguard': '6. Running MandateGuard',
  done: '7. Result Ready',
  failed: 'Stopped',
}

/** What the wallet gives us. Only a public address plus a signing callback. */
export interface WalletSigner {
  address: string
  signTransactions: (txns: Uint8Array[]) => Promise<(Uint8Array | null)[]>
}

/** Payment details returned by the backend after settlement. */
export interface PaymentProof {
  protocol: string
  network: string
  status: string
  amount: string
  asset: string
  transactionId: string | null
  payer: string | null
  explorerUrl: string | null
  verifiedAt: string
}

export interface MandateProofInfo {
  mandateId: string
  mandateHash: string
  status: string
  storage: string
  /** True only when the fingerprint is confirmed on Algorand TestNet. */
  onChain: boolean
  anchorTxId: string | null
  anchorExplorerUrl: string | null
  note: string
}

export interface PaidVerificationResult extends VerificationResult {
  payment: PaymentProof
  mandate: MandateProofInfo
}

/**
 * Builds a fetch that understands 402.
 *
 * The wallet returns a mixed array like [null, signedBytes] where null means
 * "I did not sign this one". Those slots must keep the ORIGINAL bytes and stay
 * in position, otherwise the transaction group breaks.
 */
function createX402Fetch(wallet: WalletSigner, onStage: (s: PaymentStage) => void) {
  const client = new x402Client()
  let originalTxns: Uint8Array[] = []

  const signer: ClientAvmSigner = {
    address: wallet.address,
    signTransactions: async (txns: Uint8Array[]) => {
      originalTxns = txns
      onStage('awaiting-wallet')

      const walletResult = await wallet.signTransactions(txns)

      onStage('payment-submitted')

      if (!Array.isArray(walletResult)) return walletResult

      return walletResult.map((item: unknown, i: number) => {
        if (item === null || item === undefined) return originalTxns[i]
        if (item instanceof Uint8Array) return item
        if (typeof item === 'string') {
          const binary = atob(item)
          const bytes = new Uint8Array(binary.length)
          for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j)
          return bytes
        }
        return originalTxns[i]
      })
    },
  }

  client.register(ALGORAND_TESTNET_CAIP2, new ExactAvmScheme(signer))

  return wrapFetchWithPayment(fetch, client)
}

/** Turns a wallet/network failure into a short sentence for the UI. */
export function describePaymentError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)

  if (/reject|denied|cancel|declined|closed/i.test(message)) {
    return 'Payment cancelled. Nothing was sent and MandateGuard did not run.'
  }
  if (/insufficient|overspend|underflow|balance/i.test(message)) {
    return 'Your TestNet wallet needs enough ALGO for transaction fees and Test USDC for the x402 payment.'
  }
  if (/asset.*opt|must optin|not opted/i.test(message)) {
    return 'This account has not opted in to Test USDC (asset 10458941). Add it in your wallet first.'
  }
  if (/facilitator|502|503|gateway/i.test(message)) {
    return 'The payment facilitator is unavailable right now. Please try again in a moment.'
  }
  if (/timeout|timed out/i.test(message)) {
    return 'The payment timed out. No result was produced.'
  }
  if (/network|fetch|Failed to fetch/i.test(message)) {
    return 'Cannot reach the MandateGuard server or the Algorand network.'
  }
  return message
}

/**
 * The full paid flow. Returns the MandateGuard decision AND the payment proof,
 * which are two separate answers.
 */
export async function verifyWithX402(params: {
  policyId: string
  order: AIOrder
  wallet: WalletSigner
  policySource: PolicySource
  orderSource: OrderSource
  onStage: (stage: PaymentStage) => void
}): Promise<PaidVerificationResult> {
  const { policyId, order, wallet, policySource, orderSource, onStage } = params

  onStage('requesting')

  const fetchWithPayment = createX402Fetch(wallet, onStage)

  // A single call drives the whole protocol: 402 -> sign -> retry.
  onStage('payment-required')

  const response = await fetchWithPayment(`${API_BASE}/api/x402/verify-mandate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json'
},
    body: JSON.stringify({ policyId, order, policySource, orderSource }),
  })

  onStage('verifying-payment')

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const message =
      (body as { error?: string; errors?: string[] } | null)?.errors?.join(' ') ??
      (body as { error?: string } | null)?.error ??
      `Payment or verification failed (HTTP ${response.status}).`
    throw new Error(message)
  }

  onStage('running-mandateguard')

  const data = (await response.json()) as PaidVerificationResult

  onStage('done')
  return data
}

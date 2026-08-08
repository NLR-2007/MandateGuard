// Paying for an order, from the browser.
//
// NovaMart never holds your money. When you press pay, the shop asks the
// seller's endpoint for the goods, gets an HTTP 402 back, and your wallet
// signs a Test USDC transfer straight to the seller. The shop only watches.
//
// No private key, mnemonic or seed phrase ever reaches this file. The wallet
// signs in its own window.

import { ExactAvmScheme } from '@x402-avm/avm/exact/client'
import { ALGORAND_TESTNET_CAIP2, type ClientAvmSigner } from '@x402-avm/avm'
import { wrapFetchWithPayment, x402Client } from '@x402-avm/fetch'

const GUARD = import.meta.env.VITE_GUARD_API ?? 'http://localhost:4021'

export type PayStage =
  | 'idle'
  | 'asking'
  | 'payment-required'
  | 'awaiting-wallet'
  | 'submitting'
  | 'confirming'
  | 'done'
  | 'failed'

export const PAY_LABEL: Record<PayStage, string> = {
  idle: 'Ready',
  asking: 'Contacting the seller',
  'payment-required': 'Payment requested',
  'awaiting-wallet': 'Approve in your wallet',
  submitting: 'Sending payment',
  confirming: 'Waiting for Algorand',
  done: 'Paid',
  failed: 'Stopped',
}

export interface WalletSigner {
  address: string
  signTransactions: (txns: Uint8Array[]) => Promise<(Uint8Array | null)[]>
}

export interface Receipt {
  orderId: string
  item: { id: string; product: string; price: number; seller: string }
  payment: {
    amountRupees: number
    amountUsdc: number
    seller: string
    sellerWallet: string
    transactionId: string | null
    explorerUrl: string | null
    demoRate: string
    status: string
    paidAt: string
  }
}

/**
 * The wallet hands back a mixed array like [null, signedBytes], where null
 * means "I did not sign that one". Those slots must keep the ORIGINAL bytes
 * and stay in position, or the transaction group breaks.
 */
function buildPayingFetch(wallet: WalletSigner, onStage: (s: PayStage) => void) {
  const client = new x402Client()
  let originals: Uint8Array[] = []

  const signer: ClientAvmSigner = {
    address: wallet.address,
    signTransactions: async (txns: Uint8Array[]) => {
      originals = txns
      onStage('awaiting-wallet')
      const result = await wallet.signTransactions(txns)
      onStage('submitting')

      if (!Array.isArray(result)) return result

      return result.map((item: unknown, i: number) => {
        if (item === null || item === undefined) return originals[i]
        if (item instanceof Uint8Array) return item
        if (typeof item === 'string') {
          const binary = atob(item)
          const bytes = new Uint8Array(binary.length)
          for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j)
          return bytes
        }
        return originals[i]
      })
    },
  }

  client.register(ALGORAND_TESTNET_CAIP2, new ExactAvmScheme(signer))
  return wrapFetchWithPayment(fetch, client)
}

/** Buys one item. The server prices it; the browser only names it. */
export async function payForItem(params: {
  itemId: string
  policyId: string | null
  wallet: WalletSigner
  onStage: (stage: PayStage) => void
}): Promise<Receipt> {
  const { itemId, policyId, wallet, onStage } = params

  onStage('asking')
  const payingFetch = buildPayingFetch(wallet, onStage)

  onStage('payment-required')
  const response = await payingFetch(
    `${GUARD}/api/shop/buy?item=${encodeURIComponent(itemId)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mandateId: policyId }),
    },
  )

  onStage('confirming')

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `The payment did not go through (HTTP ${response.status}).`)
  }

  onStage('done')
  return (await response.json()) as Receipt
}

/** Turns a wallet or network failure into one plain sentence. */
export function describePayError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)

  if (/reject|denied|cancel|declined|closed/i.test(message)) {
    return 'You cancelled the payment. Nothing was charged.'
  }
  if (/insufficient|overspend|underflow|balance/i.test(message)) {
    return 'Your wallet does not have enough Test USDC for this order.'
  }
  if (/opt|not opted/i.test(message)) {
    return 'This wallet has not opted in to Test USDC (asset 10458941). Add it in your wallet first.'
  }
  if (/facilitator|502|503|gateway/i.test(message)) {
    return 'The payment network is busy right now. Please try again in a moment.'
  }
  if (/network|fetch|Failed to fetch/i.test(message)) {
    return 'Cannot reach the seller or the Algorand network.'
  }
  return message
}

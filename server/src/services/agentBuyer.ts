// The agent paying for itself.
//
// Same x402 protocol the browser uses, driven from the server with the
// agent's own key instead of a wallet popup. It calls our own /api/shop/buy,
// gets the 402 challenge, signs the payment and retries - which is exactly
// what a browser does, minus the human.
//
// ⚠️ Nothing may call this that MandateGuard has not already approved. The
// signer will sign whatever it is handed; the engine is the control, not this
// file.

import { ExactAvmScheme } from '@x402/avm/exact/client'
import { ALGORAND_TESTNET_CAIP2, type ClientAvmSigner } from '@x402/avm'
import { wrapFetchWithPayment, x402Client } from '@x402/fetch'
import { getAgentAccount, signAsAgent } from './agentWallet.js'

const SELF = `http://localhost:${4021}`

export interface AgentPurchase {
  orderId: string
  item: { id: string; product: string; price: number; seller: string }
  payment: {
    amountRupees: number
    amountUsdc: number
    seller: string
    sellerWallet: string
    transactionId: string | null
    explorerUrl: string | null
    status: string
  }
}

/**
 * Buys one catalogue item, paid by the agent itself.
 *
 * The x402 flow is unchanged: request, 402, sign, retry. Only the signer is
 * different - a key held by this process rather than a wallet held by a person.
 */
export async function agentBuys(params: {
  itemId: string
  verificationId?: string | null
  mandateId?: string | null
}): Promise<AgentPurchase> {
  const { itemId, verificationId, mandateId } = params
  const account = getAgentAccount()

  const client = new x402Client()

  const signer: ClientAvmSigner = {
    address: account.address,
    signTransactions: async (txns: Uint8Array[]) => signAsAgent(txns),
  }

  client.register(ALGORAND_TESTNET_CAIP2, new ExactAvmScheme(signer))
  const fetchWithPayment = wrapFetchWithPayment(fetch, client)

  const response = await fetchWithPayment(
    `${SELF}/api/shop/buy?item=${encodeURIComponent(itemId)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verificationId, mandateId }),
    },
  )

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `The agent could not pay (HTTP ${response.status}).`)
  }

  return (await response.json()) as AgentPurchase
}

// The agent's own wallet.
//
// Why this exists: an agent that needs a human to tap "sign" in a browser is
// not autonomous. Real agents hold their own limited budget. This is that
// budget - a dedicated Algorand TestNet account, funded with a small amount,
// that the agent can spend from without anyone present.
//
// ⚠️ SCOPE, stated plainly:
//   - This is NOT the user's personal wallet, and this file never touches it.
//   - TestNet only. There is no MainNet path anywhere in this project.
//   - The mnemonic lives in server/.env, which is gitignored, and is never
//     logged, never returned by an endpoint and never sent to the frontend.
//
// The safety story is not "the key is hidden". It is that MandateGuard decides
// what this account is allowed to buy. The key can sign anything; the engine
// is what stops it signing the wrong thing.

import algosdk from 'algosdk'

const ALGOD = 'https://testnet-api.algonode.cloud'
const USDC_ASSET = 10458941

export interface AgentAccount {
  address: string
  signer: algosdk.Account
}

let cached: AgentAccount | null = null

export function isAgentWalletConfigured(): boolean {
  return Boolean(process.env.AGENT_MNEMONIC?.trim())
}

/** Loads the agent account from the environment. Throws if absent. */
export function getAgentAccount(): AgentAccount {
  if (cached) return cached

  const mnemonic = process.env.AGENT_MNEMONIC?.trim()
  if (!mnemonic) {
    throw new Error('AGENT_MNEMONIC is required for the agent to pay on its own.')
  }

  const account = algosdk.mnemonicToSecretKey(mnemonic)
  cached = { address: account.addr.toString(), signer: account }
  return cached
}

/** Public address only. Safe for /health and the UI. */
export function agentAddress(): string | null {
  try {
    return isAgentWalletConfigured() ? getAgentAccount().address : null
  } catch {
    return null
  }
}

export interface AgentBalance {
  algo: number
  usdc: number | null
  optedIn: boolean
  /** False when the account has never been funded, so it does not exist yet. */
  exists: boolean
}

/** Reads the agent's balance from a public node. Read only. */
export async function getAgentBalance(): Promise<AgentBalance | null> {
  const address = agentAddress()
  if (!address) return null

  try {
    const res = await fetch(`${ALGOD}/v2/accounts/${address}`)
    if (!res.ok) {
      return { algo: 0, usdc: null, optedIn: false, exists: false }
    }

    const body = (await res.json()) as {
      amount?: number
      assets?: { 'asset-id': number; amount: number }[]
    }
    const usdc = (body.assets ?? []).find((a) => Number(a['asset-id']) === USDC_ASSET)

    return {
      algo: (body.amount ?? 0) / 1e6,
      usdc: usdc ? usdc.amount / 1e6 : null,
      optedIn: Boolean(usdc),
      exists: true,
    }
  } catch {
    return null
  }
}

/**
 * Signs a group of transactions as the agent.
 *
 * This is the whole point of the file, and the only place the key is used.
 * It signs whatever it is given - which is exactly why nothing may reach here
 * that MandateGuard has not already approved.
 */
export function signAsAgent(txns: Uint8Array[]): Uint8Array[] {
  const { signer } = getAgentAccount()

  return txns.map((encoded) => {
    const txn = algosdk.decodeUnsignedTransaction(encoded)
    return txn.signTxn(signer.sk)
  })
}

/** A short summary for the status endpoints. Never includes the key. */
export async function describeAgentWallet(): Promise<{
  configured: boolean
  address: string | null
  balance: AgentBalance | null
  ready: boolean
  note: string
}> {
  const address = agentAddress()
  if (!address) {
    return {
      configured: false,
      address: null,
      balance: null,
      ready: false,
      note: 'AGENT_MNEMONIC is not set, so the agent cannot pay on its own.',
    }
  }

  const balance = await getAgentBalance()

  if (!balance?.exists) {
    return {
      configured: true,
      address,
      balance,
      ready: false,
      note: 'The agent wallet has no ALGO yet. Send it a little TestNet ALGO to activate it.',
    }
  }
  if (!balance.optedIn) {
    return {
      configured: true,
      address,
      balance,
      ready: false,
      note: `The agent wallet has not opted in to Test USDC (asset ${USDC_ASSET}).`,
    }
  }

  return {
    configured: true,
    address,
    balance,
    ready: (balance.usdc ?? 0) > 0,
    note:
      (balance.usdc ?? 0) > 0
        ? 'Ready. The agent can buy on its own, within whatever MandateGuard allows.'
        : 'Opted in, but the agent has no Test USDC to spend yet.',
  }
}

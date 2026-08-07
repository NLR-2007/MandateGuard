// x402 configuration - Phase 6
//
// x402 is the PAYMENT layer only. It decides whether the caller has paid the
// small API fee. It never decides whether an order is safe - that stays with
// mandateVerifier.ts.
//
// Algorand TestNet only. No MainNet. No private keys are ever read here:
// AVM_ADDRESS is a public receiving address.

import { ALGORAND_TESTNET_CAIP2, USDC_TESTNET_ASA_ID } from '@x402/avm'

/** Price of one MandateGuard verification call. */
export const VERIFICATION_PRICE = '$0.005'

export const PROTECTED_ROUTE = 'POST /api/x402/verify-mandate'

export const NETWORK_LABEL = 'Algorand TestNet'

/** Explorer used for the "View on Algorand Explorer" link. */
export function explorerTxUrl(txId: string): string {
  return `https://lora.algokit.io/testnet/transaction/${txId}`
}

export interface X402Config {
  avmAddress: string
  facilitatorUrl: string
  network: string
  usdcAssetId: number
  enabled: boolean
}

let cached: X402Config | null = null

/** True only when the receiving address is configured. */
export function isX402Configured(): boolean {
  return Boolean(process.env.AVM_ADDRESS?.trim())
}

/**
 * Reads x402 settings from the environment.
 * Throws with a clear message when AVM_ADDRESS is missing.
 */
export function getX402Config(): X402Config {
  if (cached) return cached

  const avmAddress = process.env.AVM_ADDRESS?.trim()

  if (!avmAddress) {
    throw new Error('AVM_ADDRESS is required for x402 payments.')
  }

  const network = process.env.ALGORAND_NETWORK?.trim() || 'testnet'
  if (network !== 'testnet') {
    throw new Error(
      `Only Algorand TestNet is supported in this project (got "${network}").`,
    )
  }

  cached = {
    avmAddress,
    facilitatorUrl:
      process.env.FACILITATOR_URL?.trim() || 'https://facilitator.goplausible.xyz',
    network: ALGORAND_TESTNET_CAIP2,
    usdcAssetId: Number(USDC_TESTNET_ASA_ID),
    enabled: true,
  }

  return cached
}

/** Safe summary for /health and the UI. Contains no secrets. */
export function describeX402(): {
  enabled: boolean
  network: string
  price: string
  asset: string
  assetId: number | null
  receiver: string | null
  facilitator: string | null
} {
  if (!isX402Configured()) {
    return {
      enabled: false,
      network: NETWORK_LABEL,
      price: VERIFICATION_PRICE,
      asset: 'Test USDC',
      assetId: null,
      receiver: null,
      facilitator: null,
    }
  }

  const config = getX402Config()
  return {
    enabled: true,
    network: NETWORK_LABEL,
    price: VERIFICATION_PRICE,
    asset: 'Test USDC',
    assetId: config.usdcAssetId,
    // A public address - safe to show. Never a key.
    receiver: config.avmAddress,
    facilitator: config.facilitatorUrl,
  }
}

/** The route -> price table handed to the x402 middleware. */
export function createPaymentConfig() {
  const config = getX402Config()

  return {
    [PROTECTED_ROUTE]: {
      accepts: [
        {
          scheme: 'exact' as const,
          price: VERIFICATION_PRICE,
          network: config.network,
          payTo: config.avmAddress,
          extra: { asset: config.usdcAssetId },
        },
      ],
      description: 'MandateGuard AI spending policy verification',
    },
  }
}

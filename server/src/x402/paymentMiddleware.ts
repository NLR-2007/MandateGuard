// Wires the x402 payment middleware onto our Hono app.
//
// IMPORTANT: the middleware runs BEFORE the handler. If payment is missing or
// invalid, the request stops at 402/4xx and the MandateGuard handler never runs.

import { ALGORAND_TESTNET_CAIP2 } from '@x402/avm'
import { ExactAvmScheme } from '@x402/avm/exact/server'
import { HTTPFacilitatorClient, x402ResourceServer } from '@x402/core/server'
import { paymentMiddleware } from '@x402/hono'
import type { MiddlewareHandler } from 'hono'
import { createPaymentConfig, getX402Config } from './x402Config.js'

/**
 * Builds the x402 middleware for the protected route.
 * Call only when isX402Configured() is true.
 */
export function createX402Middleware(): MiddlewareHandler {
  const config = getX402Config()

  const facilitatorClient = new HTTPFacilitatorClient({ url: config.facilitatorUrl })

  const resourceServer = new x402ResourceServer(facilitatorClient).register(
    ALGORAND_TESTNET_CAIP2,
    new ExactAvmScheme(),
  )

  const paymentConfig = createPaymentConfig()

  return paymentMiddleware(paymentConfig as never, resourceServer) as MiddlewareHandler
}

/** Details the facilitator returns after a payment settles. */
export interface SettlementInfo {
  success: boolean
  transaction: string | null
  network: string | null
  payer: string | null
}

/**
 * Reads the PAYMENT-RESPONSE header the x402 middleware puts on the response.
 * It is base64 JSON: { success, transaction, network, payer }.
 *
 * We never invent these values - if the header is absent we return null.
 */
export function readSettlement(headerValue: string | null): SettlementInfo | null {
  if (!headerValue) return null

  try {
    const json = JSON.parse(Buffer.from(headerValue, 'base64').toString('utf8'))
    return {
      success: json.success === true,
      transaction:
        typeof json.transaction === 'string' && json.transaction !== ''
          ? json.transaction
          : null,
      network: typeof json.network === 'string' ? json.network : null,
      payer: typeof json.payer === 'string' ? json.payer : null,
    }
  } catch {
    return null
  }
}

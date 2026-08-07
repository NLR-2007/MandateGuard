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
 *
 * The inner middleware is wrapped so that a facilitator outage answers 503
 * instead of throwing. A payment problem must never take the whole service
 * down - MandateGuard, the AI and the free routes have to keep working.
 */
/**
 * One resource server for the whole process.
 *
 * It holds the facilitator connection and the registered payment scheme, so
 * building it per request would open a new connection every time.
 */
let sharedServer: x402ResourceServer | null = null

function resourceServerOnce(): x402ResourceServer {
  if (sharedServer) return sharedServer

  const config = getX402Config()
  const facilitatorClient = new HTTPFacilitatorClient({ url: config.facilitatorUrl })

  sharedServer = new x402ResourceServer(facilitatorClient).register(
    ALGORAND_TESTNET_CAIP2,
    new ExactAvmScheme(),
  )
  return sharedServer
}

/**
 * A payment gate whose price and recipient are decided per request.
 *
 * The verification fee is always the same, so its config is fixed. A purchase
 * is not: every product has its own price and its own seller wallet. This
 * builds the x402 config from whatever `configFor` returns, then hands over to
 * the normal middleware - so the protocol itself is unchanged.
 *
 * Returning null means "cannot price this request", and the caller answers.
 */
export function createDynamicX402Middleware(
  configFor: (c: Parameters<MiddlewareHandler>[0]) => unknown | null,
): MiddlewareHandler {
  return async (c, next) => {
    const config = configFor(c)

    if (!config) {
      return c.json(
        { success: false, error: 'This request cannot be priced, so it was not accepted.' },
        400,
      )
    }

    try {
      const inner = paymentMiddleware(config as never, resourceServerOnce()) as MiddlewareHandler
      return await inner(c, next)
    } catch (error) {
      console.error(`  ✕ x402 payment layer unavailable: ${(error as Error)?.message}`)
      return c.json(
        {
          success: false,
          error: 'The x402 payment service is unavailable right now. Nothing was paid.',
          detail: 'facilitator_unreachable',
        },
        503,
      )
    }
  }
}

export function createX402Middleware(): MiddlewareHandler {
  const resourceServer = resourceServerOnce()

  const paymentConfig = createPaymentConfig()
  const inner = paymentMiddleware(paymentConfig as never, resourceServer) as MiddlewareHandler

  return async (c, next) => {
    try {
      return await inner(c, next)
    } catch (error) {
      const message = (error as Error)?.message ?? 'unknown error'
      console.error(`  ✕ x402 payment layer unavailable: ${message}`)

      // No fake success, and the protected handler never runs.
      return c.json(
        {
          success: false,
          error:
            'The x402 payment service is unavailable right now. The verification could not be paid for, so it was not run.',
          detail: 'facilitator_unreachable',
        },
        503,
      )
    }
  }
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

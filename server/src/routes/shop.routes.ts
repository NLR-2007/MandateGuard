// The shop, and paying a seller for real.
//
// Two payments exist in this system and they are NOT the same thing:
//
//   1. the verification fee  - 0.005 USDC, paid to run MandateGuard
//   2. the purchase          - the product price, paid to the SELLER
//
// This file is the second one. It is a separate endpoint on purpose: the
// verification route already works and produced real transactions, and
// nothing here is allowed to disturb it.
//
// The purchase also goes over x402, because that is the payment rail this
// project is built on - the price and the recipient are simply decided per
// product instead of being fixed.

import { Hono } from 'hono'
import { demoCatalog, type CatalogItem } from '../data/demoCatalog.js'
import { findAudit, setPaymentProof } from '../services/auditService.js'
import { markMandateUsed } from '../services/mandateProof.js'
import { DEMO_RATE_NOTE, notifyPaid, rupeesToUsdc } from '../services/notifier.js'
import { createDynamicX402Middleware, readSettlement } from '../x402/paymentMiddleware.js'
import { explorerTxUrl, getX402Config, NETWORK_LABEL } from '../x402/x402Config.js'
import { ALGORAND_TESTNET_CAIP2 } from '@x402/avm'

export const shopRoutes = new Hono()

/** The whole catalogue, for the storefront. */
shopRoutes.get('/shop/products', (c) =>
  c.json({
    success: true,
    demoRate: DEMO_RATE_NOTE,
    products: demoCatalog.map((item) => ({
      ...item,
      priceUsdc: rupeesToUsdc(item.price),
    })),
  }),
)

function findItem(id: string | undefined): CatalogItem | null {
  if (!id) return null
  return demoCatalog.find((i) => i.id === id) ?? null
}

export function createShopRoutes(): Hono {
  const routes = new Hono()

  /**
   * Records the settled purchase after x402 finishes.
   *
   * Same reason as the verification route: x402 settles AFTER the handler
   * returns, so the transaction id does not exist while the handler runs.
   * Registered before the gate so it wraps it.
   */
  routes.use('/shop/buy', async (c, next) => {
    await next()

    const res = c.res
    if (!res || res.status !== 200) return

    const settlement = readSettlement(res.headers.get('PAYMENT-RESPONSE'))
    if (!settlement) return

    let body: Record<string, unknown>
    try {
      body = (await res.clone().json()) as Record<string, unknown>
    } catch {
      return
    }

    const payment = body.payment as Record<string, unknown> | undefined
    if (payment) {
      payment.transactionId = settlement.transaction
      payment.payer = settlement.payer
      payment.explorerUrl = settlement.transaction
        ? explorerTxUrl(settlement.transaction)
        : null
      payment.status = settlement.success ? 'PAID' : 'UNKNOWN'
    }

    // Complete the audit row that was written before settlement.
    const verificationId = body.verificationId
    if (typeof verificationId === 'string') {
      const entry = findAudit(verificationId)
      if (entry) {
        setPaymentProof(entry, {
          x402PaymentStatus: settlement.success ? 'VERIFIED' : 'UNKNOWN',
          x402TransactionId: settlement.transaction,
        })
      }
    }

    if (settlement.transaction) {
      console.log(`  🛒 Purchase settled on Algorand: ${settlement.transaction}`)
      console.log(`     ${explorerTxUrl(settlement.transaction)}`)
    }

    // Tell the user what was bought and prove it.
    const item = body.item as CatalogItem | undefined
    if (item) {
      notifyPaid({
        order: {
          orderId: String(body.orderId ?? ''),
          product: item.product,
          quantity: 1,
          price: item.price,
          seller: item.seller,
          warrantyAdded: false,
          receiverWallet: item.receiverWallet,
        },
        orderId: String(body.orderId ?? ''),
        txId: settlement.transaction,
        seller: item.seller,
        sellerWallet: item.receiverWallet,
      })
    }

    const headers = new Headers(res.headers)
    headers.delete('content-length')
    c.res = undefined
    c.res = new Response(JSON.stringify(body), { status: res.status, headers })
  })

  /**
   * PAYMENT GATE - priced per product.
   *
   * The item id comes from the query string rather than the body, so the
   * gate never has to read (and risk consuming) the request body. The client
   * cannot set the price: it names an item, and the server looks up what that
   * item actually costs.
   */
  routes.use(
    '/shop/buy',
    createDynamicX402Middleware((c) => {
      const item = findItem(c.req.query('item'))
      if (!item || !item.inStock) return null

      const config = getX402Config()

      return {
        'POST /api/shop/buy': {
          accepts: [
            {
              scheme: 'exact' as const,
              price: `$${rupeesToUsdc(item.price)}`,
              network: ALGORAND_TESTNET_CAIP2,
              // The seller's own TestNet wallet. Money genuinely goes there.
              payTo: item.receiverWallet,
              extra: { asset: config.usdcAssetId },
            },
          ],
          description: `Purchase ${item.product} from ${item.seller}`,
        },
      }
    }),
  )

  routes.post('/shop/buy', async (c) => {
    const item = findItem(c.req.query('item'))
    if (!item) {
      return c.json({ success: false, error: 'Unknown item.' }, 400)
    }

    const body = (await c.req.json().catch(() => ({}))) as {
      verificationId?: string
      mandateId?: string
    }

    console.log(`  🛒 Purchase paid: ${item.product} from ${item.seller}`)

    /**
     * The mandate is consumed HERE, not when the fee was paid.
     * Paying to check an order and actually buying something are different
     * events, and only the second one uses up the human's permission.
     */
    if (body.mandateId) markMandateUsed(body.mandateId)

    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`

    return c.json({
      success: true,
      orderId,
      verificationId: body.verificationId ?? null,
      item,
      payment: {
        protocol: 'x402',
        network: NETWORK_LABEL,
        // Filled in by the recorder above once Algorand confirms.
        status: 'PAID',
        amountRupees: item.price,
        amountUsdc: rupeesToUsdc(item.price),
        demoRate: DEMO_RATE_NOTE,
        seller: item.seller,
        sellerWallet: item.receiverWallet,
        transactionId: null,
        payer: null,
        explorerUrl: null,
        paidAt: new Date().toISOString(),
      },
    })
  })

  return routes
}

// The "AI shopping agent".
//
// It picks an item from the demo catalog and returns a proposed order.
// Its output is UNTRUSTED: it always goes to /api/verify-mandate, where the
// deterministic MandateGuard engine makes the real decision.

import { demoCatalog, type CatalogItem } from '../data/demoCatalog.js'
import type { AIOrder, SpendingPolicy } from '../types/index.js'
import { completeWithNim, extractJson, type CompleteFn } from './nimClient.js'

export const ORDER_SYSTEM_PROMPT = `You are a shopping agent.

Select one item from the provided catalog based on the user's approved policy.
Return structured JSON only.
Do not approve the transaction.
MandateGuard will independently verify your order.

Return exactly these keys:
catalogId (string - the id of the item you chose)
quantity (number)
warrantyAdded (boolean)
reason (one short sentence, maximum 20 words)

Do not include any other keys. Do not explain your thinking.`

export interface PreparedOrder {
  order: AIOrder
  reason: string
  catalogId: string
}

let orderCounter = 1000

function nextOrderId(): string {
  orderCounter += 1
  return `AI-ORDER-${orderCounter}`
}

/** Short policy summary - we send only what the agent needs. */
function describePolicy(policy: SpendingPolicy): string {
  return [
    `product: ${policy.product}`,
    `quantity: ${policy.quantity}`,
    `maxPrice: ${policy.maxPrice}`,
    `approvedSeller: ${policy.approvedSeller}`,
    `warrantyAllowed: ${policy.warrantyAllowed}`,
    `approvedReceiverWallet: ${policy.approvedReceiverWallet}`,
  ].join('\n')
}

function describeCatalog(items: CatalogItem[]): string {
  return items
    .map(
      (i) =>
        `${i.id} | ${i.product} | price ${i.price} | seller ${i.seller} | wallet ${i.receiverWallet}`,
    )
    .join('\n')
}

/**
 * Converts the model's choice into a real order object.
 * Price, seller and wallet always come from the catalog, never from the model,
 * so the agent cannot invent a price or a payment address.
 */
export function buildOrderFromChoice(
  raw: unknown,
  items: CatalogItem[] = demoCatalog,
): PreparedOrder {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('AI did not return a JSON object.')
  }

  const r = raw as Record<string, unknown>
  const catalogId = typeof r.catalogId === 'string' ? r.catalogId.trim() : ''
  const item = items.find((i) => i.id === catalogId)

  if (!item) {
    throw new Error('AI chose an item that is not in the catalog.')
  }

  const quantity =
    typeof r.quantity === 'number' && Number.isInteger(r.quantity) && r.quantity > 0
      ? r.quantity
      : 1

  const warrantyAdded = r.warrantyAdded === true

  const reason =
    typeof r.reason === 'string' && r.reason.trim() !== ''
      ? r.reason.trim().slice(0, 160)
      : 'Selected from the demo catalog.'

  return {
    catalogId: item.id,
    reason,
    order: {
      orderId: nextOrderId(),
      product: item.product,
      quantity,
      price: item.price,
      seller: item.seller,
      warrantyAdded,
      receiverWallet: item.receiverWallet,
    },
  }
}

/** Asks NVIDIA NIM to choose an item. `complete` is injectable for tests. */
export async function prepareAiOrder(
  policy: SpendingPolicy,
  complete: CompleteFn = completeWithNim,
  items: CatalogItem[] = demoCatalog,
): Promise<PreparedOrder> {
  const userPrompt = [
    'APPROVED POLICY:',
    describePolicy(policy),
    '',
    'CATALOG:',
    describeCatalog(items),
  ].join('\n')

  const reply = await complete(ORDER_SYSTEM_PROMPT, userPrompt, 200)
  return buildOrderFromChoice(extractJson(reply), items)
}

/** The controlled unsafe order for the security demo. No AI involved. */
export function buildSimulatedUnsafeOrder(template: {
  product: string
  quantity: number
  price: number
  seller: string
  warrantyAdded: boolean
  receiverWallet: string
}): AIOrder {
  return { orderId: `SIM-ORDER-${Date.now()}`, ...template }
}

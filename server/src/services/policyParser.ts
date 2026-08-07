// Turns a human sentence into a structured DRAFT policy.
//
// The result is only a draft. It never becomes an active policy on its own -
// a human must review it and press "Approve Policy" first.

import { completeWithNim, extractJson, type CompleteFn } from './nimClient.js'

/** Every field may be null: null means "the human did not say". */
export interface PolicyDraft {
  product: string | null
  quantity: number | null
  maxPrice: number | null
  approvedSeller: string | null
  warrantyAllowed: boolean | null
  approvedReceiverWallet: string | null
  perTransactionLimit: number | null
  dailyLimit: number | null
  validForMinutes: number | null
}

export interface ParseOutcome {
  draft: PolicyDraft
  missingFields: string[]
  warnings: string[]
}

export const POLICY_SYSTEM_PROMPT = `You convert human spending instructions into structured JSON.

Never invent important information.
If information is missing, return null for that field.
Do not approve payments.
Do not decide whether an order is safe.
Do not add sellers, prices, wallet addresses, products, quantities, limits, or permissions that the human did not state.
Return JSON only.

Use exactly these keys:
product (string or null)
quantity (number or null)
maxPrice (number or null)
approvedSeller (string or null)
warrantyAllowed (boolean or null)
approvedReceiverWallet (string or null)
perTransactionLimit (number or null)
dailyLimit (number or null)
validForMinutes (number or null)

Rules:
- Amounts are plain numbers with no currency symbol or commas.
- "no warranty" / "do not add warranty" means warrantyAllowed = false.
- "warranty allowed" means warrantyAllowed = true.
- If warranty is not mentioned at all, warrantyAllowed = null.
- "one" means quantity 1.
- Only set perTransactionLimit or dailyLimit when the human states such a limit.`

/** Fields a real MandateGuard policy cannot be created without. */
export const REQUIRED_FIELDS: (keyof PolicyDraft)[] = [
  'product',
  'quantity',
  'maxPrice',
  'approvedSeller',
  'warrantyAllowed',
  'approvedReceiverWallet',
  'perTransactionLimit',
  'dailyLimit',
]

const EMPTY_DRAFT: PolicyDraft = {
  product: null,
  quantity: null,
  maxPrice: null,
  approvedSeller: null,
  warrantyAllowed: null,
  approvedReceiverWallet: null,
  perTransactionLimit: null,
  dailyLimit: null,
  validForMinutes: null,
}

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed === '') return null
  // Models sometimes answer with these words instead of null.
  if (/^(null|none|n\/a|not specified|unspecified|unknown)$/i.test(trimmed)) return null
  return trimmed
}

function cleanNumber(value: unknown): { value: number | null; warning?: string } {
  if (value === null || value === undefined) return { value: null }

  let n: number
  if (typeof value === 'number') {
    n = value
  } else if (typeof value === 'string') {
    // Strip currency symbols, commas and spaces: "₹5,000" -> 5000
    const stripped = value.replace(/[^0-9.]/g, '')
    if (stripped === '') return { value: null }
    n = Number(stripped)
  } else {
    return { value: null, warning: 'A number field had an unexpected type and was ignored.' }
  }

  if (!Number.isFinite(n)) {
    return { value: null, warning: 'A number field was not a valid number and was ignored.' }
  }
  if (n < 0) {
    return { value: null, warning: 'A negative amount was rejected.' }
  }
  return { value: n }
}

function cleanBoolean(value: unknown): { value: boolean | null; warning?: string } {
  if (value === null || value === undefined) return { value: null }
  if (typeof value === 'boolean') return { value }
  if (typeof value === 'string') {
    const t = value.trim().toLowerCase()
    if (t === 'true' || t === 'yes' || t === 'allowed') return { value: true }
    if (t === 'false' || t === 'no' || t === 'not allowed') return { value: false }
    if (t === 'null' || t === 'none') return { value: null }
  }
  return { value: null, warning: 'A yes/no field was unclear and was left empty.' }
}

/**
 * Never trust the model's output.
 * Wrong types, negative amounts and junk values are dropped, not passed on.
 */
export function validateParsedPolicy(raw: unknown): ParseOutcome {
  const warnings: string[] = []

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('AI did not return a JSON object.')
  }

  const r = raw as Record<string, unknown>
  const draft: PolicyDraft = { ...EMPTY_DRAFT }

  draft.product = cleanText(r.product)
  draft.approvedSeller = cleanText(r.approvedSeller)
  draft.approvedReceiverWallet = cleanText(r.approvedReceiverWallet)

  const quantity = cleanNumber(r.quantity)
  if (quantity.warning) warnings.push(quantity.warning)
  // Quantity must be a whole number above zero.
  draft.quantity =
    quantity.value !== null && quantity.value > 0 && Number.isInteger(quantity.value)
      ? quantity.value
      : null
  if (quantity.value !== null && draft.quantity === null) {
    warnings.push('Quantity was not a whole number above 0 and was ignored.')
  }

  for (const field of ['maxPrice', 'perTransactionLimit', 'dailyLimit', 'validForMinutes'] as const) {
    const parsed = cleanNumber(r[field])
    if (parsed.warning) warnings.push(parsed.warning)
    draft[field] = parsed.value
  }

  const warranty = cleanBoolean(r.warrantyAllowed)
  if (warranty.warning) warnings.push(warranty.warning)
  draft.warrantyAllowed = warranty.value

  // Sanity checks between fields.
  if (
    draft.maxPrice !== null &&
    draft.perTransactionLimit !== null &&
    draft.perTransactionLimit < draft.maxPrice
  ) {
    warnings.push('Per-transaction limit is lower than the maximum price. Please check it.')
  }
  if (
    draft.dailyLimit !== null &&
    draft.maxPrice !== null &&
    draft.dailyLimit < draft.maxPrice
  ) {
    warnings.push('Daily limit is lower than the maximum price. Please check it.')
  }

  const missingFields = REQUIRED_FIELDS.filter((f) => draft[f] === null).map(String)
  if (draft.validForMinutes === null) missingFields.push('expiresAt')

  return { draft, missingFields, warnings }
}

/**
 * Sends the instruction to NVIDIA NIM and returns a validated draft.
 * `complete` is injectable so unit tests never call the real API.
 */
export async function parseHumanInstruction(
  instruction: string,
  complete: CompleteFn = completeWithNim,
): Promise<ParseOutcome> {
  const text = instruction?.trim() ?? ''

  if (text === '') {
    throw new Error('Please type an instruction first.')
  }
  if (text.length > 1500) {
    throw new Error('Instruction is too long. Please keep it under 1500 characters.')
  }

  // Only the instruction is sent - no app history, no other user data.
  const reply = await complete(POLICY_SYSTEM_PROMPT, text, 400)
  const raw = extractJson(reply)
  return validateParsedPolicy(raw)
}

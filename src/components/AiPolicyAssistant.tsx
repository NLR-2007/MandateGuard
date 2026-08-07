import { useState } from 'react'
import { createPolicy, parsePolicyInstruction } from '../services/api'
import type { AiDraftStatus, PolicyDraft, SpendingPolicy } from '../types'
import Badge from './Badge'

interface Props {
  /** Called after the HUMAN approves the draft and the policy is created. */
  onApproved: (policy: SpendingPolicy) => void
}

/** Editable copy of the draft - everything is a string while being edited. */
interface DraftForm {
  product: string
  quantity: string
  maxPrice: string
  approvedSeller: string
  warrantyAllowed: boolean | null
  approvedReceiverWallet: string
  perTransactionLimit: string
  dailyLimit: string
  expiresAt: string
}

const EXAMPLE =
  'Buy one 1TB SSD below ₹5000 from SecureStore.\nNo warranty.\nOnly pay ALGO-SECURE-STORE.\nMaximum ₹5000 per transaction.\nDaily limit ₹10000.'

/** Turns validForMinutes into a value the datetime-local input understands. */
function toLocalDateTime(minutesFromNow: number): string {
  const d = new Date(Date.now() + minutesFromNow * 60_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function draftToForm(draft: PolicyDraft): DraftForm {
  return {
    product: draft.product ?? '',
    quantity: draft.quantity !== null ? String(draft.quantity) : '',
    maxPrice: draft.maxPrice !== null ? String(draft.maxPrice) : '',
    approvedSeller: draft.approvedSeller ?? '',
    warrantyAllowed: draft.warrantyAllowed,
    approvedReceiverWallet: draft.approvedReceiverWallet ?? '',
    perTransactionLimit:
      draft.perTransactionLimit !== null ? String(draft.perTransactionLimit) : '',
    dailyLimit: draft.dailyLimit !== null ? String(draft.dailyLimit) : '',
    expiresAt: draft.validForMinutes !== null ? toLocalDateTime(draft.validForMinutes) : '',
  }
}

const inputBase =
  'w-full rounded-lg border bg-slate-900 px-4 py-2.5 text-white transition-colors duration-200 placeholder:text-slate-600 focus:outline-none'

export default function AiPolicyAssistant({ onApproved }: Props) {
  const [instruction, setInstruction] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState<DraftForm | null>(null)
  const [status, setStatus] = useState<AiDraftStatus>('GENERATED')
  const [model, setModel] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [aiMissing, setAiMissing] = useState<string[]>([])
  const [approving, setApproving] = useState(false)

  const handleUnderstand = async () => {
    setLoading(true)
    setError('')
    setForm(null)

    try {
      const response = await parsePolicyInstruction(instruction)
      setForm(draftToForm(response.draft))
      setAiMissing(response.missingFields)
      setWarnings(response.warnings ?? [])
      setModel(response.model)
      setStatus('GENERATED')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The AI could not read that.')
    } finally {
      setLoading(false)
    }
  }

  const update = <K extends keyof DraftForm>(key: K, value: DraftForm[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
    setStatus('REVIEWED')
  }

  /** Fields that are still empty right now (recalculated as the human types). */
  const emptyFields: string[] = form
    ? [
        form.product.trim() === '' && 'Product',
        form.quantity.trim() === '' && 'Quantity',
        form.maxPrice.trim() === '' && 'Maximum Price',
        form.approvedSeller.trim() === '' && 'Approved Seller',
        form.warrantyAllowed === null && 'Warranty',
        form.approvedReceiverWallet.trim() === '' && 'Receiver Wallet',
        form.perTransactionLimit.trim() === '' && 'Per Transaction Limit',
        form.dailyLimit.trim() === '' && 'Daily Limit',
        form.expiresAt.trim() === '' && 'Expiry',
      ].filter(Boolean as unknown as (v: string | false) => v is string)
    : []

  const handleApprove = async () => {
    if (!form || emptyFields.length > 0) return

    setApproving(true)
    setError('')

    try {
      // Only now does a real policy get created - by the human's click.
      const policy = await createPolicy({
        product: form.product.trim(),
        quantity: Number(form.quantity),
        maxPrice: Number(form.maxPrice),
        approvedSeller: form.approvedSeller.trim(),
        warrantyAllowed: form.warrantyAllowed === true,
        approvedReceiverWallet: form.approvedReceiverWallet.trim(),
        perTransactionLimit: Number(form.perTransactionLimit),
        dailyLimit: Number(form.dailyLimit),
        expiresAt: form.expiresAt,
      })

      setStatus('APPROVED_BY_HUMAN')
      onApproved(policy)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the policy.')
    } finally {
      setApproving(false)
    }
  }

  const fieldClass = (isEmpty: boolean) =>
    [inputBase, isEmpty ? 'border-red-500/60' : 'border-slate-700 focus:border-cyan-500'].join(
      ' ',
    )

  const labelClass = 'mb-1.5 block text-sm text-slate-300'

  return (
    <div className="space-y-6">
      {/* Instruction box */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h3 className="font-semibold text-white">
            Tell the AI what it is allowed to buy
          </h3>
          <Badge tone="ai">AI Assisted</Badge>
        </div>

        <textarea
          rows={5}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder={EXAMPLE}
          className={`${inputBase} border-slate-700 focus:border-cyan-500 resize-y`}
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => void handleUnderstand()}
            disabled={loading || instruction.trim() === ''}
            className="rounded-lg bg-cyan-500 px-6 py-3 font-semibold text-slate-950 transition-colors duration-200 hover:bg-cyan-400 disabled:opacity-50"
          >
            {loading ? 'AI is understanding your instruction…' : 'Understand My Instruction'}
          </button>

          <button
            onClick={() => setInstruction(EXAMPLE)}
            className="text-sm text-slate-400 underline underline-offset-4 hover:text-cyan-300"
          >
            Use the example
          </button>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          The AI only reads your sentence and fills in a form. It cannot approve or block
          anything.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-5 py-4 text-red-300">
          {error}
          <p className="mt-1 text-sm text-red-200/70">
            You can still create the policy with the Manual tab.
          </p>
        </div>
      )}

      {/* Human review screen */}
      {form && (
        <div className="rounded-xl border border-violet-500/40 bg-violet-500/5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-white">AI Generated Policy Draft</h3>
            <div className="flex flex-wrap gap-2">
              <Badge tone="ai">NVIDIA NIM</Badge>
              {model && <Badge tone="neutral">{model}</Badge>}
              <Badge tone={status === 'APPROVED_BY_HUMAN' ? 'human' : 'neutral'}>
                {status.replace(/_/g, ' ')}
              </Badge>
            </div>
          </div>

          <p className="mt-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-yellow-200">
            AI created this draft. Please review it before approving.
          </p>

          {aiMissing.length > 0 && (
            <p className="mt-3 text-sm text-slate-400">
              The AI left these empty because you did not mention them:{' '}
              <span className="text-red-300">{aiMissing.join(', ')}</span>. It did not guess
              them.
            </p>
          )}

          {warnings.map((w) => (
            <p key={w} className="mt-2 text-sm text-yellow-300">
              ⚠ {w}
            </p>
          ))}

          {/* Editable fields */}
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass}>Product</label>
              <input
                className={fieldClass(form.product.trim() === '')}
                value={form.product}
                onChange={(e) => update('product', e.target.value)}
                placeholder="Missing — please enter the product"
              />
            </div>

            <div>
              <label className={labelClass}>Quantity</label>
              <input
                type="number"
                min="1"
                className={fieldClass(form.quantity.trim() === '')}
                value={form.quantity}
                onChange={(e) => update('quantity', e.target.value)}
                placeholder="Missing — please enter quantity"
              />
            </div>

            <div>
              <label className={labelClass}>Maximum Price (₹)</label>
              <input
                type="number"
                min="0"
                className={fieldClass(form.maxPrice.trim() === '')}
                value={form.maxPrice}
                onChange={(e) => update('maxPrice', e.target.value)}
                placeholder="Missing — please enter maximum price"
              />
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass}>Approved Seller</label>
              <input
                className={fieldClass(form.approvedSeller.trim() === '')}
                value={form.approvedSeller}
                onChange={(e) => update('approvedSeller', e.target.value)}
                placeholder="Missing — please enter seller"
              />
            </div>

            <div className="sm:col-span-2">
              <span className={labelClass}>Warranty Allowed</span>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => update('warrantyAllowed', true)}
                  className={[
                    'rounded-lg border px-5 py-2 text-sm font-medium transition-colors duration-200',
                    form.warrantyAllowed === true
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                      : 'border-slate-700 text-slate-400 hover:border-slate-500',
                  ].join(' ')}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => update('warrantyAllowed', false)}
                  className={[
                    'rounded-lg border px-5 py-2 text-sm font-medium transition-colors duration-200',
                    form.warrantyAllowed === false
                      ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
                      : 'border-slate-700 text-slate-400 hover:border-slate-500',
                  ].join(' ')}
                >
                  No
                </button>
                {form.warrantyAllowed === null && (
                  <span className="text-sm text-red-300">
                    Missing — please choose Yes or No.
                  </span>
                )}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass}>Approved Receiver Wallet</label>
              <input
                className={fieldClass(form.approvedReceiverWallet.trim() === '')}
                value={form.approvedReceiverWallet}
                onChange={(e) => update('approvedReceiverWallet', e.target.value)}
                placeholder="Missing — please enter the receiver wallet"
              />
            </div>

            <div>
              <label className={labelClass}>Per Transaction Limit (₹)</label>
              <input
                type="number"
                min="0"
                className={fieldClass(form.perTransactionLimit.trim() === '')}
                value={form.perTransactionLimit}
                onChange={(e) => update('perTransactionLimit', e.target.value)}
                placeholder="Missing — please enter the limit"
              />
            </div>

            <div>
              <label className={labelClass}>Daily Spending Limit (₹)</label>
              <input
                type="number"
                min="0"
                className={fieldClass(form.dailyLimit.trim() === '')}
                value={form.dailyLimit}
                onChange={(e) => update('dailyLimit', e.target.value)}
                placeholder="Missing — please enter the daily limit"
              />
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass}>Expiry Time</label>
              <input
                type="datetime-local"
                className={fieldClass(form.expiresAt.trim() === '')}
                value={form.expiresAt}
                onChange={(e) => update('expiresAt', e.target.value)}
              />
              {form.expiresAt.trim() === '' && (
                <p className="mt-1 text-sm text-red-300">
                  Missing — please choose when this policy stops being valid.
                </p>
              )}
            </div>
          </div>

          {emptyFields.length > 0 && (
            <p className="mt-5 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              Please fill in: {emptyFields.join(', ')}
            </p>
          )}

          {/* Human decision */}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => void handleApprove()}
              disabled={approving || emptyFields.length > 0}
              className="rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-slate-950 transition-colors duration-200 hover:bg-emerald-400 disabled:opacity-50"
            >
              {approving ? 'Creating…' : '✓ Approve Policy'}
            </button>
            <button
              onClick={() => setStatus('REVIEWED')}
              className="rounded-lg border border-slate-600 px-6 py-3 font-semibold text-white transition-colors duration-200 hover:border-cyan-400 hover:text-cyan-300"
            >
              Edit
            </button>
            <button
              onClick={() => {
                setForm(null)
                setWarnings([])
                setAiMissing([])
              }}
              className="rounded-lg border border-slate-700 px-6 py-3 font-semibold text-slate-400 transition-colors duration-200 hover:border-red-500/60 hover:text-red-300"
            >
              Cancel
            </button>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            No policy exists until you press Approve. The AI cannot create one by itself.
          </p>
        </div>
      )}
    </div>
  )
}

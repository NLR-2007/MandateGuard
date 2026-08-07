import { useWallet } from '@txnlab/use-wallet-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import Badge from '../components/Badge'
import OrderComparison from '../components/OrderComparison'
import { StatusLights, useSystemStatus } from '../components/StatusBar'
import StepIndicator from '../components/StepIndicator'
import VerificationCheck from '../components/VerificationCheck'
import WalletBar from '../components/WalletBar'
import {
  createPolicyForRequest,
  parsePolicyForRequest,
  prepareAiOrderForRequest,
  recordExecution,
  resetDemo,
  simulateUnsafeOrder,
} from '../services/api'
import {
  describePaymentError,
  verifyWithX402,
  type PaidVerificationResult,
  type PaymentStage,
} from '../services/x402Client'
import type {
  AIOrder,
  OrderSource,
  PaymentState,
  PolicyDraft,
  SpendingPolicy,
  SystemStatus,
} from '../types'

const EXAMPLE_INSTRUCTION =
  'Buy one 1TB SSD below ₹5000 from SecureStore.\n' +
  'Do not add warranty.\n' +
  'Only pay ALGO-SECURE-STORE.\n' +
  'Maximum ₹5000 per transaction.\n' +
  'Daily limit ₹10000.'

type Scenario = 'SAFE' | 'ATTACK'

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
    expiresAt: toLocalDateTime(draft.validForMinutes ?? 120),
  }
}

/** Payment stage from the x402 client -> the state names Phase 7 asks for. */
const STAGE_TO_STATE: Record<PaymentStage, PaymentState> = {
  idle: 'NOT_STARTED',
  requesting: 'PAYMENT_REQUIRED',
  'payment-required': 'PAYMENT_REQUIRED',
  'awaiting-wallet': 'WAITING_FOR_WALLET',
  'payment-submitted': 'SUBMITTED',
  'verifying-payment': 'VERIFYING',
  'running-mandateguard': 'VERIFIED',
  done: 'VERIFIED',
  failed: 'FAILED',
}

const input =
  'w-full rounded-lg border bg-slate-900 px-4 py-2.5 text-white transition-colors duration-200 placeholder:text-slate-600 focus:outline-none'
const labelCls = 'mb-1.5 block text-sm text-slate-300'

export default function Dashboard() {
  const { activeAddress, signTransactions } = useWallet()
  const [refreshKey, setRefreshKey] = useState(0)
  const { status, error: statusError } = useSystemStatus(refreshKey)

  const [started, setStarted] = useState(false)
  const [step, setStep] = useState(1)
  const [scenario, setScenario] = useState<Scenario>('SAFE')

  const [requestId, setRequestId] = useState<string | null>(null)
  const [instruction, setInstruction] = useState(EXAMPLE_INSTRUCTION)
  const [form, setForm] = useState<DraftForm | null>(null)
  const [aiMissing, setAiMissing] = useState<string[]>([])
  const [model, setModel] = useState<string | null>(null)

  const [policy, setPolicy] = useState<SpendingPolicy | null>(null)
  const [mandateHash, setMandateHash] = useState<string | null>(null)

  const [order, setOrder] = useState<AIOrder | null>(null)
  const [orderSource, setOrderSource] = useState<OrderSource>('NVIDIA_NIM')
  const [aiReason, setAiReason] = useState('')

  const [paymentState, setPaymentState] = useState<PaymentState>('NOT_STARTED')
  const [result, setResult] = useState<PaidVerificationResult | null>(null)
  const [executed, setExecuted] = useState(false)
  const [executionNote, setExecutionNote] = useState('')

  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const refresh = () => setRefreshKey((k) => k + 1)

  // ── STEP 1: instruction -> NIM ──────────────────────────
  const handleUnderstand = async () => {
    setBusy('parse')
    setError('')
    try {
      const response = await parsePolicyForRequest(instruction, requestId ?? undefined)
      setRequestId(response.requestId)
      setForm(draftToForm(response.draft))
      setAiMissing(response.missingFields)
      setModel(response.model)
      setStep(2)
    } catch (err) {
      setError(
        (err instanceof Error ? err.message : 'The AI could not read that.') +
          ' You can still create a policy on the Create Policy page.',
      )
    } finally {
      setBusy('')
    }
  }

  const missing: string[] = form
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

  // ── STEP 3: human approves -> real policy ───────────────
  const handleApprove = async () => {
    if (!form || missing.length > 0 || !requestId) return
    setBusy('approve')
    setError('')
    try {
      const created = await createPolicyForRequest(
        {
          product: form.product.trim(),
          quantity: Number(form.quantity),
          maxPrice: Number(form.maxPrice),
          approvedSeller: form.approvedSeller.trim(),
          warrantyAllowed: form.warrantyAllowed === true,
          approvedReceiverWallet: form.approvedReceiverWallet.trim(),
          perTransactionLimit: Number(form.perTransactionLimit),
          dailyLimit: Number(form.dailyLimit),
          expiresAt: form.expiresAt,
        },
        requestId,
      )
      setPolicy(created)
      setStep(4)
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the policy.')
    } finally {
      setBusy('')
    }
  }

  // ── STEP 4: AI prepares an order ────────────────────────
  const handlePrepareOrder = async () => {
    if (!policy || !requestId) return
    setBusy('order')
    setError('')
    try {
      if (scenario === 'ATTACK') {
        const response = await simulateUnsafeOrder()
        setOrder(response.order)
        setOrderSource('SECURITY_SIMULATION')
        setAiReason('')
      } else {
        const response = await prepareAiOrderForRequest(policy.id, requestId)
        setOrder(response.order)
        setOrderSource('NVIDIA_NIM')
        setAiReason(response.reason)
      }
      setStep(5)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not prepare an order.')
    } finally {
      setBusy('')
    }
  }

  // ── STEPS 5-7: x402 payment then MandateGuard ───────────
  const handlePayAndVerify = async () => {
    if (!policy || !order || !requestId) return
    if (!activeAddress || !signTransactions) {
      setError('Connect an Algorand TestNet wallet first.')
      return
    }
    if (busy === 'pay') return // never start two payments

    setBusy('pay')
    setError('')
    setStep(6)
    setPaymentState('PAYMENT_REQUIRED')

    try {
      const paid = await verifyWithX402({
        policyId: policy.id,
        order,
        wallet: {
          address: activeAddress,
          signTransactions: signTransactions as unknown as (
            txns: Uint8Array[],
          ) => Promise<(Uint8Array | null)[]>,
        },
        policySource: 'NVIDIA_NIM_ASSISTED',
        orderSource,
        onStage: (stage) => setPaymentState(STAGE_TO_STATE[stage]),
      })

      setResult(paid)
      setMandateHash(paid.mandate?.mandateHash ?? null)
      setPaymentState('VERIFIED')
      setStep(7)
      refresh()
    } catch (err) {
      const message = describePaymentError(err)
      setPaymentState(/cancelled/i.test(message) ? 'CANCELLED' : 'FAILED')
      setError(message)
    } finally {
      setBusy('')
    }
  }

  // ── STEP 8: record execution (this is what consumes the mandate) ─
  const handleExecute = async () => {
    if (!result || result.decision !== 'APPROVED') return
    setBusy('exec')
    setError('')
    try {
      await recordExecution(result.verificationId)
      setExecuted(true)
      setExecutionNote('Execution recorded. Mandate marked USED.')
      setStep(8)
      refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not record execution.'
      if (/already recorded|already been used/i.test(message)) {
        setExecuted(true)
        setExecutionNote(message)
      } else {
        setError(message)
      }
      refresh()
    } finally {
      setBusy('')
    }
  }

  const handleReset = async () => {
    setBusy('reset')
    try {
      await resetDemo()
    } catch {
      /* the UI still resets even when the server is down */
    }
    setStarted(false)
    setStep(1)
    setRequestId(null)
    setForm(null)
    setPolicy(null)
    setOrder(null)
    setResult(null)
    setExecuted(false)
    setExecutionNote('')
    setPaymentState('NOT_STARTED')
    setError('')
    setMandateHash(null)
    setBusy('')
    refresh()
  }

  const update = <K extends keyof DraftForm>(key: K, value: DraftForm[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))

  const fieldCls = (empty: boolean) =>
    [input, empty ? 'border-red-500/60' : 'border-slate-700 focus:border-cyan-500'].join(' ')

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">MandateGuard Control Center</h1>
          <p className="mt-2 text-slate-400">
            One journey: instruction to blockchain proof.
          </p>
        </div>
        <StatusLights status={status} error={statusError} />
      </div>

      {/* Service + spend cards */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          title="AI Service"
          value={status?.services.ai.model ?? 'NVIDIA NIM'}
          tone={status?.services.ai.state === 'OK' ? 'ok' : 'warn'}
        />
        <Card title="MandateGuard" value="Active" tone="ok" />
        <Card
          title="x402"
          value={
            status?.services.x402.state === 'OK'
              ? `Enabled · ${status.services.x402.price}`
              : 'Not configured'
          }
          tone={status?.services.x402.state === 'OK' ? 'ok' : 'warn'}
        />
        <Card title="Blockchain" value="Algorand TestNet" tone="ok" />
        <Card
          title="Wallet"
          value={activeAddress ? 'Connected' : 'Not Connected'}
          tone={activeAddress ? 'ok' : 'warn'}
        />
        <Card
          title="Policy"
          value={
            policy
              ? `${policy.id} · ACTIVE`
              : status?.latestPolicyId
                ? `${status.latestPolicyId} · ACTIVE`
                : 'Not Created'
          }
          tone={policy || status?.latestPolicyId ? 'ok' : 'warn'}
        />
        <Card
          title="Daily Limit"
          value={
            status?.spend.dailyLimit != null
              ? `₹${status.spend.dailyLimit.toLocaleString('en-IN')}`
              : '—'
          }
        />
        <Card
          title="Spent / Remaining"
          value={
            status
              ? `₹${status.spend.spentToday.toLocaleString('en-IN')} / ${
                  status.spend.remaining != null
                    ? '₹' + status.spend.remaining.toLocaleString('en-IN')
                    : '—'
                }`
              : '—'
          }
        />
      </div>

      {/* Agent spend counters */}
      {status && (
        <div className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <Mini label="Approved" value={status.counts.approved} tone="ok" />
          <Mini label="Blocked" value={status.counts.blocked} tone="bad" />
          <Mini label="Executed" value={status.counts.executed} tone="info" />
          <Mini label="Active Policies" value={status.counts.policies} />
          <Mini label="Verifications" value={status.counts.verifications} />
        </div>
      )}

      {!started ? (
        <div className="mt-10 rounded-2xl border border-cyan-500/40 bg-cyan-500/5 p-10 text-center">
          <h2 className="text-2xl font-bold text-white">Ready when you are</h2>
          <p className="mx-auto mt-3 max-w-2xl text-slate-300">
            One guided run: you describe what to buy, the AI drafts a policy, you approve
            it, the AI orders, you pay the small x402 fee, and MandateGuard decides.
          </p>
          <button
            onClick={() => {
              setStarted(true)
              setStep(1)
            }}
            className="mt-6 rounded-lg bg-cyan-500 px-8 py-4 text-lg font-bold text-slate-950 transition-colors duration-200 hover:bg-cyan-400"
          >
            🚀 Start AI Purchase
          </button>
          <p className="mt-4 text-xs text-slate-500">
            Everything runs on Algorand TestNet — never MainNet.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-10">
            <StepIndicator current={step} />
          </div>

          {/* Scenario switch */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-400">Demo Scenario:</span>
            {(['SAFE', 'ATTACK'] as Scenario[]).map((s) => (
              <button
                key={s}
                onClick={() => setScenario(s)}
                className={[
                  'rounded-lg border px-4 py-2 text-sm font-semibold transition-colors duration-200',
                  scenario === s
                    ? s === 'SAFE'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                      : 'border-red-500 bg-red-500/10 text-red-400'
                    : 'border-slate-700 text-slate-400 hover:border-slate-500',
                ].join(' ')}
              >
                {s === 'SAFE' ? 'Safe AI Order' : 'Unsafe AI Order'}
              </button>
            ))}
            {requestId && <Badge tone="neutral">{requestId}</Badge>}
            <button
              onClick={() => void handleReset()}
              disabled={busy !== ''}
              className="ml-auto rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-400 transition-colors duration-200 hover:border-red-500/60 hover:text-red-300"
            >
              ↺ Reset Demo
            </button>
          </div>

          {error && (
            <p className="mt-6 rounded-lg border border-red-500/40 bg-red-500/10 px-5 py-4 text-red-300">
              {error}
            </p>
          )}

          {/* STEP 1 */}
          {step === 1 && (
            <Panel title="Step 1 — What should the AI buy?">
              <textarea
                rows={6}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                className={`${input} resize-y border-slate-700 focus:border-cyan-500`}
              />
              <button
                onClick={() => void handleUnderstand()}
                disabled={busy !== '' || instruction.trim() === ''}
                className="mt-4 rounded-lg bg-cyan-500 px-6 py-3 font-semibold text-slate-950 transition-colors duration-200 hover:bg-cyan-400 disabled:opacity-50"
              >
                {busy === 'parse'
                  ? 'AI is understanding your instruction…'
                  : 'Ask AI to Understand'}
              </button>
            </Panel>
          )}

          {/* STEPS 2 + 3 */}
          {step === 2 && form && (
            <Panel title="Step 2 — AI Policy Draft">
              <div className="flex flex-wrap gap-2">
                <Badge tone="ai">Generated by NVIDIA NIM</Badge>
                {model && <Badge tone="neutral">{model}</Badge>}
              </div>

              <p className="mt-4 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-yellow-200">
                AI created this draft. Please review before approval.
              </p>

              {aiMissing.length > 0 && (
                <p className="mt-3 text-sm text-slate-400">
                  Not stated by you, so the AI left them empty:{' '}
                  <span className="text-red-300">{aiMissing.join(', ')}</span>
                </p>
              )}

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <Field label="Product" span>
                  <input
                    className={fieldCls(form.product.trim() === '')}
                    value={form.product}
                    onChange={(e) => update('product', e.target.value)}
                    placeholder="Missing — please enter the product"
                  />
                </Field>
                <Field label="Quantity">
                  <input
                    type="number"
                    min="1"
                    className={fieldCls(form.quantity.trim() === '')}
                    value={form.quantity}
                    onChange={(e) => update('quantity', e.target.value)}
                    placeholder="Missing"
                  />
                </Field>
                <Field label="Maximum Price (₹)">
                  <input
                    type="number"
                    min="0"
                    className={fieldCls(form.maxPrice.trim() === '')}
                    value={form.maxPrice}
                    onChange={(e) => update('maxPrice', e.target.value)}
                    placeholder="Missing"
                  />
                </Field>
                <Field label="Approved Seller" span>
                  <input
                    className={fieldCls(form.approvedSeller.trim() === '')}
                    value={form.approvedSeller}
                    onChange={(e) => update('approvedSeller', e.target.value)}
                    placeholder="Missing — please enter seller"
                  />
                </Field>
                <Field label="Warranty Allowed" span>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => update('warrantyAllowed', true)}
                      className={[
                        'rounded-lg border px-5 py-2 text-sm font-medium',
                        form.warrantyAllowed === true
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                          : 'border-slate-700 text-slate-400',
                      ].join(' ')}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => update('warrantyAllowed', false)}
                      className={[
                        'rounded-lg border px-5 py-2 text-sm font-medium',
                        form.warrantyAllowed === false
                          ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
                          : 'border-slate-700 text-slate-400',
                      ].join(' ')}
                    >
                      No
                    </button>
                    {form.warrantyAllowed === null && (
                      <span className="text-sm text-red-300">
                        Missing — choose Yes or No.
                      </span>
                    )}
                  </div>
                </Field>
                <Field label="Approved Receiver Wallet" span>
                  <input
                    className={fieldCls(form.approvedReceiverWallet.trim() === '')}
                    value={form.approvedReceiverWallet}
                    onChange={(e) => update('approvedReceiverWallet', e.target.value)}
                    placeholder="Missing — please enter the receiver wallet"
                  />
                </Field>
                <Field label="Per Transaction Limit (₹)">
                  <input
                    type="number"
                    min="0"
                    className={fieldCls(form.perTransactionLimit.trim() === '')}
                    value={form.perTransactionLimit}
                    onChange={(e) => update('perTransactionLimit', e.target.value)}
                    placeholder="Missing"
                  />
                </Field>
                <Field label="Daily Spending Limit (₹)">
                  <input
                    type="number"
                    min="0"
                    className={fieldCls(form.dailyLimit.trim() === '')}
                    value={form.dailyLimit}
                    onChange={(e) => update('dailyLimit', e.target.value)}
                    placeholder="Missing"
                  />
                </Field>
                <Field label="Expiry" span>
                  <input
                    type="datetime-local"
                    className={fieldCls(form.expiresAt.trim() === '')}
                    value={form.expiresAt}
                    onChange={(e) => update('expiresAt', e.target.value)}
                  />
                </Field>
              </div>

              {missing.length > 0 && (
                <p className="mt-5 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  Please fill in: {missing.join(', ')}
                </p>
              )}

              <button
                onClick={() => void handleApprove()}
                disabled={busy !== '' || missing.length > 0}
                className="mt-6 rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-slate-950 transition-colors duration-200 hover:bg-emerald-400 disabled:opacity-50"
              >
                {busy === 'approve' ? 'Creating…' : '✓ Approve Human Policy'}
              </button>
              <p className="mt-3 text-xs text-slate-500">
                Step 3. No policy exists until you press this. The AI cannot create one.
              </p>
            </Panel>
          )}

          {/* STEP 4 */}
          {step === 4 && policy && (
            <Panel title="Step 4 — AI prepares the order">
              <div className="flex flex-wrap gap-2">
                <Badge tone="human">Human Approved</Badge>
                <Badge tone="order">{policy.id}</Badge>
                <Badge tone="neutral">ACTIVE</Badge>
              </div>

              <p className="mt-4 text-sm text-slate-400">
                Mandate proof registered for {policy.id}. In this build the proof is stored
                in server memory — no smart contract is deployed.
              </p>

              <button
                onClick={() => void handlePrepareOrder()}
                disabled={busy !== ''}
                className="mt-6 rounded-lg bg-violet-500 px-6 py-3 font-semibold text-slate-950 transition-colors duration-200 hover:bg-violet-400 disabled:opacity-50"
              >
                {busy === 'order'
                  ? 'Working…'
                  : scenario === 'SAFE'
                    ? '✨ Ask AI to Prepare Order'
                    : '⚠️ Load Unsafe AI Order'}
              </button>
            </Panel>
          )}

          {/* STEP 5 - pre-check */}
          {step === 5 && policy && order && (
            <Panel title="Step 5 — Order ready for verification">
              <div className="flex flex-wrap gap-2">
                {orderSource === 'NVIDIA_NIM' && <Badge tone="ai">AI Generated Order</Badge>}
                {orderSource === 'SECURITY_SIMULATION' && (
                  <Badge tone="simulation">Security Demo Simulation</Badge>
                )}
                <Badge tone="order">{order.orderId}</Badge>
              </div>

              <p className="mt-4 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-yellow-200">
                AI order is untrusted until MandateGuard verifies it.
              </p>

              {aiReason && (
                <p className="mt-3 text-sm text-violet-200">
                  <span className="font-semibold">AI summary:</span> {aiReason}
                </p>
              )}

              <div className="mt-6">
                <OrderComparison
                  policy={policy}
                  order={order}
                  unsafe={orderSource === 'SECURITY_SIMULATION'}
                />
              </div>

              <div className="mt-6">
                <WalletBar />
              </div>

              <button
                onClick={() => void handlePayAndVerify()}
                disabled={busy !== '' || !activeAddress}
                className="mt-6 rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-slate-950 transition-colors duration-200 hover:bg-emerald-400 disabled:opacity-50"
              >
                {busy === 'pay'
                  ? 'Payment in progress…'
                  : '⛓️ Verify with x402 + MandateGuard'}
              </button>
            </Panel>
          )}

          {/* STEP 6 - payment */}
          {step === 6 && (
            <Panel title="Step 6 — x402 payment">
              <PaymentStateView state={paymentState} status={status} />

              {(paymentState === 'FAILED' || paymentState === 'CANCELLED') && (
                <button
                  onClick={() => setStep(5)}
                  className="mt-5 rounded-lg border border-slate-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:border-cyan-400"
                >
                  Back to the order
                </button>
              )}
            </Panel>
          )}

          {/* STEPS 7 + 8 */}
          {step >= 7 && result && (
            <Panel title="Step 7 — Final decision">
              <div className="grid gap-4 sm:grid-cols-2">
                <Big
                  label="x402 Payment"
                  value={result.payment.status === 'VERIFIED' ? '✓ VERIFIED' : '? UNKNOWN'}
                  tone={result.payment.status === 'VERIFIED' ? 'ok' : 'warn'}
                />
                <Big
                  label="MandateGuard Decision"
                  value={result.decision === 'APPROVED' ? '✓ APPROVED' : '✕ BLOCKED'}
                  tone={result.decision === 'APPROVED' ? 'ok' : 'bad'}
                />
              </div>

              <p className="mt-5 text-center text-xl font-bold text-yellow-400">
                Payment Verified ≠ Purchase Approved
              </p>
              <p className="mt-1 text-center text-sm text-slate-400">
                x402 verifies payment. MandateGuard verifies intent.
              </p>

              {result.decision === 'BLOCKED' ? (
                <div className="mt-6 rounded-xl border border-red-500/40 bg-red-500/5 p-5">
                  <p className="font-semibold text-red-400">
                    The verification fee was paid successfully, but the AI purchase was
                    blocked.
                  </p>
                  <ul className="mt-3 space-y-1 text-sm text-slate-200">
                    {result.violations.map((v) => (
                      <li key={v}>✕ {v}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-6 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-5 py-4 text-emerald-300">
                  This AI order matches the human-approved policy.
                </p>
              )}

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {result.checks.map((c) => (
                  <VerificationCheck key={c.rule} check={c} />
                ))}
              </div>

              {/* Step 8 - blockchain proof */}
              <div className="mt-8 rounded-xl border border-blue-500/40 bg-blue-500/5 p-5">
                <h4 className="font-semibold text-blue-300">Step 8 — Blockchain proof</h4>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <Row label="Network" value={result.payment.network} />
                  <Row
                    label="Asset / Fee"
                    value={`${result.payment.asset} · ${result.payment.amount}`}
                  />
                  <Row label="Mandate Status" value={result.mandate?.status ?? '—'} />
                  <Row
                    label="Mandate Hash"
                    value={mandateHash ? `${mandateHash.slice(0, 16)}…` : '—'}
                  />
                </dl>
                <p className="mt-3 text-sm">
                  <span className="text-slate-400">Transaction ID: </span>
                  <span className="font-mono break-all text-white">
                    {result.payment.transactionId ?? 'not returned by the facilitator'}
                  </span>
                </p>
                {result.payment.explorerUrl && (
                  <a
                    href={result.payment.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-block rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors duration-200 hover:bg-blue-400"
                  >
                    View x402 Payment on Algorand Explorer ↗
                  </a>
                )}
              </div>

              {result.decision === 'APPROVED' && (
                <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
                  <h4 className="font-semibold text-white">Approved for Execution</h4>
                  <p className="mt-2 text-sm text-slate-400">
                    Approval is not a purchase. Recording the execution is what consumes the
                    mandate and adds to today's spending.
                  </p>
                  {executed ? (
                    <p className="mt-4 rounded-lg border border-blue-500/40 bg-blue-500/10 px-5 py-3 text-blue-300">
                      {executionNote || 'Execution recorded. Mandate marked USED.'}
                    </p>
                  ) : (
                    <button
                      onClick={() => void handleExecute()}
                      disabled={busy !== ''}
                      className="mt-4 rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors duration-200 hover:bg-cyan-400 disabled:opacity-50"
                    >
                      {busy === 'exec' ? 'Recording…' : 'Record Approved Execution'}
                    </button>
                  )}
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to={`/history/${result.verificationId}`}
                  className="rounded-lg border border-slate-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:border-cyan-400"
                >
                  View full transaction detail
                </Link>
                <Link
                  to="/history"
                  className="rounded-lg border border-slate-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:border-cyan-400"
                >
                  Audit history
                </Link>
              </div>
            </Panel>
          )}
        </>
      )}
    </section>
  )
}

// ── small presentational helpers ──────────────────────────

function Card({
  title,
  value,
  tone,
}: {
  title: string
  value: string
  tone?: 'ok' | 'warn'
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <p className="text-xs text-slate-400">{title}</p>
      <p
        className={[
          'mt-1 font-semibold break-words',
          tone === 'ok' ? 'text-emerald-400' : tone === 'warn' ? 'text-yellow-300' : 'text-white',
        ].join(' ')}
      >
        {value}
      </p>
    </div>
  )
}

function Mini({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: 'ok' | 'bad' | 'info'
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-center">
      <p
        className={[
          'text-2xl font-bold',
          tone === 'ok'
            ? 'text-emerald-400'
            : tone === 'bad'
              ? 'text-red-400'
              : tone === 'info'
                ? 'text-blue-300'
                : 'text-white',
        ].join(' ')}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-400">{label}</p>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
      <h3 className="text-lg font-bold text-white">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  )
}

function Field({
  label,
  span,
  children,
}: {
  label: string
  span?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={span ? 'sm:col-span-2' : ''}>
      <span className={labelCls}>{label}</span>
      {children}
    </div>
  )
}

function Big({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'ok' | 'bad' | 'warn'
}) {
  return (
    <div
      className={[
        'rounded-xl border p-6 text-center',
        tone === 'ok'
          ? 'border-emerald-500/40 bg-emerald-500/5'
          : tone === 'bad'
            ? 'border-red-500/40 bg-red-500/5'
            : 'border-yellow-500/40 bg-yellow-500/5',
      ].join(' ')}
    >
      <p className="text-sm text-slate-400">{label}</p>
      <p
        className={[
          'mt-2 text-2xl font-bold',
          tone === 'ok' ? 'text-emerald-400' : tone === 'bad' ? 'text-red-400' : 'text-yellow-300',
        ].join(' ')}
      >
        {value}
      </p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="text-white">{value}</dd>
    </div>
  )
}

function PaymentStateView({
  state,
  status,
}: {
  state: PaymentState
  status: SystemStatus | null
}) {
  const order: PaymentState[] = [
    'PAYMENT_REQUIRED',
    'WAITING_FOR_WALLET',
    'SUBMITTED',
    'VERIFYING',
    'VERIFIED',
  ]
  const current = order.indexOf(state)

  return (
    <div>
      {status?.services.x402.state === 'OK' && (
        <dl className="mb-5 grid gap-3 text-sm sm:grid-cols-4">
          <Row label="Verification Fee" value={status.services.x402.price ?? '—'} />
          <Row label="Network" value="Algorand TestNet" />
          <Row label="Asset" value="Test USDC" />
          <Row
            label="Receiver"
            value={
              status.services.x402.receiver
                ? `${status.services.x402.receiver.slice(0, 6)}...${status.services.x402.receiver.slice(-4)}`
                : '—'
            }
          />
        </dl>
      )}

      <ol className="space-y-2 text-sm">
        {order.map((s, i) => {
          const done = current > i
          const active = current === i
          return (
            <li
              key={s}
              className={[
                'flex items-center gap-2',
                done ? 'text-emerald-400' : active ? 'text-cyan-300' : 'text-slate-600',
              ].join(' ')}
            >
              <span>{done ? '✓' : active ? '●' : '○'}</span>
              {s.replace(/_/g, ' ')}
            </li>
          )
        })}
      </ol>

      {state === 'WAITING_FOR_WALLET' && (
        <p className="mt-4 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">
          Open your wallet and approve the payment. Nothing happens until you sign.
        </p>
      )}
      {state === 'CANCELLED' && (
        <p className="mt-4 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
          Payment cancelled. MandateGuard did not run.
        </p>
      )}
      {state === 'FAILED' && (
        <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Blockchain payment failed. Nothing was marked as paid.
        </p>
      )}
    </div>
  )
}

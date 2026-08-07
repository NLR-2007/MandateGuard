import { useWallet } from '@txnlab/use-wallet-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Badge from '../components/Badge'
import MandateAnchor from '../components/MandateAnchor'
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

const labelCls = 'label label-ink mb-1.5 block'
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

  // Wallet notifications get missed. attemptRef marks which signing request
  // is the live one; canResend appears a few seconds into the wait.
  const attemptRef = useRef(0)
  const [canResend, setCanResend] = useState(false)

  useEffect(() => {
    if (paymentState !== 'WAITING_FOR_WALLET') return
    setCanResend(false)
    const t = setTimeout(() => setCanResend(true), 6000)
    return () => clearTimeout(t)
  }, [paymentState])

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
  /**
   * `attempt` guards against two signing requests racing each other.
   * Only the newest attempt is allowed to change the screen; an abandoned
   * one is ignored so a late answer can never overwrite a fresh result.
   */
  const startPayment = async () => {
    if (!policy || !order || !requestId) return
    if (!activeAddress || !signTransactions) {
      setError('Connect an Algorand TestNet wallet first.')
      return
    }

    const attempt = attemptRef.current + 1
    attemptRef.current = attempt
    const isCurrent = () => attemptRef.current === attempt

    setBusy('pay')
    setError('')
    setCanResend(false)
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
        onStage: (stage) => {
          if (isCurrent()) setPaymentState(STAGE_TO_STATE[stage])
        },
      })

      if (!isCurrent()) return

      setResult(paid)
      setMandateHash(paid.mandate?.mandateHash ?? null)
      setPaymentState('VERIFIED')
      setStep(7)
      refresh()
    } catch (err) {
      if (!isCurrent()) return
      const message = describePaymentError(err)
      setPaymentState(/cancelled/i.test(message) ? 'CANCELLED' : 'FAILED')
      setError(message)
    } finally {
      if (isCurrent()) setBusy('')
    }
  }

  const handlePayAndVerify = () => {
    if (busy === 'pay') return // never start two payments from one click
    void startPayment()
  }

  /**
   * Sends a FRESH signing request when the phone notification was missed.
   * The previous attempt is abandoned first, so only one result can win.
   */
  const handleResend = () => {
    attemptRef.current += 1 // abandon whatever is in flight
    setCanResend(false)
    setError('')
    void startPayment()
  }

  const handleCancelPayment = () => {
    attemptRef.current += 1 // abandon the in-flight request
    setBusy('')
    setCanResend(false)
    setPaymentState('CANCELLED')
    setStep(5)
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
    setCanResend(false)
    attemptRef.current += 1
    refresh()
  }

  const update = <K extends keyof DraftForm>(key: K, value: DraftForm[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))

  const fieldCls = (empty: boolean) => `field ${empty ? 'field-missing' : ''}`

  return (
    <section className="pt-10">
      <div className="reveal d1 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="label">Dashboard</span>
          <h1 className="display mt-1 text-[clamp(34px,5vw,52px)]">
            Run a verification
          </h1>
          <p className="mt-2 max-w-xl text-[15px]" style={{ color: 'var(--ink-soft)'
}}>
            Everything in one place: your instruction, the AI draft, your approval, the
            AI order, the x402 payment, the decision and the proof.
          </p>
        </div>
        <StatusLights status={status} error={statusError} />
      </div>
      <div className="rule-double mt-6" />

      {/* Current status */}
      <div className="reveal d2 mt-6 grid gap-px sm:grid-cols-2 lg:grid-cols-5" style={{ background: 'var(--rule)'
}}>
        <Card label="AI" value={status?.services.ai.model ?? 'NVIDIA NIM'} state={status?.services.ai.state === 'OK'} />
        <Card label="MandateGuard" value="10 rules, deterministic" state />
        <Card
          label="x402 fee"
          value={status?.services.x402.state === 'OK' ? `x402 · ${status.services.x402.price}` : 'not configured'}
          state={status?.services.x402.state === 'OK'}
        />
        <Card label="Blockchain" value="Algorand TestNet" state />
        <Card
          label="Database"
          value={status ? (status.storage.state === 'MYSQL' ? `MySQL · ${status.storage.database}` : 'memory only') : '—'}
          state={status?.storage.state === 'MYSQL'}
        />
      </div>

      <div className="reveal d3 mt-px grid gap-px sm:grid-cols-2 lg:grid-cols-5" style={{ background: 'var(--rule)'
}}>
        <Card label="Wallet" value={activeAddress ? 'connected' : 'not connected'} state={Boolean(activeAddress)} />
        <Card
          label="Policy"
          value={policy ? policy.id : (status?.latestPolicyId ?? 'none yet')}
          state={Boolean(policy || status?.latestPolicyId)}
        />
        <Card
          label="Daily limit"
          value={status?.spend.dailyLimit != null ? `₹${status.spend.dailyLimit.toLocaleString('en-IN')}` : '—'}
        />
        <Card
          label="Spent today"
          value={status ? `₹${status.spend.spentToday.toLocaleString('en-IN')}` : '—'}
        />
        <Card
          label="Remaining"
          value={status?.spend.remaining != null ? `₹${status.spend.remaining.toLocaleString('en-IN')}` : '—'}
        />
      </div>

      {status && (
        <div className="reveal d4 mt-6 flex flex-wrap gap-x-8 gap-y-2 border-t pt-3" style={{ borderColor: 'var(--rule)'
}}>
          <Tally label="Approved" n={status.counts.approved} tone="var(--forest)" />
          <Tally label="Blocked" n={status.counts.blocked} tone="var(--oxblood)" />
          <Tally label="Executed" n={status.counts.executed} tone="var(--indigo)" />
          <Tally label="Policies" n={status.counts.policies} />
          <Tally label="Verifications" n={status.counts.verifications} />
        </div>
      )}

      {!started ? (
        <div className="reveal d5 sheet mt-10 grid gap-8 p-10 md:grid-cols-[1.3fr_1fr]">
          <div>
            <span className="gutter-mark">Before you start</span>
            <h2 className="display mt-3 text-[30px]">
              Nothing is approved until you approve it.
            </h2>
            <p className="mt-3 max-w-lg text-[15px]" style={{ color: 'var(--ink-soft)'
}}>
              You describe the purchase in one sentence. The AI turns it into a form. You
              fill in anything it left blank, and only your approval creates the policy.
            </p>
            <button onClick={() => { setStarted(true); setStep(1) }} className="btn btn-solid mt-7">
              Start
            </button>
            <p className="footnote mt-4">Algorand TestNet — test funds only, never MainNet.</p>
          </div>

          <div className="border-l pl-8" style={{ borderColor: 'var(--rule)'
}}>
            <span className="label">The 8 steps</span>
            <ol className="mt-3 space-y-1.5">
              {['Your instruction', 'AI draft', 'You approve', 'AI order', 'Review', 'x402 payment', 'Decision', 'Proof'].map((t, i) => (
                <li key={t} className="flex gap-3 text-[13px]">
                  <span className="mono" style={{ color: 'var(--oxblood)'
}}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-10">
            <StepIndicator current={step} />
          </div>

          {/* Scenario switch */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="label">Demo scenario</span>
            {(['SAFE', 'ATTACK'] as Scenario[]).map((s) => (
              <button
                key={s}
                onClick={() => setScenario(s)}
                className="btn btn-sm"
                style={
                  scenario === s
                    ? s === 'SAFE' ? { background: 'var(--forest)', borderColor: 'var(--forest)', color: 'var(--paper-card)'
}
                      : { background: 'var(--oxblood)', borderColor: 'var(--oxblood)', color: 'var(--paper-card)'
}
                    : { color: 'var(--ink-faint)', borderColor: 'var(--rule)'
}
                }
              >
                {s === 'SAFE' ? 'Safe AI order' : 'Unsafe AI order'}
              </button>
            ))}
            {requestId && <Badge tone="neutral">{requestId}</Badge>}
            <button
              onClick={() => void handleReset()}
              disabled={busy !== ''}
              className="btn btn-sm ml-auto"
            >
              Reset demo
            </button>
          </div>

          {error && (
            <p
              className="mt-6 border-l-4 py-3 pl-4 text-[14px]"
              style={{ borderColor: 'var(--oxblood)', color: 'var(--oxblood)', background: 'rgba(140,29,24,0.05)'
}}
            >
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
                className="field"
                style={{ fontFamily: "Instrument Serif, serif", fontSize: "19px" }}
              />
              <button
                onClick={() => void handleUnderstand()}
                disabled={busy !== '' || instruction.trim() === ''}
                className="btn btn-solid mt-5"
              >
                {busy === 'parse' ? 'AI is understanding your instruction…' : 'Ask AI to Understand'}
              </button>
            </Panel>
          )}

          {/* STEPS 2 + 3 */}
          {step === 2 && form && (
            <Panel title="Step 2 — AI draft policy">
              <div className="flex flex-wrap gap-2">
                <Badge tone="ai">Generated by NVIDIA NIM</Badge>
                {model && <Badge tone="neutral">{model}</Badge>}
              </div>

              <p className="notice mt-4">
                The AI wrote this draft. Please check it before you approve.
              </p>

              {aiMissing.length > 0 && (
                <p className="mt-3 text-sm text-[var(--ink-soft)]">
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
                      className="btn btn-sm"
                      style={
                        form.warrantyAllowed === true
                          ? { background: 'var(--forest)', borderColor: 'var(--forest)', color: 'var(--paper-card)'
}
                          : { color: 'var(--ink-faint)', borderColor: 'var(--rule)'
}
                      }
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => update('warrantyAllowed', false)}
                      className="btn btn-sm"
                      style={
                        form.warrantyAllowed === false
                          ? { background: 'var(--ink)', borderColor: 'var(--ink)', color: 'var(--paper-card)'
}
                          : { color: 'var(--ink-faint)', borderColor: 'var(--rule)'
}
                      }
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
                <p
                  className="mono mt-5 border-l-4 py-2 pl-3 text-[12px]"
                  style={{ borderColor: 'var(--oxblood)', color: 'var(--oxblood)'
}}
                >
                  Incomplete: {missing.join(', ')}
                </p>
              )}

              <button
                onClick={() => void handleApprove()}
                disabled={busy !== '' || missing.length > 0}
                className="btn btn-solid mt-6"
              >
                {busy === 'approve' ? 'Creating…' : '✓ Approve Human Policy'}
              </button>
              <p className="mt-3 text-xs text-[var(--ink-soft)]">
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

              <p className="mt-4 text-sm text-[var(--ink-soft)]">
                Mandate proof registered for {policy.id}. The policy is now fixed: every
                later check compares the AI's order against exactly this record.
              </p>

              {/* The fingerprint can now be written to Algorand TestNet, so the
                  approved intent no longer depends on trusting our database. */}
              <MandateAnchor mandateId={policy.id} />

              <button
                onClick={() => void handlePrepareOrder()}
                disabled={busy !== ''}
                className="btn btn-solid mt-6"
              >
                {busy === 'order' ? 'Working…' : scenario === 'SAFE' ? 'Ask AI to Prepare Order' : 'Load Unsafe AI Order'}
              </button>
            </Panel>
          )}

          {/* STEP 5 - pre-check */}
          {step === 5 && policy && order && (
            <Panel title="Step 5 — Review before you pay">
              <div className="flex flex-wrap gap-2">
                {orderSource === 'NVIDIA_NIM' && <Badge tone="ai">AI Generated Order</Badge>}
                {orderSource === 'SECURITY_SIMULATION' && (
                  <Badge tone="simulation">Security Demo Simulation</Badge>
                )}
                <Badge tone="order">{order.orderId}</Badge>
              </div>

              <p className="notice mt-4">
                This AI order is not trusted until MandateGuard checks it.
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
                onClick={handlePayAndVerify}
                disabled={busy !== '' || !activeAddress}
                className="btn btn-solid mt-6"
              >
                {busy === 'pay' ? 'Payment in progress…' : 'Verify with x402 + MandateGuard'}
              </button>
            </Panel>
          )}

          {/* STEP 6 - payment */}
          {step === 6 && (
            <Panel title="Step 6 — x402 payment">
              <PaymentStateView state={paymentState} status={status} />

              {/* Missed the phone notification? Send a fresh request. */}
              {paymentState === 'WAITING_FOR_WALLET' && (
                <div className="mt-5">
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handleResend}
                      disabled={!canResend}
                      className="btn btn-solid"
                    >
                      {canResend
                        ? '↻ Resend request to wallet' : '↻ Resend available in a few seconds…'}
                    </button>
                    <button
                      onClick={handleCancelPayment}
                      className="btn"
                    >
                      Cancel payment
                    </button>
                  </div>
                  <p className="mt-3 text-xs text-[var(--ink-soft)]">
                    Resending sends a <strong>new</strong> signing request. If an old prompt
                    is still open on your phone, reject that one and approve the newest.
                  </p>
                </div>
              )}

              {(paymentState === 'FAILED' || paymentState === 'CANCELLED') && (
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    onClick={handleResend}
                    className="btn btn-solid"
                  >
                    ↻ Try the payment again
                  </button>
                  <button
                    onClick={() => setStep(5)}
                    className="btn"
                  >
                    Back to the order
                  </button>
                </div>
              )}
            </Panel>
          )}

          {/* STEPS 7 + 8 */}
          {step >= 7 && result && (
            <Panel title="Step 7 — The decision">
              <div className="grid gap-8 border-b pb-8 sm:grid-cols-2" style={{ borderColor: 'var(--rule)'
}}>
                <div className="text-center">
                  <span className="label">x402 payment</span>
                  <div className="mt-4 flex justify-center">
                    <span
                      className={`stamp stamp-sm ${result.payment.status === 'VERIFIED' ? 'stamp-approved' : ''}`}
                      style={result.payment.status === 'VERIFIED' ? undefined : { color: 'var(--ochre)'
}}
                    >
                      {result.payment.status === 'VERIFIED' ? 'Paid' : 'Unknown'}
                      <sub>{result.payment.amount}</sub>
                    </span>
                  </div>
                </div>

                <div className="text-center">
                  <span className="label">MandateGuard decision</span>
                  <div className="mt-4 flex justify-center">
                    <span
                      className={`stamp stamp-lg ${result.decision === 'APPROVED' ? 'stamp-approved' : 'stamp-blocked'}`}
                    >
                      {result.decision === 'APPROVED' ? 'Approved' : 'Blocked'}
                      <sub>{result.verificationId}</sub>
                    </span>
                  </div>
                </div>
              </div>

              <p className="display mt-8 text-center text-[clamp(20px,3vw,30px)]">
                Payment verified <span style={{ color: 'var(--oxblood)'
}}>≠</span> purchase approved
              </p>
              <p className="label mt-2 text-center">
                x402 verifies payment · MandateGuard verifies intent
              </p>

              {result.decision === 'BLOCKED' ? (
                <div
                  className="mt-8 border-l-4 p-6"
                  style={{ borderColor: 'var(--oxblood)', background: 'rgba(140,29,24,0.05)'
}}
                >
                  <p className="display text-[19px]" style={{ color: 'var(--oxblood)'
}}>
                    The payment worked. The purchase was blocked.
                  </p>
                  <ol className="mt-4 space-y-1.5">
                    {result.violations.map((v, i) => (
                      <li key={v} className="flex gap-3 text-[14px]">
                        <span className="mono" style={{ color: 'var(--oxblood)'
}}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        {v}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : (
                <p
                  className="display mt-8 border-l-4 py-3 pl-5 text-[19px]"
                  style={{ borderColor: 'var(--forest)', color: 'var(--forest)'
}}
                >
                  This order matches the policy you approved.
                </p>
              )}

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {result.checks.map((c) => (
                  <VerificationCheck key={c.rule} check={c} />
                ))}
              </div>

              {/* Step 8 - blockchain proof */}
              <div className="block mt-10 p-6">
                <span className="gutter-mark">Step 8 — Blockchain proof</span>
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
                  <span className="text-[var(--ink-soft)]">Transaction ID: </span>
                  <span className="mono break-all text-[var(--ink)]">
                    {result.payment.transactionId ?? 'not returned by the facilitator'}
                  </span>
                </p>
                {result.payment.explorerUrl && (
                  <a
                    href={result.payment.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-solid mt-4"
                  >
                    View x402 Payment on Algorand Explorer ↗
                  </a>
                )}
              </div>

              {result.decision === 'APPROVED' && (
                <div className="block mt-8 p-6">
                  <span className="gutter-mark">Step 9 — Execution</span>
                  <h4 className="display mt-2 text-[21px]">Approved for execution</h4>
                  <p className="mt-2 text-[14px]" style={{ color: 'var(--ink-soft)'
}}>
                    Approval is not a purchase. Recording the execution is what consumes the
                    mandate and adds to today's spending.
                  </p>
                  {executed ? (
                    <p
                      className="mono mt-4 border-l-4 py-2 pl-4 text-[12px]"
                      style={{ borderColor: 'var(--indigo)', color: 'var(--indigo)'
}}
                    >
                      {executionNote || 'Execution recorded. Mandate marked USED.'}
                    </p>
                  ) : (
                    <button
                      onClick={() => void handleExecute()}
                      disabled={busy !== ''}
                      className="btn btn-solid mt-4"
                    >
                      {busy === 'exec' ? 'Recording…' : 'Record Approved Execution'}
                    </button>
                  )}
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to={`/history/${result.verificationId}`}
                  className="btn"
                >
                  View full transaction detail
                </Link>
                <Link
                  to="/history"
                  className="btn"
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
  label,
  value,
  state,
}: {
  label: string
  value: string
  state?: boolean
}) {
  return (
    <div className="px-4 py-3" style={{ background: 'var(--paper-card)'
}}>
      <span className="label">{label}</span>
      <p
        className="mono mt-1 text-[12.5px] leading-snug break-words"
        style={{ color: state === false ? 'var(--ochre)' : 'var(--ink)'
}}
      >
        {value}
      </p>
    </div>
  )
}

function Tally({ label, n, tone }: { label: string; n: number; tone?: string }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="display text-[26px]" style={{ color: tone ?? 'var(--ink)'
}}>
        {n}
      </span>
      <span className="label">{label}</span>
    </span>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  const [mark, ...rest] = title.split(' — ')
  return (
    <div className="sheet reveal mt-8 p-8">
      <span className="gutter-mark">{mark}</span>
      <h3 className="display mt-2 text-[27px]">{rest.join(' — ') || title}</h3>
      <div className="rule-line mt-4 mb-6" />
      {children}
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="mono mt-0.5 text-[12.5px] break-all">{value}</dd>
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
        <dl className="mb-7 grid gap-4 border-b pb-5 sm:grid-cols-4" style={{ borderColor: 'var(--rule)'
}}>
          <Row label="Fee" value={status.services.x402.price ?? '—'} />
          <Row label="Blockchain" value="Algorand TestNet" />
          <Row label="Asset" value="Test USDC" />
          <Row
            label="Receiver"
            value={
              status.services.x402.receiver
                ? `${status.services.x402.receiver.slice(0, 6)}…${status.services.x402.receiver.slice(-4)}`
                : '—'
}
          />
        </dl>
      )}

      <ol className="space-y-0">
        {order.map((s, i) => {
          const done = current > i
          const active = current === i
          return (
            <li
              key={s}
              className="flex items-center gap-4 border-b py-2.5"
              style={{ borderColor: 'var(--rule-soft)'
}}
            >
              <span
                className="mono text-[10px]"
                style={{ color: done ? 'var(--forest)' : active ? 'var(--oxblood)' : 'var(--ink-faint)'
}}
              >
                {done ? '✓' : active ? '▸' : '·'}
              </span>
              <span
                className="mono text-[12px] tracking-[0.12em] uppercase"
                style={{
                  color: done ? 'var(--forest)' : active ? 'var(--ink)' : 'var(--ink-faint)',
                  fontWeight: active ? 600 : 400,
                }}
              >
                {s.replace(/_/g, ' ')}
              </span>
            </li>
          )
        })}
      </ol>

      {state === 'WAITING_FOR_WALLET' && (
        <p className="notice mt-6">
          Open your wallet and approve the payment. Nothing happens until you sign.
        </p>
      )}
      {state === 'CANCELLED' && (
        <p className="notice mt-6">Payment cancelled. MandateGuard did not run.</p>
      )}
      {state === 'FAILED' && (
        <p
          className="mt-6 border-l-4 py-3 pl-4 text-[14px]"
          style={{ borderColor: 'var(--oxblood)', color: 'var(--oxblood)', background: 'rgba(140,29,24,0.05)'
}}
        >
          Payment failed. Nothing was recorded as paid.
        </p>
      )}
    </div>
  )
}

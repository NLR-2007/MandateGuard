import { useWallet } from '@txnlab/use-wallet-react'
import DemoPageNote from '../components/DemoPageNote'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Badge from '../components/Badge'
import OrderComparison from '../components/OrderComparison'
import WalletBar from '../components/WalletBar'
import {
  defaultPolicyInput,
  demoPolicy,
  loadDemoMode,
  loadPolicy,
  loadPolicySource,
  safeOrder,
  saveDemoMode,
  savePolicy,
  saveVerification,
  unsafeOrder,
} from '../data/demoData'
import {
  createPolicy,
  prepareAiOrder,
  simulateUnsafeOrder,
  verifyMandate,
} from '../services/api'
import {
  STAGE_LABELS,
  describePaymentError,
  verifyWithX402,
  type PaymentStage,
} from '../services/x402Client'
import type { AIOrder, DemoMode, OrderSource, SpendingPolicy } from '../types'
const STAGE_ORDER: PaymentStage[] = [
  'requesting',
  'payment-required',
  'awaiting-wallet',
  'payment-submitted',
  'verifying-payment',
  'running-mandateguard',
  'done',
]

export default function AIOrder() {
  const navigate = useNavigate()
  const { activeAddress, signTransactions } = useWallet()
  const [stage, setStage] = useState<PaymentStage>('idle')
  const [mode, setMode] = useState<DemoMode>(loadDemoMode)
  const [policy, setPolicy] = useState<SpendingPolicy | null>(loadPolicy)

  // An order produced by the AI agent or by the security simulation.
  const [liveOrder, setLiveOrder] = useState<AIOrder | null>(null)
  const [orderSource, setOrderSource] = useState<OrderSource>('MANUAL_DEMO')
  const [aiReason, setAiReason] = useState('')

  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  // Show the AI order when there is one, otherwise the hand-written demo order.
  const order = liveOrder ?? (mode === 'safe' ? safeOrder : unsafeOrder)
  const unsafeLooking =
    orderSource === 'SECURITY_SIMULATION' || (liveOrder === null && mode === 'unsafe')

  const ensurePolicy = async (): Promise<SpendingPolicy> => {
    const fresh = await createPolicy(defaultPolicyInput)
    savePolicy(fresh)
    setPolicy(fresh)
    return fresh
  }

  const pickDemo = (next: DemoMode) => {
    setMode(next)
    saveDemoMode(next)
    setLiveOrder(null)
    setOrderSource('MANUAL_DEMO')
    setAiReason('')
  }

  /** STEP: ask NVIDIA NIM to choose an item from the demo catalog. */
  const handleAskAi = async () => {
    setBusy('ai')
    setError('')

    try {
      const current = policy ?? (await ensurePolicy())

      let response
      try {
        response = await prepareAiOrder(current.id)
      } catch (err) {
        if ((err as Error & { status?: number }).status === 404) {
          const recreated = await ensurePolicy()
          response = await prepareAiOrder(recreated.id)
        } else {
          throw err
        }
      }

      setLiveOrder(response.order)
      setOrderSource('NVIDIA_NIM')
      setAiReason(response.reason)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The AI could not prepare an order.')
    } finally {
      setBusy('')
    }
  }

  /** STEP: load the controlled manipulated order. No AI is involved. */
  const handleSimulateUnsafe = async () => {
    setBusy('sim')
    setError('')

    try {
      const response = await simulateUnsafeOrder()
      setLiveOrder(response.order)
      setOrderSource('SECURITY_SIMULATION')
      setAiReason('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the simulation.')
    } finally {
      setBusy('')
    }
  }

  /** STEP: the deterministic engine decides. */
  const handleVerify = async () => {
    setBusy('verify')
    setError('')

    try {
      const current = policy ?? (await ensurePolicy())
      const sources = { policySource: loadPolicySource(), orderSource }

      let result
      try {
        result = await verifyMandate(current.id, order, sources)
      } catch (err) {
        if ((err as Error & { status?: number }).status === 404) {
          const recreated = await ensurePolicy()
          result = await verifyMandate(recreated.id, order, sources)
        } else {
          throw err
        }
      }

      saveVerification(result)
      navigate('/verify')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.')
    } finally {
      setBusy('')
    }
  }

  /** The paid path: x402 asks for Test USDC, then MandateGuard decides. */
  const handleVerifyWithX402 = async () => {
    if (!activeAddress || !signTransactions) {
      setError('Connect an Algorand TestNet wallet first.')
      return
    }

    setBusy('x402')
    setError('')
    setStage('requesting')

    try {
      const current = policy ?? (await ensurePolicy())

      const result = await verifyWithX402({
        policyId: current.id,
        order,
        wallet: {
          address: activeAddress,
          signTransactions: signTransactions as unknown as (
            txns: Uint8Array[],
          ) => Promise<(Uint8Array | null)[]>,
        },
        policySource: loadPolicySource(),
        orderSource,
        onStage: setStage,
      })

      saveVerification(result)
      navigate('/verify')
    } catch (err) {
      setStage('failed')
      setError(describePaymentError(err))
    } finally {
      setBusy('')
    }
  }

  return (
    <section className="pt-10">
      <DemoPageNote />
      <h1 className="display text-[clamp(32px,5vw,46px)] text-[var(--ink)]">AI Prepared Order</h1>
      <p className="mt-2 text-[var(--ink-soft)]">
        Left is what the human approved. Right is what the AI agent wants to buy.
      </p>

      <p className="mt-3 text-sm text-[var(--ink-faint)]">
        Policy in use:{' '}
        <span className="text-[var(--indigo)]">
          {policy ? policy.id : 'none yet — one will be created automatically'}
        </span>
      </p>

      {/* Step 1 - where does the order come from? */}
      <div className="mt-8 block p-6">
        <h2 className="display text-[19px]">1. Choose how the order is created</h2>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={() => void handleAskAi()}
            disabled={busy !== ''}
            className="btn btn-solid"
          >
            {busy === 'ai' ? 'AI is choosing an item…' : 'Ask AI to Prepare Order'}
          </button>

          <button
            onClick={() => void handleSimulateUnsafe()}
            disabled={busy !== ''}
            className="border border-[var(--ochre)] bg-[var(--wash-ochre)] px-5 py-2.5 text-sm font-semibold text-[var(--ochre)] transition-colors duration-200 hover:bg-[var(--wash-ochre)] disabled:opacity-50"
          >
            {busy === 'sim' ? 'Loading…' : 'Simulate Unsafe AI Order'}
          </button>

          <button
            onClick={() => pickDemo('safe')}
            className={[
              'btn btn-sm',
              liveOrder === null && mode === 'safe' ? 'border-[var(--forest)] bg-[var(--wash-green)] text-[var(--forest)]' : 'border-[var(--rule)] text-[var(--ink-soft)] hover:border-[var(--rule)]',
            ].join(' ')}
          >
            Load Safe Demo
          </button>

          <button
            onClick={() => pickDemo('unsafe')}
            className={[
              'btn btn-sm',
              liveOrder === null && mode === 'unsafe' ? 'border-[var(--oxblood)] bg-[var(--wash-red)] text-[var(--oxblood)]' : 'border-[var(--rule)] text-[var(--ink-soft)] hover:border-[var(--rule)]',
            ].join(' ')}
          >
            Load Unsafe Demo
          </button>
        </div>

        {/* Who made this order? */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="text-sm text-[var(--ink-soft)]">Current order:</span>
          {orderSource === 'NVIDIA_NIM' && <Badge tone="ai">Generated by NVIDIA NIM</Badge>}
          {orderSource === 'SECURITY_SIMULATION' && (
            <Badge tone="simulation">Security Demo Simulation</Badge>
          )}
          {orderSource === 'MANUAL_DEMO' && <Badge tone="neutral">Sample demo order</Badge>}
          <Badge tone="order">{order.orderId}</Badge>
        </div>

        {orderSource === 'SECURITY_SIMULATION' && (
          <p className="mt-4 notice text-sm text-[var(--ochre)]">
            This is fixed sample data, not something the AI produced. We never ask the model
            to behave badly — the attack is scripted so the demo is predictable, and it goes
            through exactly the same MandateGuard check.
          </p>
        )}

        {aiReason && (
          <p className="mt-4 border border-[var(--indigo)] bg-[var(--wash-indigo)] px-4 py-3 text-sm text-[var(--indigo)]">
            <span className="font-semibold">AI summary:</span> {aiReason}
          </p>
        )}
      </div>

      {/* Step 2 - the comparison */}
      <div className="mt-8">
        <OrderComparison
          policy={policy ?? demoPolicy}
          order={order}
          unsafe={unsafeLooking}
        />
      </div>

      {error && (
        <p className="mt-6 notice text-[var(--oxblood)]">
          {error}
        </p>
      )}

      {/* Step 3 - the deterministic check */}
      <div className="mt-8 block p-6">
        <h2 className="display text-[19px]">2. Let MandateGuard decide</h2>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          Whoever created the order — the AI or the simulation — the same deterministic
          engine checks it. The AI never approves its own order.
        </p>

        <div className="mt-5">
          <WalletBar />
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={() => void handleVerifyWithX402()}
            disabled={busy !== '' || !activeAddress}
            className="btn btn-solid"
          >
            {busy === 'x402' ? 'Payment in progress…' : 'Verify with x402 + MandateGuard'}
          </button>

          <button
            onClick={() => void handleVerify()}
            disabled={busy !== ''}
            className="border border-[var(--ink)] px-6 py-3 display text-[19px] transition-colors duration-200 hover:border-[var(--ink)] hover:text-[var(--indigo)] disabled:opacity-50"
          >
            {busy === 'verify' ? 'Checking…' : 'Verify without payment (free route)'}
          </button>
        </div>

        <p className="mt-3 text-xs text-[var(--ink-faint)]">
          The paid route costs {' '}
          <span className="text-[var(--indigo)]">0.005 Test USDC</span> on Algorand TestNet. The
          free route is the same engine without the payment layer.
        </p>

        {/* Live payment stages */}
        {stage !== 'idle' && (
          <div className="mt-6 border border-[var(--rule)] p-5">
            <p className="mb-3 text-sm display text-[19px]">Payment progress</p>
            <ol className="space-y-2 text-sm">
              {STAGE_ORDER.map((s) => {
                const current = STAGE_ORDER.indexOf(stage)
                const index = STAGE_ORDER.indexOf(s)
                const state =
                  stage === 'failed' ? 'idle' : index < current
                      ? 'done' : index === current
                        ? 'active' : 'idle'
return (
                  <li
                    key={s}
                    className={[
                      'flex items-center gap-2',
                      state === 'done' ? 'text-[var(--forest)]' : state === 'active' ? 'text-[var(--indigo)]' : 'text-[var(--ink-soft)]',
                    ].join(' ')}
                  >
                    <span>{state === 'done' ? '✓' : state === 'active' ? '●' : '○'}</span>
                    {STAGE_LABELS[s]}
                  </li>
                )
              })}
            </ol>

            {stage === 'awaiting-wallet' && (
              <p className="mt-4 border border-[var(--indigo)] bg-[var(--wash-indigo)] px-4 py-3 text-sm text-cyan-200">
                Open your wallet and approve the 0.005 Test USDC payment. Nothing happens
                until you sign.
              </p>
            )}

            {stage === 'failed' && (
              <p className="mt-4 notice text-sm text-[var(--oxblood)]">
                Blockchain payment failed. No result was produced and nothing was marked as
                paid.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

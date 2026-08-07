import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Badge from '../components/Badge'
import OrderComparison from '../components/OrderComparison'
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
import type { AIOrder, DemoMode, OrderSource, SpendingPolicy } from '../types'

export default function AIOrder() {
  const navigate = useNavigate()
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

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-bold text-white">AI Prepared Order</h1>
      <p className="mt-2 text-slate-400">
        Left is what the human approved. Right is what the AI agent wants to buy.
      </p>

      <p className="mt-3 text-sm text-slate-500">
        Policy in use:{' '}
        <span className="text-cyan-400">
          {policy ? policy.id : 'none yet — one will be created automatically'}
        </span>
      </p>

      {/* Step 1 - where does the order come from? */}
      <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="font-semibold text-white">1. Choose how the order is created</h2>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={() => void handleAskAi()}
            disabled={busy !== ''}
            className="rounded-lg bg-violet-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors duration-200 hover:bg-violet-400 disabled:opacity-50"
          >
            {busy === 'ai' ? 'AI is choosing an item…' : '✨ Ask AI to Prepare Order'}
          </button>

          <button
            onClick={() => void handleSimulateUnsafe()}
            disabled={busy !== ''}
            className="rounded-lg border border-yellow-500/60 bg-yellow-500/10 px-5 py-2.5 text-sm font-semibold text-yellow-300 transition-colors duration-200 hover:bg-yellow-500/20 disabled:opacity-50"
          >
            {busy === 'sim' ? 'Loading…' : '⚠️ Simulate Unsafe AI Order'}
          </button>

          <button
            onClick={() => pickDemo('safe')}
            className={[
              'rounded-lg border px-5 py-2.5 text-sm font-semibold transition-colors duration-200',
              liveOrder === null && mode === 'safe'
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                : 'border-slate-700 text-slate-300 hover:border-slate-500',
            ].join(' ')}
          >
            Load Safe Demo
          </button>

          <button
            onClick={() => pickDemo('unsafe')}
            className={[
              'rounded-lg border px-5 py-2.5 text-sm font-semibold transition-colors duration-200',
              liveOrder === null && mode === 'unsafe'
                ? 'border-red-500 bg-red-500/10 text-red-400'
                : 'border-slate-700 text-slate-300 hover:border-slate-500',
            ].join(' ')}
          >
            Load Unsafe Demo
          </button>
        </div>

        {/* Who made this order? */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-400">Current order:</span>
          {orderSource === 'NVIDIA_NIM' && <Badge tone="ai">Generated by NVIDIA NIM</Badge>}
          {orderSource === 'SECURITY_SIMULATION' && (
            <Badge tone="simulation">Security Demo Simulation</Badge>
          )}
          {orderSource === 'MANUAL_DEMO' && <Badge tone="neutral">Sample demo order</Badge>}
          <Badge tone="order">{order.orderId}</Badge>
        </div>

        {orderSource === 'SECURITY_SIMULATION' && (
          <p className="mt-4 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
            This is fixed sample data, not something the AI produced. We never ask the model
            to behave badly — the attack is scripted so the demo is predictable, and it goes
            through exactly the same MandateGuard check.
          </p>
        )}

        {aiReason && (
          <p className="mt-4 rounded-lg border border-violet-500/40 bg-violet-500/5 px-4 py-3 text-sm text-violet-200">
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
        <p className="mt-6 rounded-lg border border-red-500/40 bg-red-500/10 px-5 py-4 text-red-300">
          {error}
        </p>
      )}

      {/* Step 3 - the deterministic check */}
      <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="font-semibold text-white">2. Let MandateGuard decide</h2>
        <p className="mt-2 text-sm text-slate-400">
          Whoever created the order — the AI or the simulation — the same deterministic
          engine checks it. The AI never approves its own order.
        </p>

        <button
          onClick={() => void handleVerify()}
          disabled={busy !== ''}
          className="mt-4 rounded-lg bg-cyan-500 px-6 py-3 font-semibold text-slate-950 transition-colors duration-200 hover:bg-cyan-400 disabled:opacity-50"
        >
          {busy === 'verify' ? 'Checking…' : '🛡️ Verify with MandateGuard'}
        </button>
      </div>
    </section>
  )
}

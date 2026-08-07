import { useState } from 'react'
import { defaultPolicyInput, loadPolicy, savePolicy } from '../data/demoData'
import { createPolicy, verifyMandate } from '../services/api'
import type { AIOrder, SpendingPolicy, VerificationResult } from '../types'

interface Props {
  order: AIOrder
  maxPrice: number
}

/**
 * Part 11 - side-by-side.
 * Left side stays the amount-only view from Phase 3.
 * Right side runs the REAL MandateGuard engine on the same order.
 */
export default function GuardComparison({ order, maxPrice }: Props) {
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const ensurePolicy = async (): Promise<SpendingPolicy> => {
    const existing = loadPolicy()
    if (existing) return existing
    const fresh = await createPolicy(defaultPolicyInput)
    savePolicy(fresh)
    return fresh
  }

  const run = async () => {
    setBusy(true)
    setError('')
    setResult(null)

    try {
      const policy = await ensurePolicy()
      try {
        setResult(await verifyMandate(policy.id, order))
      } catch (err) {
        // Server memory resets on restart - recreate the policy and retry once.
        if ((err as Error & { status?: number }).status === 404) {
          const fresh = await createPolicy(defaultPolicyInput)
          savePolicy(fresh)
          setResult(await verifyMandate(fresh.id, order))
        } else {
          throw err
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach MandateGuard.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8">
      <h2 className="text-2xl font-bold text-white">Without vs With MandateGuard</h2>
      <p className="mt-2 text-slate-400">
        The same AI order, checked two different ways.
      </p>

      <button
        onClick={() => void run()}
        disabled={busy}
        className="mt-6 rounded-lg bg-cyan-500 px-6 py-3 font-semibold text-slate-950 transition-colors duration-200 hover:bg-cyan-400 disabled:opacity-60"
      >
        {busy ? 'Checking…' : '🛡️ Run MandateGuard on this order'}
      </button>

      {error && (
        <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-5 py-4 text-red-300">
          {error}
        </p>
      )}

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {/* WITHOUT */}
        <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/5 p-6">
          <h3 className="font-bold text-yellow-400">WITHOUT MANDATEGUARD</h3>
          <p className="mt-4 text-2xl font-bold text-white">
            ₹{order.price.toLocaleString('en-IN')} &lt; ₹{maxPrice.toLocaleString('en-IN')}
          </p>
          <p className="mt-3 inline-block rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 font-semibold text-emerald-400">
            PASS
          </p>
          <p className="mt-4 text-slate-300">Payment would proceed.</p>
          <p className="mt-2 text-xs text-slate-500">
            Only the amount was checked. Nothing else was looked at.
          </p>
        </div>

        {/* WITH */}
        <div
          className={[
            'rounded-xl border p-6',
            result
              ? result.decision === 'APPROVED'
                ? 'border-emerald-500/40 bg-emerald-500/5'
                : 'border-red-500/50 bg-red-500/5'
              : 'border-slate-700 bg-slate-900/60',
          ].join(' ')}
        >
          <h3 className="font-bold text-cyan-300">WITH MANDATEGUARD</h3>

          {!result ? (
            <p className="mt-4 text-slate-500">
              Press the button above to run the real policy engine.
            </p>
          ) : (
            <>
              <ul className="mt-4 space-y-1.5 text-sm">
                {result.checks.map((c) => (
                  <li key={c.rule} className="flex items-center justify-between gap-3">
                    <span className="text-slate-300">{c.rule}</span>
                    <span
                      className={
                        c.passed ? 'font-semibold text-emerald-400' : 'font-semibold text-red-400'
                      }
                    >
                      {c.passed ? 'PASS' : 'FAIL'}
                    </span>
                  </li>
                ))}
              </ul>

              <p
                className={[
                  'mt-5 rounded-lg border px-4 py-3 text-center text-xl font-bold',
                  result.decision === 'APPROVED'
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                    : 'border-red-500/50 bg-red-500/10 text-red-400',
                ].join(' ')}
              >
                FINAL RESULT: {result.decision}
              </p>

              {result.violations.length > 0 && (
                <ul className="mt-4 space-y-1 text-xs text-red-300">
                  {result.violations.map((v) => (
                    <li key={v}>✕ {v}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>

      <p className="mt-8 text-center text-2xl font-bold text-yellow-400">
        Amount approved ≠ Intent approved
      </p>
    </div>
  )
}

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
    <div className="block p-8">
      <h2 className="display text-[28px] text-[var(--ink)]">Without vs With MandateGuard</h2>
      <p className="mt-2 text-[var(--ink-soft)]">
        The same AI order, checked two different ways.
      </p>

      <button
        onClick={() => void run()}
        disabled={busy}
        className="mt-6 btn btn-solid disabled:opacity-60"
      >
        {busy ? 'Checking…' : 'Run MandateGuard on this order'}
      </button>

      {error && (
        <p className="mt-4 notice text-[var(--oxblood)]">
          {error}
        </p>
      )}

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {/* WITHOUT */}
        <div className="notice p-6">
          <h3 className="font-bold text-[var(--ochre)]">WITHOUT MANDATEGUARD</h3>
          <p className="mt-4 display text-[28px] text-[var(--ink)]">
            ₹{order.price.toLocaleString('en-IN')} &lt; ₹{maxPrice.toLocaleString('en-IN')}
          </p>
          <p className="mt-3 inline-block border border-[var(--forest)] bg-[var(--wash-green)] px-4 py-2 font-semibold text-[var(--forest)]">
            PASS
          </p>
          <p className="mt-4 text-[var(--ink-soft)]">Payment would proceed.</p>
          <p className="mt-2 text-xs text-[var(--ink-faint)]">
            Only the amount was checked. Nothing else was looked at.
          </p>
        </div>

        {/* WITH */}
        <div
          className={[
            ' border p-6',
            result
              ? result.decision === 'APPROVED' ? 'border-[var(--forest)] bg-[var(--wash-green)]' : 'border-[var(--oxblood)] bg-[var(--wash-red)]' : 'border-[var(--rule)] ',
          ].join(' ')}
        >
          <h3 className="font-bold text-[var(--indigo)]">WITH MANDATEGUARD</h3>

          {!result ? (
            <p className="mt-4 text-[var(--ink-faint)]">
              Press the button above to run the real policy engine.
            </p>
          ) : (
            <>
              <ul className="mt-4 space-y-1.5 text-sm">
                {result.checks.map((c) => (
                  <li key={c.rule} className="flex items-center justify-between gap-3">
                    <span className="text-[var(--ink-soft)]">{c.rule}</span>
                    <span
                      className={
                        c.passed ? 'font-semibold text-[var(--forest)]' : 'font-semibold text-[var(--oxblood)]'
}
                    >
                      {c.passed ? 'PASS' : 'FAIL'}
                    </span>
                  </li>
                ))}
              </ul>

              <p
                className={[
                  'mt-5  border px-4 py-3 text-center display text-[23px]',
                  result.decision === 'APPROVED' ? 'border-[var(--forest)] bg-[var(--wash-green)] text-[var(--forest)]' : 'border-[var(--oxblood)] bg-[var(--wash-red)] text-[var(--oxblood)]',
                ].join(' ')}
              >
                FINAL RESULT: {result.decision}
              </p>

              {result.violations.length > 0 && (
                <ul className="mt-4 space-y-1 text-xs text-[var(--oxblood)]">
                  {result.violations.map((v) => (
                    <li key={v}>✕ {v}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>

      <p className="mt-8 text-center display text-[28px] text-[var(--ochre)]">
        Amount approved ≠ Intent approved
      </p>
    </div>
  )
}

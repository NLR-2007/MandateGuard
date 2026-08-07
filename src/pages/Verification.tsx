import { useState } from 'react'
import { Link } from 'react-router-dom'
import Badge from '../components/Badge'
import VerificationCheck from '../components/VerificationCheck'
import { loadVerification } from '../data/demoData'
import { recordExecution } from '../services/api'
import type { VerificationResult } from '../types'

export default function Verification() {
  // The real answer from the backend, saved by the AI Order page.
  const [result] = useState<VerificationResult | null>(() =>
    loadVerification<VerificationResult>(),
  )
  const [executed, setExecuted] = useState(false)
  const [execError, setExecError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!result) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-3xl font-bold text-white">Verification Result</h1>
        <p className="mt-4 text-slate-400">
          Nothing has been verified yet in this browser.
        </p>
        <Link
          to="/order"
          className="mt-8 inline-block rounded-lg bg-cyan-500 px-6 py-3 font-semibold text-slate-950 transition-colors duration-200 hover:bg-cyan-400"
        >
          Go to the AI Order page
        </Link>
      </section>
    )
  }

  const approved = result.decision === 'APPROVED'
  const amountCheck = result.checks.find((c) => c.rule === 'Maximum Price')

  const handleExecute = async () => {
    setBusy(true)
    setExecError('')
    try {
      await recordExecution(result.verificationId)
      setExecuted(true)
    } catch (err) {
      setExecError(err instanceof Error ? err.message : 'Could not record the execution.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-bold text-white">Verification Result</h1>
      <p className="mt-2 text-slate-400">
        Decided by the MandateGuard engine — {result.verificationId} · policy{' '}
        {result.policyId} · order {result.orderId}
      </p>

      {/* Big result banner */}
      <div
        className={[
          'mt-10 rounded-2xl border p-10 text-center',
          approved
            ? 'border-emerald-500/40 bg-emerald-500/5'
            : 'border-red-500/40 bg-red-500/5',
        ].join(' ')}
      >
        <div className="text-7xl">🛡️</div>
        <h2
          className={[
            'mt-4 text-4xl font-bold tracking-wide',
            approved ? 'text-emerald-400' : 'text-red-400',
          ].join(' ')}
        >
          {result.decision}
        </h2>
        <p className="mt-3 text-slate-300">
          {approved
            ? 'This AI order matches the human-approved spending policy.'
            : 'MandateGuard stopped this request because it violated the human-approved policy.'}
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Badge tone="verified">MandateGuard Verified</Badge>
          <Badge tone={approved ? 'human' : 'blocked'}>
            Decided by TypeScript, not by AI
          </Badge>
        </div>
      </div>

      {/* The headline message for a blocked order */}
      {!approved && amountCheck?.passed && (
        <div className="mt-8 rounded-2xl border border-yellow-500/40 bg-yellow-500/5 p-8 text-center">
          <p className="text-xl font-bold text-white sm:text-2xl">
            ₹{Number(amountCheck.actual).toLocaleString('en-IN')} is within the spending
            limit.
          </p>
          <p className="mt-2 text-lg text-yellow-300">
            But {result.violations.length} other human-approved rule
            {result.violations.length > 1 ? 's were' : ' was'} violated.
          </p>
          <p className="mt-6 text-2xl font-bold text-red-400">
            MandateGuard BLOCKED the transaction.
          </p>
        </div>
      )}

      {/* Violations first - the "why" matters most */}
      {!approved && (
        <div className="mt-10 rounded-xl border border-red-500/40 bg-red-500/5 p-6">
          <h3 className="font-semibold text-red-400">
            Why it was blocked ({result.violations.length})
          </h3>
          <ul className="mt-4 space-y-2">
            {result.violations.map((v) => (
              <li key={v} className="flex gap-3 text-slate-200">
                <span className="font-bold text-red-400">✕</span>
                {v}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Every rule that was checked */}
      <div className="mt-10">
        <h3 className="mb-4 font-semibold text-white">
          All policy checks ({result.checks.filter((c) => c.passed).length}/
          {result.checks.length} passed)
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {result.checks.map((check) => (
            <VerificationCheck key={check.rule} check={check} />
          ))}
        </div>
      </div>

      {/* Simulated execution - only for approved results */}
      {approved && (
        <div className="mt-10 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <h3 className="font-semibold text-white">Simulated execution</h3>
          <p className="mt-2 text-sm text-slate-400">
            Marks this approved order as spent so the daily limit can be demonstrated. No
            real payment occurs.
          </p>

          {executed ? (
            <p className="mt-4 rounded-lg border border-blue-500/40 bg-blue-500/10 px-5 py-3 text-blue-300">
              Recorded as SIMULATED_EXECUTED. No real payment occurred.
            </p>
          ) : (
            <button
              onClick={handleExecute}
              disabled={busy}
              className="mt-4 rounded-lg border border-slate-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:border-cyan-400 hover:text-cyan-300 disabled:opacity-60"
            >
              {busy ? 'Recording…' : 'Mark as simulated executed'}
            </button>
          )}

          {execError && <p className="mt-3 text-sm text-red-300">{execError}</p>}
        </div>
      )}

      <div className="mt-10 flex flex-wrap gap-4">
        <Link
          to="/order"
          className="rounded-lg border border-slate-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:border-cyan-400 hover:text-cyan-300"
        >
          ← Back to AI Order
        </Link>
        <Link
          to="/history"
          className="rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors duration-200 hover:bg-cyan-400"
        >
          View Audit History
        </Link>
      </div>
    </section>
  )
}

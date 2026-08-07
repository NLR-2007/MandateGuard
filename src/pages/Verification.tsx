import { useState } from 'react'
import DemoPageNote from '../components/DemoPageNote'
import { Link } from 'react-router-dom'
import Badge from '../components/Badge'
import VerificationCheck from '../components/VerificationCheck'
import { loadVerification } from '../data/demoData'
import { recordExecution } from '../services/api'
import type { PaidVerificationResult } from '../services/x402Client'
import type { VerificationResult } from '../types'
/** The paid route adds payment + mandate proof; the free route does not. */
type StoredResult = VerificationResult & Partial<PaidVerificationResult>

export default function Verification() {
  // The real answer from the backend, saved by the AI Order page.
  const [result] = useState<StoredResult | null>(() => loadVerification<StoredResult>())
  const [executed, setExecuted] = useState(false)
  const [execError, setExecError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!result) {
    return (
      <section className="pt-20 text-center">
        <h1 className="display text-[clamp(32px,5vw,46px)] text-[var(--ink)]">Verification Result</h1>
        <p className="mt-4 text-[var(--ink-soft)]">
          Nothing has been verified yet in this browser.
        </p>
        <Link
          to="/order"
          className="mt-8 inline-block btn btn-solid"
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
    <section className="pt-10">
      <DemoPageNote />
      <h1 className="display text-[clamp(32px,5vw,46px)] text-[var(--ink)]">Verification Result</h1>
      <p className="mt-2 text-[var(--ink-soft)]">
        Decided by the MandateGuard engine — {result.verificationId} · policy{' '}
        {result.policyId} · order {result.orderId}
      </p>

      {/* Big result banner */}
      <div
        className={[
          'mt-10  border p-10 text-center',
          approved
            ? 'border-[var(--forest)] bg-[var(--wash-green)]' : 'border-[var(--oxblood)] bg-[var(--wash-red)]',
        ].join(' ')}
      >
        <div className="text-7xl"></div>
        <h2
          className={[
            'mt-4 text-4xl font-bold tracking-wide',
            approved ? 'text-[var(--forest)]' : 'text-[var(--oxblood)]',
          ].join(' ')}
        >
          {result.decision}
        </h2>
        <p className="mt-3 text-[var(--ink-soft)]">
          {approved
            ? 'This AI order matches the human-approved spending policy.' : 'MandateGuard stopped this request because it violated the human-approved policy.'}
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Badge tone="verified">MandateGuard Verified</Badge>
          <Badge tone={approved ? 'human' : 'blocked'}>
            Decided by TypeScript, not by AI
          </Badge>
        </div>
      </div>

      {/* TWO SEPARATE ANSWERS - payment vs intent */}
      {result.payment && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div
            className={[
              ' border p-6 text-center',
              result.payment.status === 'VERIFIED' ? 'border-[var(--forest)] bg-[var(--wash-green)]' : 'border-[var(--ochre)] bg-[var(--wash-ochre)]',
            ].join(' ')}
          >
            <p className="text-sm text-[var(--ink-soft)]">x402 Payment</p>
            <p
              className={[
                'mt-2 display text-[28px]',
                result.payment.status === 'VERIFIED' ? 'text-[var(--forest)]' : 'text-[var(--ochre)]',
              ].join(' ')}
            >
              {result.payment.status === 'VERIFIED' ? '✓ VERIFIED' : '? UNKNOWN'}
            </p>
            <p className="mt-2 text-xs text-[var(--ink-faint)]">
              {result.payment.amount} {result.payment.asset}
            </p>
          </div>

          <div
            className={[
              ' border p-6 text-center',
              approved
                ? 'border-[var(--forest)] bg-[var(--wash-green)]' : 'border-[var(--oxblood)] bg-[var(--wash-red)]',
            ].join(' ')}
          >
            <p className="text-sm text-[var(--ink-soft)]">MandateGuard Decision</p>
            <p
              className={[
                'mt-2 display text-[28px]',
                approved ? 'text-[var(--forest)]' : 'text-[var(--oxblood)]',
              ].join(' ')}
            >
              {approved ? '✓ APPROVED' : '✕ BLOCKED'}
            </p>
            <p className="mt-2 text-xs text-[var(--ink-faint)]">
              {result.violations.length} violation
              {result.violations.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      )}

      {/* The message that makes the whole point */}
      {result.payment?.status === 'VERIFIED' && !approved && (
        <p className="mt-4 notice px-6 py-4 text-center text-lg font-semibold text-[var(--ochre)]">
          Payment for verification succeeded. The unsafe AI purchase was blocked.
        </p>
      )}

      {/* The headline message for a blocked order */}
      {!approved && amountCheck?.passed && (
        <div className="mt-8 notice p-8 text-center">
          <p className="display text-[23px] text-[var(--ink)] sm:text-2xl">
            ₹{Number(amountCheck.actual).toLocaleString('en-IN')} is within the spending
            limit.
          </p>
          <p className="mt-2 text-lg text-[var(--ochre)]">
            But {result.violations.length} other human-approved rule
            {result.violations.length > 1 ? 's were' : ' was'} violated.
          </p>
          <p className="mt-6 display text-[28px] text-[var(--oxblood)]">
            MandateGuard BLOCKED the transaction.
          </p>
        </div>
      )}

      {/* Violations first - the "why" matters most */}
      {!approved && (
        <div className="mt-10 notice p-6">
          <h3 className="font-semibold text-[var(--oxblood)]">
            Why it was blocked ({result.violations.length})
          </h3>
          <ul className="mt-4 space-y-2">
            {result.violations.map((v) => (
              <li key={v} className="flex gap-3 text-[var(--ink)]">
                <span className="font-bold text-[var(--oxblood)]">✕</span>
                {v}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Every rule that was checked */}
      <div className="mt-10">
        <h3 className="mb-4 display text-[19px]">
          All policy checks ({result.checks.filter((c) => c.passed).length}/
          {result.checks.length} passed)
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {result.checks.map((check) => (
            <VerificationCheck key={check.rule} check={check} />
          ))}
        </div>
      </div>

      {/* BLOCKCHAIN PROOF */}
      {result.payment && (
        <div className="mt-10 block p-6">
          <h3 className="flex items-center gap-2 font-semibold text-[var(--indigo)]">
            Blockchain Proof
          </h3>

          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-[var(--ink-soft)]">Network</dt>
              <dd className="text-[var(--ink)]">{result.payment.network}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--ink-soft)]">x402 Payment</dt>
              <dd
                className={
                  result.payment.status === 'VERIFIED' ? 'text-[var(--forest)]' : 'text-[var(--ochre)]'
}
              >
                {result.payment.status === 'VERIFIED' ? 'Verified' : 'Not Verified'}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-[var(--ink-soft)]">Transaction ID</dt>
              <dd className="mono text-sm break-all text-[var(--ink)]">
                {result.payment.transactionId ?? (
                  <span className="text-[var(--ink-faint)]">
                    Not returned by the facilitator for this payment
                  </span>
                )}
              </dd>
            </div>
            {result.payment.payer && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-[var(--ink-soft)]">Payer</dt>
                <dd className="mono text-sm break-all text-[var(--ink)]">
                  {result.payment.payer}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-[var(--ink-soft)]">Asset / Amount</dt>
              <dd className="text-[var(--ink)]">
                {result.payment.asset} · {result.payment.amount}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--ink-soft)]">Verified At</dt>
              <dd className="text-[var(--ink)]">
                {new Date(result.payment.verifiedAt).toLocaleString()}
              </dd>
            </div>

            {result.mandate && (
              <>
                <div>
                  <dt className="text-xs text-[var(--ink-soft)]">Mandate Proof</dt>
                  <dd className="text-[var(--ink)]">
                    {result.mandate.onChain
                      ? 'Written to Algorand TestNet'
                      : 'Recorded in MySQL only'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--ink-soft)]">Mandate Status</dt>
                  <dd className="text-[var(--ink)]">{result.mandate.status}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-[var(--ink-soft)]">Mandate Hash (SHA-256)</dt>
                  <dd className="mono text-xs break-all text-[var(--ink-soft)]">
                    {result.mandate.mandateHash}
                  </dd>
                </div>
              </>
            )}
          </dl>

          {result.payment.explorerUrl ? (
            <a
              href={result.payment.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-solid mt-5 inline-block"
            >
              View on Algorand Explorer ↗
            </a>
          ) : (
            <p className="mt-5 text-sm text-[var(--ink-faint)]">
              No explorer link — a transaction id was not returned, so nothing is invented
              here.
            </p>
          )}

          {result.mandate?.anchorExplorerUrl && (
            <a
              href={result.mandate.anchorExplorerUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-sm mt-4 inline-block"
            >
              View the mandate proof on Algorand ↗
            </a>
          )}

          {result.mandate && (
            <p className="footnote mt-4">{result.mandate.note}</p>
          )}
        </div>
      )}

      {/* Simulated execution - only for approved results */}
      {approved && (
        <div className="mt-10 block p-6">
          <h3 className="display text-[19px]">Simulated execution</h3>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            Marks this approved order as spent so the daily limit can be demonstrated. No
            real payment occurs.
          </p>

          {executed ? (
            <p className="mt-4 notice text-[var(--indigo)]">
              Recorded as SIMULATED_EXECUTED. No real payment occurred.
            </p>
          ) : (
            <button
              onClick={handleExecute}
              disabled={busy}
              className="mt-4 border border-[var(--ink)] px-5 py-2.5 text-sm display text-[19px] transition-colors duration-200 hover:border-[var(--ink)] hover:text-[var(--indigo)] disabled:opacity-60"
            >
              {busy ? 'Recording…' : 'Mark as simulated executed'}
            </button>
          )}

          {execError && <p className="mt-3 text-sm text-[var(--oxblood)]">{execError}</p>}
        </div>
      )}

      <div className="mt-10 flex flex-wrap gap-4">
        <Link
          to="/order"
          className="border border-[var(--ink)] px-5 py-2.5 text-sm display text-[19px] transition-colors duration-200 hover:border-[var(--ink)] hover:text-[var(--indigo)]"
        >
          ← Back to AI Order
        </Link>
        <Link
          to="/history"
          className="btn btn-solid"
        >
          View Audit History
        </Link>
      </div>
    </section>
  )
}

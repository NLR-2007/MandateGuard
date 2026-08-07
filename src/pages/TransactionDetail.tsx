import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Badge from '../components/Badge'
import { getAuditEntry } from '../services/api'
import type { AuditEntry, FlowEvent } from '../types'

function timeOf(iso: string): string {
  const d = new Date(iso)
  return Number.isFinite(d.getTime()) ? d.toLocaleTimeString() : iso
}

export default function TransactionDetail() {
  const { verificationId = '' } = useParams()
  const [entry, setEntry] = useState<AuditEntry | null>(null)
  const [timeline, setTimeline] = useState<FlowEvent[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    getAuditEntry(verificationId)
      .then((data) => {
        if (cancelled) return
        setEntry(data.entry)
        setTimeline(data.timeline ?? [])
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load it.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [verificationId])

  if (loading) {
    return <p className="mx-auto max-w-4xl px-6 py-20 text-slate-400">Loading…</p>
  }

  if (error || !entry) {
    return (
      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h1 className="text-2xl font-bold text-white">Transaction not found</h1>
        <p className="mt-3 text-slate-400">{error}</p>
        <Link
          to="/history"
          className="mt-8 inline-block rounded-lg bg-cyan-500 px-6 py-3 font-semibold text-slate-950 hover:bg-cyan-400"
        >
          Back to history
        </Link>
      </section>
    )
  }

  const approved = entry.decision === 'APPROVED'

  return (
    <section className="mx-auto max-w-4xl px-6 py-12">
      <Link to="/history" className="text-sm text-slate-400 hover:text-cyan-300">
        ← Back to history
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-white">{entry.verificationId}</h1>
        <div className="flex flex-wrap gap-2">
          <Badge tone={approved ? 'human' : 'blocked'}>{entry.decision}</Badge>
          <Badge tone={entry.x402PaymentStatus === 'VERIFIED' ? 'verified' : 'neutral'}>
            x402 {entry.x402PaymentStatus === 'NOT_PAID' ? 'FREE ROUTE' : entry.x402PaymentStatus}
          </Badge>
          {entry.requestId && <Badge tone="neutral">{entry.requestId}</Badge>}
        </div>
      </div>

      {/* Order + policy */}
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-cyan-500/30 bg-slate-900/60 p-6">
          <h3 className="font-semibold text-cyan-300">Human Policy</h3>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Policy ID" value={entry.policyId} />
            <Row label="Mandate Status" value={entry.mandateStatus ?? '—'} />
            <Row
              label="Mandate Hash"
              value={entry.mandateHash ? `${entry.mandateHash.slice(0, 24)}…` : '—'}
            />
          </dl>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <h3 className="font-semibold text-white">AI Order</h3>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Order ID" value={entry.orderId} />
            <Row label="Product" value={entry.product} />
            <Row label="Amount" value={`₹${entry.amount.toLocaleString('en-IN')}`} />
            <Row label="Seller" value={entry.seller} />
            <Row label="Order Source" value={entry.orderSource.replace(/_/g, ' ')} />
          </dl>
        </div>
      </div>

      {/* Violations */}
      <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        <h3 className="font-semibold text-white">MandateGuard result</h3>
        {entry.violations.length === 0 ? (
          <p className="mt-3 text-emerald-300">
            All checks passed — this order matched the human-approved policy.
          </p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm text-red-300">
            {entry.violations.map((v) => (
              <li key={v}>✕ {v}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Blockchain */}
      <div className="mt-6 rounded-xl border border-blue-500/40 bg-blue-500/5 p-6">
        <h3 className="font-semibold text-blue-300">Blockchain</h3>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <Row label="Network" value={entry.blockchainNetwork ?? '—'} />
          <Row label="x402 Payment" value={entry.x402PaymentStatus} />
          <Row label="Fee" value={entry.x402Amount ?? '—'} />
          <Row
            label="Payment Verified At"
            value={entry.paymentVerifiedAt ? timeOf(entry.paymentVerifiedAt) : '—'}
          />
          <Row label="Execution" value={entry.executionStatus.replace(/_/g, ' ')} />
          <Row label="Checked At" value={timeOf(entry.checkedAt)} />
        </dl>

        <p className="mt-4 text-sm">
          <span className="text-slate-400">Algorand transaction: </span>
          <span className="font-mono break-all text-white">
            {entry.x402TransactionId ?? 'none for this verification'}
          </span>
        </p>

        {entry.x402TransactionId && (
          <a
            href={`https://lora.algokit.io/testnet/transaction/${entry.x402TransactionId}`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-blue-400"
          >
            View x402 Payment on Algorand Explorer ↗
          </a>
        )}
      </div>

      {/* Timeline */}
      <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        <h3 className="font-semibold text-white">Audit timeline</h3>
        {timeline.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No timeline events recorded for this verification.
          </p>
        ) : (
          <ol className="mt-4 space-y-3">
            {timeline.map((event, i) => (
              <li key={`${event.at}-${i}`} className="flex gap-4 text-sm">
                <span className="w-24 shrink-0 font-mono text-slate-400">
                  {timeOf(event.at)}
                </span>
                <span>
                  <span className="text-white">{event.step}</span>
                  {event.detail && (
                    <span className="block text-xs text-slate-500">{event.detail}</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right break-all text-white">{value}</dd>
    </div>
  )
}

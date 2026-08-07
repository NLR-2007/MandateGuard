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
  const { verificationId = ''
} = useParams()
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
    return <p className="label pt-20">loading…</p>
  }

  if (error || !entry) {
    return (
      <section className="pt-24 text-center">
        <h1 className="display text-[32px]">Not found</h1>
        <p className="label mt-3">{error}</p>
        <Link
          to="/history"
          className="btn btn-solid mt-8 inline-block"
        >
          Back to history
        </Link>
      </section>
    )
  }

  const approved = entry.decision === 'APPROVED'
return (
    <section className="pt-10">
      <Link to="/history" className="label ink-link">
        ← Back to history
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <h1 className="display text-[clamp(32px,5vw,46px)]">{entry.verificationId}</h1>
        <div className="flex flex-wrap gap-2">
          <Badge tone={approved ? 'human' : 'blocked'}>{entry.decision}</Badge>
          <Badge tone={entry.x402PaymentStatus === 'VERIFIED' ? 'verified' : 'neutral'}>
            x402 {entry.x402PaymentStatus === 'NOT_PAID' ? 'FREE ROUTE' : entry.x402PaymentStatus}
          </Badge>
          {entry.requestId && <Badge tone="neutral">{entry.requestId}</Badge>}
        </div>
      </div>

      {/* Order + policy */}
      <div className="rule-double mt-6" />
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div className="sheet p-6">
          <h3 className="display text-[21px]">Human policy</h3>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Policy ID" value={entry.policyId} />
            <Row label="Mandate Status" value={entry.mandateStatus ?? '—'} />
            <Row
              label="Mandate Hash"
              value={entry.mandateHash ? `${entry.mandateHash.slice(0, 24)}…` : '—'}
            />
          </dl>
        </div>

        <div className="block p-6">
          <h3 className="display text-[21px]">AI order</h3>
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
      <div className="block mt-6 p-6">
        <h3 className="display text-[21px]">MandateGuard result</h3>
        {entry.violations.length === 0 ? (
          <p className="mt-3 text-[14px]" style={{ color: 'var(--forest)'
}}>
            All checks passed — this order matched the human-approved policy.
          </p>
        ) : (
          <ul className="mt-3 space-y-1 text-[13px]" style={{ color: 'var(--oxblood)'
}}>
            {entry.violations.map((v) => (
              <li key={v}>✕ {v}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Blockchain */}
      <div className="block mt-6 p-6">
        <h3 className="display text-[21px]">Blockchain proof</h3>
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
          <span className="label">Algorand transaction </span>
          <span className="mono break-all">
            {entry.x402TransactionId ?? 'none for this verification'}
          </span>
        </p>

        {entry.x402TransactionId && (
          <a
            href={`https://lora.algokit.io/testnet/transaction/${entry.x402TransactionId}`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-solid mt-4 inline-block"
          >
            View x402 Payment on Algorand Explorer ↗
          </a>
        )}
      </div>

      {/* Timeline */}
      <div className="block mt-6 p-6">
        <h3 className="display text-[21px]">Timeline</h3>
        {timeline.length === 0 ? (
          <p className="label mt-3">
            No timeline events recorded for this verification.
          </p>
        ) : (
          <ol className="mt-4 space-y-3">
            {timeline.map((event, i) => (
              <li key={`${event.at}-${i}`} className="flex gap-4 text-sm">
                <span className="mono w-24 shrink-0 text-[11px]" style={{ color: 'var(--oxblood)'
}}>
                  {timeOf(event.at)}
                </span>
                <span>
                  <span className="text-[14px]">{event.step}</span>
                  {event.detail && (
                    <span className="mono block text-[11px]" style={{ color: 'var(--ink-faint)'
}}>{event.detail}</span>
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
    <div className="flex justify-between gap-4 border-b py-1.5" style={{ borderColor: 'var(--rule-soft)'
}}>
      <dt className="label">{label}</dt>
      <dd className="mono text-right text-[12px] break-all">{value}</dd>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { rupees } from '../api'

interface AuditEntry {
  verificationId: string
  product: string
  amount: number
  seller: string
  decision: 'APPROVED' | 'BLOCKED'
  violations: string[]
  checkedAt: string
  x402TransactionId: string | null
}

/**
 * Order history.
 *
 * Refused attempts are shown alongside completed ones, on purpose: a shop
 * that hides what it stopped is not proving anything.
 */
export default function Orders() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const GUARD = import.meta.env.VITE_GUARD_API ?? 'http://localhost:4021'

  useEffect(() => {
    const load = () =>
      fetch(`${GUARD}/api/audit`)
        .then((r) => r.json())
        .then((d) => setEntries((d.entries ?? []).slice().reverse()))
        .catch(() => {})
    void load()
    const id = setInterval(load, 4000)
    return () => clearInterval(id)
  }, [GUARD])

  return (
    <div className="py-10">
      <h1 className="display text-[clamp(28px,4vw,40px)]">Your orders</h1>
      <p className="mt-2 text-[15px]" style={{ color: 'var(--ink-soft)' }}>
        Everything your AI shopper attempted — including what MandateGuard stopped.
      </p>

      {entries.length === 0 && (
        <p className="mt-10" style={{ color: 'var(--ink-faint)' }}>
          Nothing yet.
        </p>
      )}

      <div className="mt-8 space-y-3">
        {entries.map((e) => (
          <div key={e.verificationId} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-[16px] font-semibold">{e.product}</h3>
                <p className="text-[13px]" style={{ color: 'var(--ink-faint)' }}>
                  {e.seller} · {new Date(e.checkedAt).toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <span className="display text-[20px]">{rupees(e.amount)}</span>
                <span
                  className={`pill mt-1 block ${e.decision === 'APPROVED' ? 'pill-good' : 'pill-bad'}`}
                >
                  {e.decision === 'APPROVED' ? 'Ordered' : 'Refused'}
                </span>
              </div>
            </div>

            {e.violations.length > 0 && (
              <ol className="mt-3 space-y-1">
                {e.violations.map((v, i) => (
                  <li key={v} className="text-[13px]" style={{ color: 'var(--bad)' }}>
                    <span className="mono mr-1.5 opacity-60">{String(i + 1).padStart(2, '0')}</span>
                    {v}
                  </li>
                ))}
              </ol>
            )}

            {e.x402TransactionId && (
              <a
                className="pill pill-good mt-3 inline-flex underline"
                href={`https://lora.algokit.io/testnet/transaction/${e.x402TransactionId}`}
                target="_blank"
                rel="noreferrer"
              >
                Payment on Algorand ↗
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

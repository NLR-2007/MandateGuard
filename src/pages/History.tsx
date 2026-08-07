import { useEffect, useState } from 'react'
import Sheet from '../components/Sheet'
import TransactionTable from '../components/TransactionTable'
import { getAudit } from '../services/api'
import type { AuditEntry } from '../types'
export default function History() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [spentToday, setSpentToday] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getAudit()
      setEntries(data.entries)
      setSpentToday(data.spentToday)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the history.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const approved = entries.filter((e) => e.decision === 'APPROVED').length
  const blocked = entries.filter((e) => e.decision === 'BLOCKED').length

  return (
    <section className="pt-10">
      <div className="reveal d1 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="label">Audit history</span>
          <h1 className="display mt-1 text-[clamp(34px,5vw,52px)]">History</h1>
        </div>
        <button onClick={() => void load()} className="btn btn-sm">
          Refresh
        </button>
      </div>
      <div className="rule-double mt-6" />

      {/* Standing */}
      <div className="reveal d2 mt-5 flex flex-wrap gap-x-10 gap-y-3">
        <Tally n={entries.length} label="entries" />
        <Tally n={approved} label="approved" tone="var(--forest)" />
        <Tally n={blocked} label="blocked" tone="var(--oxblood)" />
        <span className="flex items-baseline gap-2">
          <span className="display text-[28px]">₹{spentToday.toLocaleString('en-IN')}</span>
          <span className="label">spent today</span>
        </span>
      </div>

      <div className="mt-10">
        <Sheet mark="01">
          {error && (
            <p
              className="border-l-4 py-3 pl-4 text-[14px]"
              style={{ borderColor: 'var(--oxblood)', color: 'var(--oxblood)'
}}
            >
              {error}
            </p>
          )}

          {!error && loading && <p className="label">loading…</p>}

          {!error && !loading && entries.length === 0 && (
            <div
              className="border border-dashed px-6 py-16 text-center"
              style={{ borderColor: 'var(--rule)'
}}
            >
              <p className="display text-[22px]" style={{ color: 'var(--ink-faint)'
}}>
                No entries yet.
              </p>
              <p className="label mt-2">Run a verification from the Dashboard.</p>
            </div>
          )}

          {!error && !loading && entries.length > 0 && (
            <>
              <TransactionTable entries={entries} />
              <p className="label mt-5 max-w-3xl leading-relaxed">
                Entries paid through x402 carry a real Algorand TestNet transaction — the
                proof column links to the explorer. Entries marked “free route” skipped the
                payment layer. History is stored in MySQL and survives a restart.
              </p>
            </>
          )}
        </Sheet>
      </div>
    </section>
  )
}

function Tally({ n, label, tone }: { n: number; label: string; tone?: string }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="display text-[28px]" style={{ color: tone ?? 'var(--ink)'
}}>
        {n}
      </span>
      <span className="label">{label}</span>
    </span>
  )
}

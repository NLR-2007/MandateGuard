import { useEffect, useState } from 'react'
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
      setError(err instanceof Error ? err.message : 'Could not load the audit log.')
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
    <section className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Audit History</h1>
          <p className="mt-2 text-slate-400">
            Every verification the engine made, newest first. Loaded live from the server.
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:border-cyan-400 hover:text-cyan-300"
        >
          Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-sm text-slate-400">Total Verifications</p>
          <p className="mt-1 text-2xl font-bold text-white">{entries.length}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-sm text-slate-400">Approved</p>
          <p className="mt-1 text-2xl font-bold text-emerald-400">{approved}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-sm text-slate-400">Blocked</p>
          <p className="mt-1 text-2xl font-bold text-red-400">{blocked}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-sm text-slate-400">Simulated spend today</p>
          <p className="mt-1 text-2xl font-bold text-blue-300">
            ₹{spentToday.toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-8 rounded-lg border border-red-500/40 bg-red-500/10 px-5 py-4 text-red-300">
          {error}
        </p>
      )}

      {!error && loading && <p className="mt-8 text-slate-400">Loading…</p>}

      {!error && !loading && entries.length === 0 && (
        <p className="mt-8 rounded-xl border border-dashed border-slate-800 px-6 py-10 text-center text-slate-500">
          No verifications yet. Send an order from the AI Order page.
        </p>
      )}

      {!error && !loading && entries.length > 0 && (
        <div className="mt-8">
          <TransactionTable entries={entries} />
        </div>
      )}

      <p className="mt-4 text-sm text-slate-500">
        Rows paid through x402 carry a real Algorand TestNet transaction — click the id to
        open it in the explorer. Rows marked FREE ROUTE skipped the payment layer. The
        audit log lives in server memory and resets when the server restarts.
      </p>
    </section>
  )
}

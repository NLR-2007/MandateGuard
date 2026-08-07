import Badge from './Badge'
import type { AuditEntry } from '../types'

const policySourceLabel = {
  MANUAL: 'Human written',
  NVIDIA_NIM_ASSISTED: 'AI assisted',
} as const

const orderSourceLabel = {
  MANUAL_DEMO: 'Demo order',
  NVIDIA_NIM: 'AI order',
  SECURITY_SIMULATION: 'Simulation',
} as const

interface Props {
  entries: AuditEntry[]
}

/**
 * Colour rules:
 *   green  = APPROVED
 *   red    = BLOCKED
 *   yellow = APPROVED but not executed yet
 *   blue   = simulated executed
 */
function decisionStyle(entry: AuditEntry): string {
  if (entry.decision === 'BLOCKED') {
    return 'border-red-500/40 bg-red-500/10 text-red-400'
  }
  return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
}

function executionStyle(entry: AuditEntry): string {
  if (entry.executionStatus === 'SIMULATED_EXECUTED') {
    return 'border-blue-500/40 bg-blue-500/10 text-blue-300'
  }
  if (entry.decision === 'APPROVED') {
    return 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300'
  }
  return 'border-slate-700 bg-slate-800/60 text-slate-400'
}

function executionLabel(entry: AuditEntry): string {
  if (entry.executionStatus === 'SIMULATED_EXECUTED') return 'SIMULATED EXECUTED'
  if (entry.decision === 'APPROVED') return 'APPROVED — NOT EXECUTED'
  return 'NOT EXECUTED'
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return Number.isFinite(d.getTime()) ? d.toLocaleTimeString() : iso
}

export default function TransactionTable({ entries }: Props) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full min-w-[1100px] text-left text-sm">
        <thead className="bg-slate-900 text-slate-400">
          <tr>
            <th className="px-4 py-3 font-medium">Verification ID</th>
            <th className="px-4 py-3 font-medium">Policy ID</th>
            <th className="px-4 py-3 font-medium">Order ID</th>
            <th className="px-4 py-3 font-medium">Product</th>
            <th className="px-4 py-3 font-medium">Amount</th>
            <th className="px-4 py-3 font-medium">Seller</th>
            <th className="px-4 py-3 font-medium">Source</th>
            <th className="px-4 py-3 font-medium">Decision</th>
            <th className="px-4 py-3 font-medium">Violations</th>
            <th className="px-4 py-3 font-medium">Time</th>
            <th className="px-4 py-3 font-medium">Execution</th>
            <th className="px-4 py-3 font-medium">Blockchain</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.verificationId}
              className="border-t border-slate-800 align-top transition-colors duration-200 hover:bg-slate-900/60"
            >
              <td className="px-4 py-3 font-medium text-white">{entry.verificationId}</td>
              <td className="px-4 py-3 text-slate-300">{entry.policyId}</td>
              <td className="px-4 py-3 text-slate-300">{entry.orderId}</td>
              <td className="px-4 py-3 text-slate-300">{entry.product}</td>
              <td className="px-4 py-3 text-slate-300">
                ₹{entry.amount.toLocaleString('en-IN')}
              </td>
              <td className="px-4 py-3 text-slate-300">{entry.seller}</td>
              <td className="px-4 py-3">
                <div className="flex flex-col gap-1">
                  <Badge tone={entry.policySource === 'MANUAL' ? 'human' : 'ai'}>
                    {policySourceLabel[entry.policySource] ?? entry.policySource}
                  </Badge>
                  <Badge
                    tone={
                      entry.orderSource === 'SECURITY_SIMULATION'
                        ? 'simulation'
                        : entry.orderSource === 'NVIDIA_NIM'
                          ? 'ai'
                          : 'neutral'
                    }
                  >
                    {orderSourceLabel[entry.orderSource] ?? entry.orderSource}
                  </Badge>
                </div>
              </td>
              <td className="px-4 py-3">
                <span
                  className={[
                    'rounded-full border px-3 py-1 text-xs font-semibold',
                    decisionStyle(entry),
                  ].join(' ')}
                >
                  {entry.decision}
                </span>
              </td>
              <td className="max-w-[260px] px-4 py-3">
                {entry.violations.length === 0 ? (
                  <span className="text-slate-500">—</span>
                ) : (
                  <ul className="space-y-1">
                    {entry.violations.map((v) => (
                      <li key={v} className="text-xs text-red-300">
                        ✕ {v}
                      </li>
                    ))}
                  </ul>
                )}
              </td>
              <td className="px-4 py-3 text-slate-300">{formatTime(entry.checkedAt)}</td>
              <td className="px-4 py-3">
                <span
                  className={[
                    'rounded-full border px-3 py-1 text-xs font-semibold',
                    executionStyle(entry),
                  ].join(' ')}
                >
                  {executionLabel(entry)}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-500">Not Connected — Phase 6</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

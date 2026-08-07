import { Link } from 'react-router-dom'
import type { AuditEntry } from '../types'
const policySourceLabel = {
  MANUAL: 'by hand',
  NVIDIA_NIM_ASSISTED: 'ai-assisted',
} as const

const orderSourceLabel = {
  MANUAL_DEMO: 'sample',
  NVIDIA_NIM: 'agent',
  SECURITY_SIMULATION: 'tampered',
} as const

function executionLabel(entry: AuditEntry): string {
  if (entry.executionStatus === 'SIMULATED_EXECUTED') return 'executed'
  if (entry.decision === 'APPROVED') return 'not executed'
  return '—'
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return Number.isFinite(d.getTime()) ? d.toLocaleTimeString() : iso
}

export default function TransactionTable({ entries }: { entries: AuditEntry[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="ledger min-w-[1000px]">
        <thead>
          <tr>
            <th>Verification</th>
            <th>Policy</th>
            <th>Order</th>
            <th>Product</th>
            <th className="text-right">Amount</th>
            <th>Seller</th>
            <th>Source</th>
            <th>Decision</th>
            <th>Reasons</th>
            <th>x402</th>
            <th>Algorand tx</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const blocked = entry.decision === 'BLOCKED'
return (
              <tr key={entry.verificationId}>
                <td className="mono">
                  <Link to={`/history/${entry.verificationId}`} className="ink-link">
                    {entry.verificationId}
                  </Link>
                </td>
                <td className="mono" style={{ color: 'var(--ink-soft)'
}}>
                  {entry.policyId}
                </td>
                <td className="mono text-[11px]" style={{ color: 'var(--ink-soft)'
}}>
                  {entry.orderId}
                </td>
                <td>{entry.product}</td>
                <td className="mono text-right">₹{entry.amount.toLocaleString('en-IN')}</td>
                <td>{entry.seller}</td>
                <td className="label" style={{ whiteSpace: 'nowrap'
}}>
                  {policySourceLabel[entry.policySource] ?? entry.policySource}
                  <br />
                  {orderSourceLabel[entry.orderSource] ?? entry.orderSource}
                </td>
                <td>
                  <span
                    className="mono text-[11px] font-semibold tracking-[0.14em] uppercase"
                    style={{ color: blocked ? 'var(--oxblood)' : 'var(--forest)'
}}
                  >
                    {blocked ? '✕ blocked' : '✓ approved'}
                  </span>
                  <span className="label mt-0.5 block">{executionLabel(entry)}</span>
                </td>
                <td className="max-w-[230px]">
                  {entry.violations.length === 0 ? (
                    <span style={{ color: 'var(--ink-faint)'
}}>—</span>
                  ) : (
                    <ol className="space-y-0.5">
                      {entry.violations.map((v) => (
                        <li key={v} className="text-[11.5px]" style={{ color: 'var(--oxblood)'
}}>
                          {v}
                        </li>
                      ))}
                    </ol>
                  )}
                </td>
                <td className="label" style={{ whiteSpace: 'nowrap'
}}>
                  {entry.x402PaymentStatus === 'NOT_PAID' ? 'free route' : entry.x402PaymentStatus.toLowerCase()}
                </td>
                <td className="max-w-[140px]">
                  {entry.x402TransactionId ? (
                    <a
                      href={`https://lora.algokit.io/testnet/transaction/${entry.x402TransactionId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="ink-link mono text-[11px] break-all"
                    >
                      {entry.x402TransactionId.slice(0, 10)}…
                    </a>
                  ) : (
                    <span style={{ color: 'var(--ink-faint)'
}}>—</span>
                  )}
                  <span className="label mt-0.5 block">
                    {entry.mandateStatus ? entry.mandateStatus.toLowerCase() : '—'}
                  </span>
                </td>
                <td className="mono text-[11px]" style={{ color: 'var(--ink-soft)'
}}>
                  {formatTime(entry.checkedAt)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

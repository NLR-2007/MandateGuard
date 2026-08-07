import type { SpendingPolicy } from '../types'

interface Props {
  policy: SpendingPolicy
  /** Extra rows are hidden by default to keep the card clean. */
  detailed?: boolean
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-800 py-2 last:border-b-0">
      <span className="text-slate-400">{label}</span>
      <span className="text-right font-medium text-white">{value}</span>
    </div>
  )
}

export default function PolicyCard({ policy, detailed = false }: Props) {
  return (
    <div className="rounded-xl border border-cyan-500/30 bg-slate-900/60 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-white">Human Spending Policy</h3>
        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
          {policy.status}
        </span>
      </div>

      <div className="text-sm">
        <Row label="Policy ID" value={policy.id} />
        <Row label="Product" value={policy.product} />
        <Row label="Quantity" value={String(policy.quantity)} />
        <Row label="Max Price" value={`₹${policy.maxPrice}`} />
        <Row label="Seller" value={policy.approvedSeller} />
        <Row label="Warranty" value={policy.warrantyAllowed ? 'Allowed' : 'Not Allowed'} />
        {detailed && (
          <>
            <Row label="Receiver Wallet" value={policy.approvedReceiverWallet} />
            <Row label="Per Transaction Limit" value={`₹${policy.perTransactionLimit}`} />
            <Row label="Daily Limit" value={`₹${policy.dailyLimit}`} />
            <Row label="Expires At" value={policy.expiresAt.replace('T', ' ')} />
          </>
        )}
      </div>
    </div>
  )
}

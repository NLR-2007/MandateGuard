import type { SpendingPolicy } from '../types'
interface Props {
  policy: SpendingPolicy
  /** Extra rows are hidden by default to keep the card clean. */
  detailed?: boolean
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--rule)] py-2 last:border-b-0">
      <span className="text-[var(--ink-soft)]">{label}</span>
      <span className="text-right font-medium text-[var(--ink)]">{value}</span>
    </div>
  )
}

export default function PolicyCard({ policy, detailed = false }: Props) {
  return (
    <div className="border border-[var(--indigo)] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="display text-[19px]">Human Spending Policy</h3>
        <span className="border border-[var(--forest)] bg-[var(--wash-green)] px-3 py-1 text-xs font-semibold text-[var(--forest)]">
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

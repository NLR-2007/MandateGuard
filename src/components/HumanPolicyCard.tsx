import type { SpendingPolicy } from '../types'
interface Props {
  policy: SpendingPolicy
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-[var(--rule)] py-2.5 last:border-b-0">
      <p className="text-xs text-[var(--ink-soft)]">{label}</p>
      <p className="mt-0.5 font-medium text-[var(--ink)]">{value}</p>
    </div>
  )
}

/** Phase 3 - the rules the human approved. Calm blue/green styling. */
export default function HumanPolicyCard({ policy }: Props) {
  return (
    <div className="h-full sheet p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-bold tracking-wide text-[var(--indigo)]">
           HUMAN APPROVED POLICY
        </h3>
        <span className="border border-[var(--forest)] bg-[rgba(39,81,47,0.07)] px-3 py-1 text-xs font-semibold text-[var(--forest)]">
          ACTIVE
        </span>
      </div>

      <div className="text-sm">
        <Row label="Product" value={policy.product} />
        <Row label="Quantity" value={String(policy.quantity)} />
        <Row label="Maximum Price" value={`₹${policy.maxPrice.toLocaleString('en-IN')}`} />
        <Row label="Approved Seller" value={policy.approvedSeller} />
        <Row label="Warranty" value={policy.warrantyAllowed ? 'Allowed' : 'Not Allowed'} />
        <Row label="Receiver Wallet" value={policy.approvedReceiverWallet} />
      </div>
    </div>
  )
}

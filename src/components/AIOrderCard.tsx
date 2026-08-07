import type { AIOrder, ChangedFields, SpendingPolicy } from '../types'
interface Props {
  policy: SpendingPolicy
  order: AIOrder
  /** Which rows to paint red. Comes from demo data, not from a comparison. */
  changed: ChangedFields
}

function Row({
  label,
  value,
  wasValue,
  isChanged,
}: {
  label: string
  value: string
  wasValue?: string
  isChanged?: boolean
}) {
  return (
    <div className="border-b border-[var(--rule)] py-2.5 last:border-b-0">
      <p className="text-xs text-[var(--ink-soft)]">{label}</p>
      {isChanged ? (
        <p className="mt-0.5 flex flex-wrap items-center gap-2 font-medium">
          <span className="text-[var(--ink-faint)] line-through">{wasValue}</span>
          <span className="text-[var(--oxblood)]">→</span>
          <span className="rounded bg-[rgba(140,29,24,0.06)] px-2 py-0.5 text-[var(--oxblood)]">{value}</span>
        </p>
      ) : (
        <p className="mt-0.5 font-medium text-[var(--ink)]">{value}</p>
      )}
    </div>
  )
}

/** Phase 3 - what the AI actually prepared. Warning styling. */
export default function AIOrderCard({ policy, order, changed }: Props) {
  const anyChange = Boolean(
    changed.quantity || changed.seller || changed.warranty || changed.receiver,
  )

  return (
    <div
      className={[
        'h-full  border p-6',
        anyChange ? 'border-[var(--oxblood)] bg-[rgba(140,29,24,0.06)]' : 'border-[var(--forest)] bg-[rgba(39,81,47,0.07)]',
      ].join(' ')}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3
          className={[
            'flex items-center gap-2 font-bold tracking-wide',
            anyChange ? 'text-[var(--oxblood)]' : 'text-[var(--forest)]',
          ].join(' ')}
        >
          <span>{anyChange ? '' : ''}</span> AI PREPARED ORDER
        </h3>
        <span
          className={[
            'tag',
            anyChange
              ? 'border-[var(--oxblood)] bg-[rgba(140,29,24,0.06)] text-[var(--oxblood)]' : 'border-[var(--forest)] bg-[rgba(39,81,47,0.07)] text-[var(--forest)]',
          ].join(' ')}
        >
          {anyChange ? 'CHANGED' : 'MATCHES'}
        </span>
      </div>

      <div className="text-sm">
        <Row label="Product" value={order.product} />
        <Row
          label="Quantity"
          value={String(order.quantity)}
          wasValue={String(policy.quantity)}
          isChanged={changed.quantity}
        />
        <Row label="Price" value={`₹${order.price.toLocaleString('en-IN')}`} />
        <Row
          label="Seller"
          value={order.seller}
          wasValue={policy.approvedSeller}
          isChanged={changed.seller}
        />
        <Row
          label="Warranty"
          value={order.warrantyAdded ? 'Added' : 'No'}
          wasValue={policy.warrantyAllowed ? 'Allowed' : 'No'}
          isChanged={changed.warranty}
        />
        <Row
          label="Receiver Wallet"
          value={order.receiverWallet}
          wasValue={policy.approvedReceiverWallet}
          isChanged={changed.receiver}
        />
      </div>
    </div>
  )
}

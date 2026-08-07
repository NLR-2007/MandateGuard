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
    <div className="border-b border-slate-800 py-2.5 last:border-b-0">
      <p className="text-xs text-slate-400">{label}</p>
      {isChanged ? (
        <p className="mt-0.5 flex flex-wrap items-center gap-2 font-medium">
          <span className="text-slate-500 line-through">{wasValue}</span>
          <span className="text-red-400">→</span>
          <span className="rounded bg-red-500/15 px-2 py-0.5 text-red-300">{value}</span>
        </p>
      ) : (
        <p className="mt-0.5 font-medium text-white">{value}</p>
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
        'h-full rounded-xl border p-6',
        anyChange ? 'border-red-500/50 bg-red-500/5' : 'border-emerald-500/40 bg-emerald-500/5',
      ].join(' ')}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3
          className={[
            'flex items-center gap-2 font-bold tracking-wide',
            anyChange ? 'text-red-400' : 'text-emerald-400',
          ].join(' ')}
        >
          <span>{anyChange ? '⚠️' : '🤖'}</span> AI PREPARED ORDER
        </h3>
        <span
          className={[
            'rounded-full border px-3 py-1 text-xs font-semibold',
            anyChange
              ? 'border-red-500/40 bg-red-500/10 text-red-400'
              : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
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

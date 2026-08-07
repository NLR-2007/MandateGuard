import type { AIOrder, SpendingPolicy } from '../types'
import PolicyCard from './PolicyCard'

interface Props {
  policy: SpendingPolicy
  order: AIOrder
  /** Unsafe demo highlights the changed lines in red. */
  unsafe: boolean
}

function OrderRow({
  label,
  value,
  changed,
}: {
  label: string
  value: string
  changed: boolean
}) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-800 py-2 last:border-b-0">
      <span className="text-slate-400">{label}</span>
      <span
        className={[
          'text-right font-medium',
          changed ? 'text-red-400' : 'text-white',
        ].join(' ')}
      >
        {value}
        {changed && <span className="ml-2 text-xs text-red-500">changed</span>}
      </span>
    </div>
  )
}

export default function OrderComparison({ policy, order, unsafe }: Props) {
  // Display-only highlighting. The real decision is made by the backend.
  const quantityChanged = order.quantity !== policy.quantity
  const sellerChanged = order.seller !== policy.approvedSeller
  const warrantyChanged = order.warrantyAdded && !policy.warrantyAllowed
  const receiverChanged = order.receiverWallet !== policy.approvedReceiverWallet

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Left: what the human approved */}
      <PolicyCard policy={policy} />

      {/* Right: what the AI prepared */}
      <div
        className={[
          'rounded-xl border bg-slate-900/60 p-6',
          unsafe ? 'border-red-500/40' : 'border-emerald-500/30',
        ].join(' ')}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-white">AI Prepared Order</h3>
          <span
            className={[
              'rounded-full border px-3 py-1 text-xs font-semibold',
              unsafe
                ? 'border-red-500/40 bg-red-500/10 text-red-400'
                : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
            ].join(' ')}
          >
            {unsafe ? 'Unsafe Demo' : 'Safe Demo'}
          </span>
        </div>

        <div className="text-sm">
          <OrderRow label="Product" value={order.product} changed={false} />
          <OrderRow
            label="Quantity"
            value={String(order.quantity)}
            changed={quantityChanged}
          />
          <OrderRow label="Price" value={`₹${order.price}`} changed={false} />
          <OrderRow label="Seller" value={order.seller} changed={sellerChanged} />
          <OrderRow
            label="Warranty"
            value={order.warrantyAdded ? 'Added' : 'No'}
            changed={warrantyChanged}
          />
          <OrderRow
            label="Receiver Wallet"
            value={order.receiverWallet}
            changed={receiverChanged}
          />
        </div>
      </div>
    </div>
  )
}

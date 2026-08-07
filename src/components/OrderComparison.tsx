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
    <div className="flex justify-between gap-4 border-b border-[var(--rule)] py-2 last:border-b-0">
      <span className="text-[var(--ink-soft)]">{label}</span>
      <span
        className={[
          'text-right font-medium',
          changed ? 'text-[var(--oxblood)]' : 'text-[var(--ink)]',
        ].join(' ')}
      >
        {value}
        {changed && <span className="ml-2 text-xs text-[var(--oxblood)]">changed</span>}
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
          ' border  p-6',
          unsafe ? 'border-[var(--oxblood)]' : 'border-[var(--forest)]',
        ].join(' ')}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="display text-[19px]">AI Prepared Order</h3>
          <span
            className={[
              'tag',
              unsafe
                ? 'border-[var(--oxblood)] bg-[rgba(140,29,24,0.06)] text-[var(--oxblood)]' : 'border-[var(--forest)] bg-[rgba(39,81,47,0.07)] text-[var(--forest)]',
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

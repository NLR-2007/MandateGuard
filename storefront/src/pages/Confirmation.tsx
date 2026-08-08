import { Link, useLocation, useParams } from 'react-router-dom'
import { rupees } from '../api'
import type { Receipt } from '../x402Client'

/**
 * The receipt.
 *
 * Everything here came back from the payment itself. If Algorand did not
 * return a transaction id, this page says so rather than showing a link that
 * goes nowhere.
 */
export default function Confirmation() {
  const { orderId } = useParams()
  const { state } = useLocation() as { state?: { receipt?: Receipt } }
  const receipt = state?.receipt

  return (
    <div className="py-14">
      <div className="card mx-auto max-w-[640px] p-9">
        <div
          className="mx-auto grid h-14 w-14 place-items-center rounded-full text-[26px]"
          style={{ background: 'rgba(15,107,79,0.12)' }}
        >
          ✓
        </div>

        <h1 className="display mt-5 text-center text-[32px]">Order confirmed</h1>
        <p className="mt-2 text-center text-[15px]" style={{ color: 'var(--ink-soft)' }}>
          Thank you. Your order is on its way.
        </p>

        <div
          className="mt-8 space-y-3 border-t pt-6"
          style={{ borderColor: 'var(--line)' }}
        >
          <Row label="Order number" value={receipt?.orderId ?? orderId ?? '—'} mono />
          {receipt && (
            <>
              <Row label="Item" value={receipt.item.product} />
              <Row label="Seller" value={receipt.payment.seller} />
              <Row
                label="Paid"
                value={`${rupees(receipt.payment.amountRupees)} · ${receipt.payment.amountUsdc} USDC`}
              />
              <Row label="Seller wallet" value={receipt.payment.sellerWallet} mono />
              {receipt.payment.transactionId && (
                <Row label="Transaction" value={receipt.payment.transactionId} mono />
              )}
            </>
          )}
        </div>

        {receipt?.payment.explorerUrl ? (
          <a
            className="btn btn-dark mt-7 w-full"
            href={receipt.payment.explorerUrl}
            target="_blank"
            rel="noreferrer"
          >
            View this payment on Algorand ↗
          </a>
        ) : (
          <p className="mt-7 text-center text-[13px]" style={{ color: 'var(--ink-faint)' }}>
            No transaction reference was returned, so none is shown here.
          </p>
        )}

        <div
          className="mt-7 rounded-lg p-4 text-center"
          style={{ background: 'rgba(15,107,79,0.07)' }}
        >
          <span className="pill pill-good">🛡 Checked by MandateGuard before payment</span>
          <p className="mt-2 text-[13px]" style={{ color: 'var(--ink-soft)' }}>
            This order matched the spending rule you approved. Anything outside it would
            have been refused before your money moved.
          </p>
        </div>

        <div className="mt-7 flex justify-center gap-3">
          <Link to="/" className="btn btn-quiet">
            Keep shopping
          </Link>
          <Link to="/orders" className="btn btn-brand">
            See all orders
          </Link>
        </div>

        {receipt && (
          <p className="mt-6 text-center text-[12px]" style={{ color: 'var(--ink-faint)' }}>
            {receipt.payment.demoRate}
          </p>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="eyebrow">{label}</span>
      <span className={`${mono ? 'mono break-all' : ''} text-[14px]`}>{value}</span>
    </div>
  )
}

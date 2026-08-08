import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useWallet } from '@txnlab/use-wallet-react'
import { askGuard, getPolicies, rupees, type GuardVerdict, type Policy } from '../api'
import { describePayError, PAY_LABEL, payForItem, type PayStage } from '../x402Client'
import { useCart } from '../cart'

/**
 * Checkout — the only place NovaMart talks to MandateGuard.
 *
 * The shop describes the order and receives a yes or a no. It holds no rules
 * and cannot overrule the answer: a BLOCKED verdict simply means the pay
 * button never appears.
 */
export default function Checkout() {
  const navigate = useNavigate()
  const { activeAddress, signTransactions } = useWallet()
  const { items, remove, clear, total } = useCart()
  const [stage, setStage] = useState<PayStage>('idle')
  const [policies, setPolicies] = useState<Policy[]>([])
  const [policyId, setPolicyId] = useState('')
  const [verdicts, setVerdicts] = useState<Record<string, GuardVerdict>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void getPolicies()
      .then((list) => {
        setPolicies(list)
        const active = list.filter((p) => p.status === 'ACTIVE').at(-1)
        if (active) setPolicyId(active.id)
      })
      .catch(() => setError('The checkout guard is not reachable. Purchases are paused.'))
  }, [])

  const rule = policies.find((p) => p.id === policyId)

  const runGuard = async () => {
    if (!policyId || items.length === 0) return
    setBusy(true)
    setError('')
    try {
      const next: Record<string, GuardVerdict> = {}
      for (const item of items) {
        next[item.id] = await askGuard(policyId, item)
      }
      setVerdicts(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The guard could not be reached.')
    } finally {
      setBusy(false)
    }
  }

  /**
   * Pay for the approved basket.
   *
   * Only reachable when every item came back APPROVED - the shop cannot
   * offer this button for an order the guard refused.
   */
  const pay = async () => {
    if (!activeAddress || !signTransactions || items.length === 0) return
    setBusy(true)
    setError('')
    try {
      let last
      for (const item of items) {
        last = await payForItem({
          itemId: item.id,
          policyId,
          wallet: {
            address: activeAddress,
            signTransactions: signTransactions as unknown as (
              t: Uint8Array[],
            ) => Promise<(Uint8Array | null)[]>,
          },
          onStage: setStage,
        })
      }
      clear()
      if (last) navigate(`/order/${last.orderId}`, { state: { receipt: last } })
    } catch (err) {
      setStage('failed')
      setError(describePayError(err))
    } finally {
      setBusy(false)
    }
  }

  const checked = Object.keys(verdicts).length > 0
  const allApproved =
    checked && items.every((i) => verdicts[i.id]?.decision === 'APPROVED')
  const anyBlocked = items.some((i) => verdicts[i.id]?.decision === 'BLOCKED')

  if (items.length === 0) {
    return (
      <div className="py-20 text-center">
        <h1 className="display text-[30px]">Your cart is empty</h1>
        <Link to="/" className="btn btn-brand mt-6">
          Browse the shop
        </Link>
      </div>
    )
  }

  return (
    <div className="py-10">
      <h1 className="display text-[clamp(28px,4vw,40px)]">Checkout</h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        {/* Basket */}
        <div className="space-y-3">
          {items.map((item) => {
            const v = verdicts[item.id]
            return (
              <div key={item.id + Math.random()} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[16px] font-semibold">{item.product}</h3>
                    <p className="text-[13px]" style={{ color: 'var(--ink-faint)' }}>
                      {item.seller}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="display text-[20px]">{rupees(item.price)}</span>
                    <button
                      onClick={() => remove(item.id)}
                      className="block text-[13px] underline"
                      style={{ color: 'var(--ink-faint)' }}
                    >
                      remove
                    </button>
                  </div>
                </div>

                {v && (
                  <div
                    className="mt-4 rounded-lg p-4"
                    style={{
                      background:
                        v.decision === 'APPROVED'
                          ? 'rgba(15,107,79,0.07)'
                          : 'rgba(192,39,26,0.07)',
                    }}
                  >
                    <span
                      className={`pill ${v.decision === 'APPROVED' ? 'pill-good' : 'pill-bad'}`}
                    >
                      {v.decision === 'APPROVED'
                        ? '🛡 MandateGuard approved'
                        : '🛡 MandateGuard blocked this'}
                    </span>

                    {v.violations.length > 0 && (
                      <ol className="mt-3 space-y-1">
                        {v.violations.map((x, i) => (
                          <li key={x} className="text-[13px]" style={{ color: 'var(--bad)' }}>
                            <span className="mono mr-1.5 opacity-60">
                              {String(i + 1).padStart(2, '0')}
                            </span>
                            {x}
                          </li>
                        ))}
                      </ol>
                    )}

                    <p className="mt-2 text-[12px]" style={{ color: 'var(--ink-faint)' }}>
                      {v.checks.filter((c) => c.passed).length}/{v.checks.length} rules passed ·{' '}
                      {v.verificationId}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Summary */}
        <div>
          <div className="card p-6">
            <span className="eyebrow">Spending rule in force</span>
            <select
              className="field mt-2"
              value={policyId}
              onChange={(e) => {
                setPolicyId(e.target.value)
                setVerdicts({})
              }}
            >
              {policies.length === 0 && <option value="">No rule available</option>}
              {policies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} — {p.product} under {rupees(p.maxPrice)} ({p.status})
                </option>
              ))}
            </select>

            {rule && (
              <ul className="mt-4 space-y-1 text-[13px]" style={{ color: 'var(--ink-soft)' }}>
                <li>Only {rule.approvedSeller}</li>
                <li>Up to {rupees(rule.maxPrice)} per item</li>
                <li>{rupees(rule.perTransactionLimit)} per transaction</li>
                <li>{rupees(rule.dailyLimit)} per day</li>
                <li>{rule.warrantyAllowed ? 'Warranty allowed' : 'No warranty'}</li>
              </ul>
            )}

            <div
              className="mt-5 flex items-baseline justify-between border-t pt-4"
              style={{ borderColor: 'var(--line)' }}
            >
              <span className="eyebrow">Total</span>
              <span className="display text-[26px]">{rupees(total)}</span>
            </div>

            {!checked ? (
              <button
                className="btn btn-dark mt-5 w-full"
                onClick={() => void runGuard()}
                disabled={busy || !policyId}
              >
                {busy ? 'Checking with MandateGuard…' : '🛡 Check this order'}
              </button>
            ) : allApproved ? (
              <>
                <button
                  className="btn btn-brand mt-5 w-full"
                  onClick={() => void pay()}
                  disabled={busy || !activeAddress}
                >
                  {busy ? `${PAY_LABEL[stage]}…` : `Pay ${rupees(total)}`}
                </button>
                <p className="mt-2 text-[13px]" style={{ color: 'var(--ink-faint)' }}>
                  {activeAddress
                    ? 'Paid in Test USDC straight to the seller. NovaMart never holds your money.'
                    : 'Sign in with your wallet to pay.'}
                </p>
              </>
            ) : (
              <div className="mt-5">
                <button className="btn mt-0 w-full" disabled>
                  Payment blocked
                </button>
                <p className="mt-2 text-[13px]" style={{ color: 'var(--bad)' }}>
                  MandateGuard refused part of this order, so NovaMart will not take your
                  money.
                </p>
              </div>
            )}

            {anyBlocked && (
              <button
                className="btn btn-quiet mt-3 w-full"
                onClick={() => {
                  setVerdicts({})
                }}
              >
                Change the cart and check again
              </button>
            )}

            {error && (
              <p className="mt-3 text-[13px]" style={{ color: 'var(--bad)' }}>
                {error}
              </p>
            )}
          </div>

          {/* The integration, shown honestly */}
          <div className="card mt-4 p-5">
            <span className="eyebrow">How this shop is protected</span>
            <p className="mt-2 text-[13px]" style={{ color: 'var(--ink-soft)' }}>
              NovaMart holds no spending rules of its own. Before payment it makes one call:
            </p>
            <pre
              className="mono mt-3 overflow-x-auto rounded-lg p-3 text-[11.5px] leading-relaxed"
              style={{ background: 'var(--sunk)', color: 'var(--ink-soft)' }}
            >{`const verdict = await fetch(
  GUARD + '/api/verify-mandate',
  { method: 'POST', body: JSON.stringify({ policyId, order }) }
).then(r => r.json())

if (verdict.decision !== 'APPROVED') return refuse(verdict.violations)`}</pre>
          </div>
        </div>
      </div>
    </div>
  )
}

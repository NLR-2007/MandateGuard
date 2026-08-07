import { useWallet } from '@txnlab/use-wallet-react'
import { useEffect, useState, type CSSProperties } from 'react'
import Badge from '../components/Badge'
import WalletBar from '../components/WalletBar'
import VerificationCheck from '../components/VerificationCheck'
import {
  type AgentMode,
  type AgentRun,
  type ShopProduct,
  getAgentRun,
  getShopProducts,
  listPolicies,
  sendAgentShopping,
} from '../services/api'
import {
  describePaymentError,
  paySeller,
  STAGE_LABELS,
  type PaymentStage,
  type PurchaseResult,
} from '../services/x402Client'
import type { SpendingPolicy } from '../types'

/**
 * The shop, and the agent that buys from it.
 *
 * The order of events is the point: the AI picks, MandateGuard rules on the
 * pick, and only then is the user involved at all - and in Autonomous mode,
 * not even then. Approval never overrides the engine.
 */
export default function Shop() {
  const { activeAddress, signTransactions } = useWallet()

  const [products, setProducts] = useState<ShopProduct[]>([])
  const [rate, setRate] = useState('')
  const [policies, setPolicies] = useState<SpendingPolicy[]>([])
  const [policyId, setPolicyId] = useState('')
  const [mode, setMode] = useState<AgentMode>('ASK')

  const [run, setRun] = useState<AgentRun | null>(null)
  const [purchase, setPurchase] = useState<PurchaseResult | null>(null)
  const [stage, setStage] = useState<PaymentStage>('idle')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    void getShopProducts().then((d) => {
      setProducts(d.products)
      setRate(d.demoRate)
    })
    void listPolicies().then((list) => {
      setPolicies(list)
      const active = list.find((p) => p.status === 'ACTIVE')
      if (active) setPolicyId(active.id)
    })
  }, [])

  /** While Telegram holds the answer, the page has to watch for it. */
  useEffect(() => {
    if (run?.state !== 'PENDING_APPROVAL') return
    const id = setInterval(() => {
      void getAgentRun(run.requestId)
        .then((fresh) => {
          if (fresh.state !== 'PENDING_APPROVAL') setRun(fresh)
        })
        .catch(() => {})
    }, 2000)
    return () => clearInterval(id)
  }, [run])

  const handleShop = async () => {
    if (!policyId) return
    setBusy('shop')
    setError('')
    setRun(null)
    setPurchase(null)
    try {
      setRun(await sendAgentShopping(policyId, mode))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The agent could not run.')
    } finally {
      setBusy('')
    }
  }

  const handlePay = async () => {
    if (!run?.item || !activeAddress || !signTransactions) return
    setBusy('pay')
    setError('')
    try {
      setPurchase(
        await paySeller({
          itemId: run.item.id,
          mandateId: run.policyId,
          wallet: {
            address: activeAddress,
            signTransactions: signTransactions as unknown as (
              t: Uint8Array[],
            ) => Promise<(Uint8Array | null)[]>,
          },
          onStage: setStage,
        }),
      )
    } catch (err) {
      setStage('failed')
      setError(describePaymentError(err))
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="pt-8">
      <span className="gutter-mark">The shop</span>
      <h1 className="display mt-3 text-[clamp(28px,4vw,42px)]">
        An agent that actually buys things
      </h1>
      <p className="footnote mt-3 max-w-[46rem]">
        The AI searches this catalogue and picks. MandateGuard rules on the pick before
        any money moves. In Autonomous mode nobody is asked — but everything is still
        checked.
      </p>

      <div className="mt-6">
        <WalletBar />
      </div>

      {/* Controls */}
      <div className="sheet mt-8 p-7">
        <span className="label">Send the agent shopping</span>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <span className="label label-ink mb-1.5 block">Rule to obey</span>
            <select
              className="field"
              value={policyId}
              onChange={(e) => setPolicyId(e.target.value)}
            >
              {policies.length === 0 && <option value="">No rules yet</option>}
              {policies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} — {p.quantity} × {p.product} under ₹{p.maxPrice} ({p.status})
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="label label-ink mb-1.5 block">Mode</span>
            <div className="flex border" style={{ borderColor: 'var(--rule)' }}>
              {(['ASK', 'AUTONOMOUS'] as AgentMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="mono flex-1 px-3 py-2 text-[10px] tracking-[0.14em] uppercase"
                  style={
                    mode === m
                      ? { background: 'var(--accent)', color: 'var(--accent-ink)' }
                      : { color: 'var(--ink-faint)' }
                  }
                >
                  {m === 'ASK' ? 'Ask me first' : 'Autonomous'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          className="btn btn-solid mt-6"
          onClick={() => void handleShop()}
          disabled={busy !== '' || !policyId}
        >
          {busy === 'shop' ? 'Agent is shopping…' : '🤖 Send the agent shopping'}
        </button>

        <p className="footnote mt-2">
          {mode === 'ASK'
            ? 'Telegram will ask you before paying.'
            : 'Nobody will be asked. MandateGuard still checks every rule.'}
        </p>
      </div>

      {error && (
        <p
          className="mt-6 border-l-4 py-3 pl-4 text-[14px]"
          style={{
            borderColor: 'var(--oxblood)',
            color: 'var(--oxblood)',
            background: 'var(--wash-red)',
          }}
        >
          {error}
        </p>
      )}

      {/* The run */}
      {run && (
        <div className="sheet reveal mt-8 p-7">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="ai">AI chose this</Badge>
            <Badge tone={run.decision === 'APPROVED' ? 'verified' : 'blocked'}>
              MandateGuard {run.decision}
            </Badge>
            <Badge tone="neutral">{run.mode === 'ASK' ? 'Ask mode' : 'Autonomous'}</Badge>
          </div>

          <div className="mt-6 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="display text-[26px]">{run.order.product}</h2>
            <span className="mono text-[15px]">
              ₹{run.order.price.toLocaleString('en-IN')}
              <span style={{ color: 'var(--ink-faint)' }}> → {run.priceUsdc} USDC</span>
            </span>
          </div>

          <p className="footnote mt-1">
            from <b>{run.order.seller}</b> · <i>{run.reason}</i>
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {run.checks.map((c, i) => (
              <VerificationCheck key={c.rule} check={c} index={i} />
            ))}
          </div>

          {run.state === 'BLOCKED' && (
            <div
              className="mt-7 border-l-4 p-5"
              style={{ borderColor: 'var(--oxblood)', background: 'var(--wash-red)' }}
            >
              <p className="display text-[19px]" style={{ color: 'var(--oxblood)' }}>
                Refused. Nothing was paid.
              </p>
              <ol className="mt-3 space-y-1.5">
                {run.violations.map((v, i) => (
                  <li key={v} className="flex gap-3 text-[14px]">
                    <span className="mono" style={{ color: 'var(--oxblood)' }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {v}
                  </li>
                ))}
              </ol>
              <p className="footnote mt-3">Your phone has the same message.</p>
            </div>
          )}

          {run.state === 'PENDING_APPROVAL' && (
            <div className="block live mt-7 p-5">
              <span className="label">Waiting for you</span>
              <p className="mt-2 text-[15px]">
                Open Telegram and tap <b>Approve</b> or <b>Reject</b>.
              </p>
              <p className="footnote mt-2">
                This page is watching. It continues the moment you answer.
              </p>
            </div>
          )}

          {run.state === 'REJECTED' && (
            <p className="notice mt-7">You rejected this order. Nothing was paid.</p>
          )}

          {run.state === 'READY_TO_PAY' && !purchase && (
            <div className="mt-7">
              <button
                className="btn btn-solid"
                onClick={() => void handlePay()}
                disabled={busy !== '' || !activeAddress}
              >
                {busy === 'pay'
                  ? `${STAGE_LABELS[stage]}…`
                  : `💸 Pay ${run.order.seller} ${run.priceUsdc} USDC`}
              </button>
              <p className="footnote mt-2">
                {activeAddress
                  ? `Real test USDC goes to the seller's own wallet on Algorand TestNet. ${rate}`
                  : 'Connect your wallet above first.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Receipt */}
      {purchase && (
        <div className="sheet reveal mt-8 p-7">
          <div className="flex justify-center">
            <span className="stamp stamp-hit stamp-lg stamp-approved">
              Paid
              <sub>{purchase.orderId}</sub>
            </span>
          </div>

          <div className="mt-7 space-y-2">
            <Row label="Product" value={purchase.item.product} />
            <Row
              label="Paid"
              value={`₹${purchase.payment.amountRupees.toLocaleString('en-IN')} → ${purchase.payment.amountUsdc} USDC`}
            />
            <Row label="Seller" value={purchase.payment.seller} />
            <Row label="Seller wallet" value={purchase.payment.sellerWallet} mono />
            {purchase.payment.transactionId && (
              <Row label="Transaction" value={purchase.payment.transactionId} mono />
            )}
          </div>

          {purchase.payment.explorerUrl ? (
            <a
              className="btn btn-solid mt-6 inline-block"
              href={purchase.payment.explorerUrl}
              target="_blank"
              rel="noreferrer"
            >
              View the payment on Algorand ↗
            </a>
          ) : (
            <p className="footnote mt-6">
              No transaction id was returned, so no link is shown. Nothing is invented.
            </p>
          )}

          <p className="footnote mt-4">
            {purchase.payment.demoRate}. The full receipt is on your phone.
          </p>
        </div>
      )}

      {/* Catalogue */}
      <h2 className="display mt-12 text-[24px]">What the agent can choose from</h2>
      <p className="footnote mt-1">
        A fixed catalogue, not a live marketplace — but the seller wallets are real
        TestNet accounts. {rate}
      </p>

      <div
        className="mt-5 grid gap-px sm:grid-cols-2 lg:grid-cols-3"
        style={{ background: 'var(--rule)' }}
      >
        {products.map((p, i) => (
          <div
            key={p.id}
            className="tick p-5"
            style={{ background: 'var(--paper-card)', '--i': i } as CSSProperties}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="label">{p.category}</span>
              <span className="mono text-[11px]" style={{ color: 'var(--ochre)' }}>
                ★ {p.rating}
              </span>
            </div>
            <p className="mt-2 text-[15px]" style={{ color: 'var(--ink)' }}>
              {p.product}
            </p>
            <p className="mono mt-1 text-[13px]">
              ₹{p.price.toLocaleString('en-IN')}
              <span style={{ color: 'var(--ink-faint)' }}> · {p.priceUsdc} USDC</span>
            </p>
            <p className="footnote mt-1">{p.seller}</p>
            {!p.inStock && (
              <span className="tag tag-red mt-2 inline-block">out of stock</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="label">{label}</span>
      <span
        className={`${mono ? 'mono break-all' : ''} text-[13px]`}
        style={{ color: 'var(--ink)' }}
      >
        {value}
      </span>
    </div>
  )
}

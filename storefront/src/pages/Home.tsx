import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getLive, getPolicies, getProducts, rupees, sendAgent, type Product } from '../api'
import { useCart } from '../cart'

const GLYPH: Record<string, string> = {
  storage: '💾',
  books: '📗',
  laptops: '💻',
  accessories: '🎧',
}

const FILTERS = [
  { id: 'all', label: 'Everything' },
  { id: 'storage', label: 'Storage' },
  { id: 'laptops', label: 'Laptops' },
  { id: 'books', label: 'Books' },
  { id: 'accessories', label: 'Accessories' },
]

/** A believable "was" price, so the discount badge is not invented on the fly. */
function listPrice(price: number): number {
  return Math.round((price * 1.22) / 10) * 10
}

export default function Home() {
  const [params, setParams] = useSearchParams()
  const { add } = useCart()

  const [products, setProducts] = useState<Product[]>([])
  const [rate, setRate] = useState('')
  const [policyId, setPolicyId] = useState('')
  const [sending, setSending] = useState('')
  const [spotlight, setSpotlight] = useState<string | null>(null)

  const category = params.get('c') ?? 'all'
  const query = (params.get('q') ?? '').toLowerCase()

  useEffect(() => {
    void getProducts().then((d) => {
      setProducts(d.products)
      setRate(d.demoRate)
    })
    void getPolicies()
      .then((list) => list.filter((p) => p.status === 'ACTIVE').at(-1))
      .then((p) => p && setPolicyId(p.id))
      .catch(() => {})
  }, [])

  /**
   * Mark whatever the agent is currently looking at.
   *
   * Only the highlight lives here. Moving the page is the pilot's job — doing
   * it from a poll re-scrolled the window every tick and nothing could be read.
   */
  useEffect(() => {
    let stop = false
    const tick = async () => {
      try {
        const live = await getLive()
        if (!stop) setSpotlight(live.itemId)
      } catch {
        /* the guard is down; the shop keeps working */
      }
    }
    void tick()
    const id = setInterval(tick, 1500)
    return () => {
      stop = true
      clearInterval(id)
    }
  }, [])

  const shown = useMemo(
    () =>
      products
        .filter((p) => category === 'all' || p.category === category)
        .filter((p) => !query || `${p.product} ${p.seller}`.toLowerCase().includes(query)),
    [products, category, query],
  )

  const askAgent = async (want: string) => {
    if (!policyId) return
    setSending(want)
    try {
      await sendAgent(policyId, want, 'AUTONOMOUS')
    } catch {
      /* the strip at the top reports whatever happened */
    } finally {
      setSending('')
    }
  }

  return (
    <div>
      {/* Hero */}
      <section className="grid items-stretch gap-6 py-8 lg:grid-cols-[1.35fr_1fr]">
        <div
          className="relative overflow-hidden rounded-[var(--radius-lg)] p-9 md:p-12"
          style={{ background: 'linear-gradient(135deg, #12233c 0%, #24374f 55%, #33465f 100%)' }}
        >
          <div
            className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(232,69,42,0.5), transparent 65%)' }}
          />
          <span className="eyebrow" style={{ color: '#9fb0c6' }}>
            New this week
          </span>
          <h1 className="display mt-3 text-[clamp(30px,4.6vw,50px)]" style={{ color: '#fff' }}>
            Good gear,
            <br />
            fairly priced.
          </h1>
          <p className="mt-4 max-w-[30rem] text-[16px]" style={{ color: '#c7d2e0' }}>
            Storage, laptops, books and desk things. Or let our AI shopper find it for you —
            it spends inside limits you set, and it cannot go past them.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <button
              className="btn btn-brand btn-lg"
              onClick={() => void askAgent('an SSD')}
              disabled={sending !== '' || !policyId}
            >
              {sending === 'an SSD' ? 'Shopping…' : '🤖 Let the AI find me an SSD'}
            </button>
            <button
              className="btn btn-lg"
              style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}
              onClick={() => void askAgent('a gaming laptop')}
              disabled={sending !== '' || !policyId}
            >
              {sending === 'a gaming laptop' ? 'Shopping…' : 'Find me a gaming laptop'}
            </button>
          </div>

          <p className="mt-4 text-[12.5px]" style={{ color: '#93a3ba' }}>
            {policyId
              ? `Spending rule ${policyId} is active — watch the bar at the top.`
              : 'No spending rule is active yet. Set one up in MandateGuard first.'}
          </p>
        </div>

        <div className="card flex flex-col justify-center p-8">
          <span className="eyebrow">Why shop here</span>
          <ul className="mt-5 space-y-5">
            {[
              ['🛡', 'Agent-safe checkout', 'Every AI purchase is checked against your own rules before payment.'],
              ['⛓', 'Settled on Algorand', 'Paid in Test USDC. Every order has a transaction you can look up.'],
              ['↩', 'Refusals cost nothing', 'If a purchase breaks your rule, no money leaves. Ever.'],
            ].map(([icon, title, text]) => (
              <li key={title} className="flex gap-3">
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[16px]"
                  style={{ background: 'var(--sunk)' }}
                >
                  {icon}
                </span>
                <span>
                  <b className="block text-[15px]">{title}</b>
                  <span className="text-[13.5px]" style={{ color: 'var(--ink-soft)' }}>
                    {text}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Trust row */}
      <div
        className="grid gap-px overflow-hidden rounded-[var(--radius)] border sm:grid-cols-4"
        style={{ background: 'var(--line)', borderColor: 'var(--line)' }}
      >
        {[
          ['🚚', 'Free delivery', 'On orders over ₹999'],
          ['↩', '7-day returns', 'No questions asked'],
          ['🔒', 'Secure checkout', 'Keys never leave your wallet'],
          ['⛓', 'On-chain receipts', 'Every order is verifiable'],
        ].map(([icon, title, sub]) => (
          <div key={title} className="flex items-center gap-3 p-4" style={{ background: 'var(--surface)' }}>
            <span className="text-[18px]">{icon}</span>
            <span>
              <b className="block text-[13.5px]">{title}</b>
              <span className="text-[12px]" style={{ color: 'var(--ink-faint)' }}>
                {sub}
              </span>
            </span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mt-10 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => {
              const next = new URLSearchParams(params)
              if (f.id === 'all') next.delete('c')
              else next.set('c', f.id)
              setParams(next, { replace: true })
            }}
            className={`btn btn-sm ${category === f.id ? 'btn-dark' : 'btn-quiet'}`}
          >
            {f.label}
          </button>
        ))}

        <span className="ml-auto text-[13px]" style={{ color: 'var(--ink-faint)' }}>
          {shown.length} {shown.length === 1 ? 'product' : 'products'}
          {query ? ` matching “${query}”` : ''} · {rate}
        </span>
      </div>

      {/* Grid */}
      {shown.length === 0 ? (
        <p className="py-20 text-center" style={{ color: 'var(--ink-faint)' }}>
          Nothing matched. Try another search.
        </p>
      ) : (
        <section className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((p, i) => {
            const was = listPrice(p.price)
            const off = Math.round(((was - p.price) / was) * 100)

            return (
              <article
                key={p.id}
                className={`tile rise ${spotlight === p.id ? 'tile-spotlit' : ''}`}
                style={{ '--i': i } as CSSProperties}
              >
                <Link to={`/p/${p.id}`} className={`shot shot-${p.category}`}>
                  <span className="relative z-10">{GLYPH[p.category]}</span>

                  {off > 0 && (
                    <span className="pill pill-brand absolute top-3 left-3 z-10">
                      {off}% off
                    </span>
                  )}
                  {!p.inStock && (
                    <span className="pill pill-ink absolute top-3 right-3 z-10">
                      Out of stock
                    </span>
                  )}
                </Link>

                {spotlight === p.id && (
                  <div
                    className="beacon px-4 py-2 text-[12px] font-semibold"
                    style={{ background: 'var(--brand-dim)', color: 'var(--brand)' }}
                  >
                    🤖 The AI shopper is looking at this
                  </div>
                )}

                <div className="flex flex-1 flex-col p-4">
                  <Link to={`/p/${p.id}`} className="text-[15px] leading-snug font-semibold">
                    {p.product}
                  </Link>

                  <div className="mt-1 flex items-center gap-2">
                    <span className="stars">
                      {'★'.repeat(Math.round(p.rating))}
                      {'☆'.repeat(5 - Math.round(p.rating))}
                    </span>
                    <span className="text-[12px]" style={{ color: 'var(--ink-faint)' }}>
                      {p.rating.toFixed(1)}
                    </span>
                  </div>

                  <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--ink-faint)' }}>
                    {p.seller}
                  </p>

                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="display text-[21px]">{rupees(p.price)}</span>
                    {off > 0 && <span className="strike">{rupees(was)}</span>}
                  </div>

                  <p className="mono mt-0.5 text-[11.5px]" style={{ color: 'var(--ink-faint)' }}>
                    {p.priceUsdc} USDC
                  </p>

                  <button
                    className="btn btn-quiet btn-sm btn-block mt-4"
                    disabled={!p.inStock}
                    onClick={() => add(p)}
                  >
                    Add to cart
                  </button>
                </div>
              </article>
            )
          })}
        </section>
      )}
    </div>
  )
}

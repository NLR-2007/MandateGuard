import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { getLive, getProducts, getPolicies, rupees, sendAgent, type Product } from '../api'

const GLYPH: Record<string, string> = {
  storage: '💾',
  books: '📗',
  laptops: '💻',
  accessories: '🎧',
}

const CATEGORIES = [
  { id: 'all', label: 'Everything' },
  { id: 'storage', label: 'Storage' },
  { id: 'laptops', label: 'Laptops' },
  { id: 'books', label: 'Books' },
  { id: 'accessories', label: 'Accessories' },
]

export default function Home() {
  const [products, setProducts] = useState<Product[]>([])
  const [rate, setRate] = useState('')
  const [category, setCategory] = useState('all')
  const [policyId, setPolicyId] = useState('')
  const [sending, setSending] = useState('')
  /** Which product the agent is currently looking at, if any. */
  const [spotlight, setSpotlight] = useState<string | null>(null)

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
   * Only the highlight lives here. Moving the page is the pilot's job, and
   * doing it from a poll was the bug: every tick re-scrolled the window, so
   * the page would not stay still long enough to read.
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

  const shown =
    category === 'all' ? products : products.filter((p) => p.category === category)

  /** The shop's own "shop for me" button. Same engine Telegram uses. */
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
      <section className="grid items-center gap-8 py-12 md:grid-cols-[1.15fr_1fr]">
        <div>
          <span className="eyebrow">Free delivery over ₹999</span>
          <h1 className="display mt-3 text-[clamp(34px,5.5vw,58px)]">
            Good gear,
            <br />
            fairly priced.
          </h1>
          <p className="mt-4 max-w-[34rem] text-[17px]" style={{ color: 'var(--ink-soft)' }}>
            Storage, laptops, books and desk things. Or let our AI shopper find it for you —
            it spends within limits you set, and it cannot go past them.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className="btn btn-brand"
              onClick={() => void askAgent('an SSD')}
              disabled={sending !== '' || !policyId}
            >
              {sending === 'an SSD' ? 'Shopping…' : '🤖 Let the AI find me an SSD'}
            </button>
            <button
              className="btn btn-quiet"
              onClick={() => void askAgent('a gaming laptop')}
              disabled={sending !== '' || !policyId}
            >
              {sending === 'a gaming laptop' ? 'Shopping…' : 'Find me a gaming laptop'}
            </button>
          </div>

          <p className="mt-3 text-[13px]" style={{ color: 'var(--ink-faint)' }}>
            {policyId
              ? `Spending rule ${policyId} is active. Watch the bar at the top.`
              : 'No spending rule is active yet — set one up in MandateGuard first.'}
          </p>
        </div>

        <div className="card p-8">
          <span className="eyebrow">Why shop here</span>
          <ul className="mt-4 space-y-4">
            {[
              ['🛡', 'Agent-safe checkout', 'Every AI purchase is checked against your own rules before payment.'],
              ['⛓', 'Settled on Algorand', 'Paid in Test USDC. Every order has a transaction you can look up.'],
              ['↩', 'Nothing moves on a refusal', 'If a purchase breaks your rule, no money leaves. Ever.'],
            ].map(([icon, title, text]) => (
              <li key={title} className="flex gap-3">
                <span className="text-[20px]">{icon}</span>
                <span>
                  <b className="block">{title}</b>
                  <span className="text-[14px]" style={{ color: 'var(--ink-soft)' }}>
                    {text}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Categories */}
      <div className="flex flex-wrap gap-2 border-y py-4" style={{ borderColor: 'var(--line)' }}>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className="btn btn-sm"
            style={
              category === c.id
                ? { background: 'var(--deep)', color: '#fff' }
                : { background: 'var(--surface)', color: 'var(--ink-soft)', borderColor: 'var(--line)' }
            }
          >
            {c.label}
          </button>
        ))}
        <span className="ml-auto self-center text-[13px]" style={{ color: 'var(--ink-faint)' }}>
          {shown.length} items · {rate}
        </span>
      </div>

      {/* Grid */}
      <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((p, i) => (
          <Link
            key={p.id}
            to={`/p/${p.id}`}
            className={`card card-hover rise p-4 ${spotlight === p.id ? 'spotlit' : ''}`}
            style={{ '--i': i } as CSSProperties}
          >
            {spotlight === p.id && (
              <span className="pill pill-warn beacon mb-3 inline-flex">
                🤖 The AI shopper is looking at this
              </span>
            )}
            <div className={`thumb thumb-${p.category}`}>
              <span className="relative z-10">{GLYPH[p.category]}</span>
            </div>

            <div className="mt-4 flex items-start justify-between gap-3">
              <h3 className="text-[16px] leading-snug font-semibold">{p.product}</h3>
              <span className="pill pill-ink shrink-0">★ {p.rating}</span>
            </div>

            <p className="mt-1 text-[13px]" style={{ color: 'var(--ink-faint)' }}>
              {p.seller}
            </p>

            <div className="mt-3 flex items-baseline justify-between">
              <span className="display text-[22px]">{rupees(p.price)}</span>
              <span className="mono text-[12px]" style={{ color: 'var(--ink-faint)' }}>
                {p.priceUsdc} USDC
              </span>
            </div>

            {!p.inStock && <span className="pill pill-bad mt-3 inline-flex">Out of stock</span>}
          </Link>
        ))}
      </section>
    </div>
  )
}

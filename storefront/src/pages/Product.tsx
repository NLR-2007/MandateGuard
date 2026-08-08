import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getProducts, rupees, type Product as Item } from '../api'
import { useCart } from '../cart'

const GLYPH: Record<string, string> = {
  storage: '💾',
  books: '📗',
  laptops: '💻',
  accessories: '🎧',
}

function listPrice(price: number): number {
  return Math.round((price * 1.22) / 10) * 10
}

function deliveryWindow(): string {
  const from = new Date(Date.now() + 2 * 864e5)
  const to = new Date(Date.now() + 4 * 864e5)
  const fmt = (d: Date) => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
  return `${fmt(from)} – ${fmt(to)}`
}

export default function Product() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { add } = useCart()

  const [all, setAll] = useState<Item[]>([])
  const [added, setAdded] = useState(false)

  useEffect(() => {
    void getProducts().then((d) => setAll(d.products))
    setAdded(false)
  }, [id])

  const item = all.find((p) => p.id === id)

  if (!item) {
    return (
      <p className="py-24 text-center" style={{ color: 'var(--ink-faint)' }}>
        Loading…
      </p>
    )
  }

  const was = listPrice(item.price)
  const off = Math.round(((was - item.price) / was) * 100)
  const related = all.filter((p) => p.category === item.category && p.id !== item.id).slice(0, 4)

  return (
    <div className="py-8">
      {/* Breadcrumbs */}
      <nav className="flex flex-wrap items-center gap-2 text-[13px]" style={{ color: 'var(--ink-faint)' }}>
        <Link to="/">Home</Link>
        <span>/</span>
        <Link to={`/?c=${item.category}`} className="capitalize">
          {item.category}
        </Link>
        <span>/</span>
        <span style={{ color: 'var(--ink-soft)' }}>{item.product}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.05fr_1fr]">
        {/* Gallery */}
        <div>
          <div
            className={`shot shot-${item.category} rounded-[var(--radius-lg)]`}
            style={{ fontSize: 110, border: '1px solid var(--line)' }}
          >
            <span className="relative z-10">{GLYPH[item.category]}</span>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((n) => (
              <div
                key={n}
                className={`shot shot-${item.category} rounded-[var(--radius)]`}
                style={{ fontSize: 22, opacity: n === 0 ? 1 : 0.55, border: '1px solid var(--line)' }}
              >
                <span className="relative z-10">{GLYPH[item.category]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Detail */}
        <div>
          <span className="eyebrow capitalize">{item.category}</span>
          <h1 className="display mt-2 text-[clamp(26px,3.6vw,38px)]">{item.product}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="stars">
              {'★'.repeat(Math.round(item.rating))}
              {'☆'.repeat(5 - Math.round(item.rating))}
            </span>
            <span className="text-[13px]" style={{ color: 'var(--ink-soft)' }}>
              {item.rating.toFixed(1)} · sold by <b>{item.seller}</b>
            </span>
            {item.inStock ? (
              <span className="pill pill-good">In stock</span>
            ) : (
              <span className="pill pill-bad">Out of stock</span>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-baseline gap-3">
            <span className="display text-[36px]">{rupees(item.price)}</span>
            {off > 0 && (
              <>
                <span className="strike text-[16px]">{rupees(was)}</span>
                <span className="pill pill-brand">{off}% off</span>
              </>
            )}
          </div>
          <p className="mono mt-1 text-[13px]" style={{ color: 'var(--ink-faint)' }}>
            {item.priceUsdc} USDC · inclusive of all taxes
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <button
              className="btn btn-quiet btn-lg"
              disabled={!item.inStock}
              onClick={() => {
                add(item)
                setAdded(true)
              }}
            >
              Add to cart
            </button>
            <button
              className="btn btn-brand btn-lg"
              disabled={!item.inStock}
              onClick={() => {
                add(item)
                navigate('/checkout')
              }}
            >
              Buy now
            </button>
          </div>

          {added && (
            <p className="mt-3 text-[13.5px]" style={{ color: 'var(--good)' }}>
              Added to your cart. <Link to="/checkout" className="underline">Go to checkout</Link>
            </p>
          )}

          {/* Delivery + guarantees */}
          <div className="card mt-7 divide-y" style={{ borderColor: 'var(--line)' }}>
            {[
              ['🚚', 'Free delivery', `Arrives ${deliveryWindow()}`],
              ['↩', '7-day returns', 'Send it back if it is not right'],
              ['🛡', 'Agent-safe checkout', 'MandateGuard checks every AI purchase before payment'],
            ].map(([icon, title, sub]) => (
              <div key={title} className="flex items-center gap-3 p-4" style={{ borderColor: 'var(--line-soft)' }}>
                <span className="text-[17px]">{icon}</span>
                <span>
                  <b className="block text-[13.5px]">{title}</b>
                  <span className="text-[12.5px]" style={{ color: 'var(--ink-faint)' }}>
                    {sub}
                  </span>
                </span>
              </div>
            ))}
          </div>

          <details className="card mt-4 p-5">
            <summary className="cursor-pointer text-[14px] font-semibold">
              Payment &amp; seller details
            </summary>
            <p className="mt-3 text-[13px]" style={{ color: 'var(--ink-soft)' }}>
              Payment goes straight to the seller on Algorand TestNet. NovaMart never holds
              your funds, and your keys never leave your wallet.
            </p>
            <p className="mono mt-2 text-[11.5px] break-all" style={{ color: 'var(--ink-faint)' }}>
              {item.receiverWallet}
            </p>
          </details>
        </div>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="display text-[24px]">More in {item.category}</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => (
              <Link key={p.id} to={`/p/${p.id}`} className="tile">
                <div className={`shot shot-${p.category}`} style={{ fontSize: 38 }}>
                  <span className="relative z-10">{GLYPH[p.category]}</span>
                </div>
                <div className="p-4">
                  <span className="block text-[14px] leading-snug font-semibold">{p.product}</span>
                  <span className="mt-1 block text-[12px]" style={{ color: 'var(--ink-faint)' }}>
                    {p.seller}
                  </span>
                  <span className="display mt-2 block text-[18px]">{rupees(p.price)}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

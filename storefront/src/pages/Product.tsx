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

export default function Product() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { add } = useCart()
  const [item, setItem] = useState<Item | null>(null)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    void getProducts().then((d) => setItem(d.products.find((p) => p.id === id) ?? null))
  }, [id])

  if (!item) {
    return <p className="py-16 text-center" style={{ color: 'var(--ink-faint)' }}>Loading…</p>
  }

  return (
    <div className="py-10">
      <Link to="/" className="text-[14px]" style={{ color: 'var(--ink-soft)' }}>
        ← Back to shop
      </Link>

      <div className="mt-6 grid gap-10 md:grid-cols-2">
        <div className={`thumb thumb-${item.category}`} style={{ fontSize: 96 }}>
          <span className="relative z-10">{GLYPH[item.category]}</span>
        </div>

        <div>
          <span className="eyebrow">{item.category}</span>
          <h1 className="display mt-2 text-[clamp(28px,4vw,40px)]">{item.product}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="pill pill-ink">★ {item.rating}</span>
            <span className="pill pill-ink">Sold by {item.seller}</span>
            {item.inStock ? (
              <span className="pill pill-good">In stock</span>
            ) : (
              <span className="pill pill-bad">Out of stock</span>
            )}
          </div>

          <div className="mt-6 flex items-baseline gap-3">
            <span className="display text-[38px]">{rupees(item.price)}</span>
            <span className="mono text-[14px]" style={{ color: 'var(--ink-faint)' }}>
              {item.priceUsdc} USDC
            </span>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <button
              className="btn btn-brand"
              disabled={!item.inStock}
              onClick={() => {
                add(item)
                setAdded(true)
              }}
            >
              Add to cart
            </button>
            <button
              className="btn btn-dark"
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
            <p className="mt-3 text-[14px]" style={{ color: 'var(--good)' }}>
              Added to your cart.
            </p>
          )}

          <div className="card mt-8 p-5">
            <span className="eyebrow">Seller payment address</span>
            <p className="mono mt-1 text-[12px] break-all" style={{ color: 'var(--ink-soft)' }}>
              {item.receiverWallet}
            </p>
            <p className="mt-3 text-[13px]" style={{ color: 'var(--ink-faint)' }}>
              Payment goes straight to the seller on Algorand TestNet. NovaMart never holds
              your funds.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

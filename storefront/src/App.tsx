import { NetworkId, WalletId, WalletManager, WalletProvider } from '@txnlab/use-wallet-react'
import { BrowserRouter, Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import AgentStrip from './components/AgentStrip'
import AgentPilot from './components/AgentPilot'
import WalletButton from './components/WalletButton'
import Home from './pages/Home'
import Product from './pages/Product'
import Checkout from './pages/Checkout'
import Orders from './pages/Orders'
import Confirmation from './pages/Confirmation'
import { CartProvider, useCart } from './cart'

/**
 * Built ONCE at module level, never inside a component. Re-creating it on
 * every render drops the live wallet connection and signing then fails.
 */
const walletManager = new WalletManager({
  wallets: [WalletId.PERA, WalletId.DEFLY, WalletId.LUTE],
  defaultNetwork: NetworkId.TESTNET,
})

const CATEGORIES = [
  { id: 'storage', label: 'Storage' },
  { id: 'laptops', label: 'Laptops' },
  { id: 'books', label: 'Books' },
  { id: 'accessories', label: 'Accessories' },
]

/**
 * NovaMart — an ordinary electronics and books shop.
 *
 * A separate application from MandateGuard on purpose. It holds no rules, no
 * wallet and no policy logic; it sells things, and before money moves it asks
 * the guard one question. See src/api.ts — that file is the whole integration.
 */
export default function App() {
  return (
    <WalletProvider manager={walletManager}>
      <CartProvider>
        <BrowserRouter>
          <UtilityBar />
          <Header />
          <AgentStrip />
          {/* Opens whatever the agent picks, like a shopper clicking it. */}
          <AgentPilot />

          <main className="wrap pb-24">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/p/:id" element={<Product />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/order/:orderId" element={<Confirmation />} />
            </Routes>
          </main>

          <Footer />
        </BrowserRouter>
      </CartProvider>
    </WalletProvider>
  )
}

function UtilityBar() {
  return (
    <div style={{ background: 'var(--deep)', color: '#dfe5ee' }}>
      <div className="wrap flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-2 text-[12.5px]">
        <span>Free delivery on orders over ₹999 · 7-day returns</span>
        <span className="hidden sm:block">
          Settled in Test USDC on Algorand TestNet
        </span>
      </div>
    </div>
  )
}

function Header() {
  const { items } = useCart()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const search = (e: React.FormEvent) => {
    e.preventDefault()
    navigate(query.trim() ? `/?q=${encodeURIComponent(query.trim())}` : '/')
  }

  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur"
      style={{ background: 'rgba(250,248,245,0.92)', borderColor: 'var(--line)' }}
    >
      <div className="wrap flex flex-wrap items-center gap-x-6 gap-y-3 py-4">
        <Link to="/" className="display text-[26px] leading-none">
          Nova<span style={{ color: 'var(--brand)' }}>Mart</span>
        </Link>

        <form onSubmit={search} className="order-3 w-full md:order-2 md:w-auto md:flex-1">
          <div className="relative">
            <input
              className="field pl-9"
              placeholder="Search storage, laptops, books…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <span
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[14px]"
              style={{ color: 'var(--ink-faint)' }}
            >
              ⌕
            </span>
          </div>
        </form>

        <div className="order-2 ml-auto flex items-center gap-2 md:order-3">
          <span className="pill pill-good hidden lg:inline-flex">
            🛡 Protected by MandateGuard
          </span>

          <WalletButton />

          <Link to="/orders" className="btn btn-ghost btn-sm hidden sm:inline-flex">
            Orders
          </Link>

          <Link to="/checkout" className="btn btn-dark btn-sm">
            Cart
            {items.length > 0 && (
              <span
                className="grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px]"
                style={{ background: 'var(--brand)' }}
              >
                {items.length}
              </span>
            )}
          </Link>
        </div>
      </div>

      <nav className="wrap rail flex items-center gap-1 pb-2">
        <NavLink
          to="/"
          end
          className="btn btn-ghost btn-sm"
          style={({ isActive }) => (isActive ? { color: 'var(--ink)', background: 'var(--sunk)' } : {})}
        >
          All
        </NavLink>
        {CATEGORIES.map((c) => (
          <Link key={c.id} to={`/?c=${c.id}`} className="btn btn-ghost btn-sm">
            {c.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}

function Footer() {
  return (
    <footer className="mt-10 border-t" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
      <div className="wrap grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <span className="display text-[22px]">
            Nova<span style={{ color: 'var(--brand)' }}>Mart</span>
          </span>
          <p className="mt-2 text-[13px]" style={{ color: 'var(--ink-soft)' }}>
            Storage, laptops, books and desk things — with a checkout that an AI agent
            cannot overspend on.
          </p>
        </div>

        {[
          { title: 'Shop', links: ['Storage', 'Laptops', 'Books', 'Accessories'] },
          { title: 'Help', links: ['Delivery', 'Returns', 'Track an order', 'Contact us'] },
          { title: 'Company', links: ['About', 'Careers', 'Privacy', 'Terms'] },
        ].map((col) => (
          <div key={col.title}>
            <span className="eyebrow">{col.title}</span>
            <ul className="mt-3 space-y-1.5">
              {col.links.map((l) => (
                <li key={l} className="text-[13.5px]" style={{ color: 'var(--ink-soft)' }}>
                  {l}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="divider" />

      <div className="wrap flex flex-wrap items-center justify-between gap-3 py-6">
        <span className="text-[12.5px]" style={{ color: 'var(--ink-faint)' }}>
          NovaMart is a demonstration shop. Prices settle in Test USDC on Algorand TestNet —
          no real money moves.
        </span>
        <span className="pill pill-good">🛡 Checkout protected by MandateGuard</span>
      </div>
    </footer>
  )
}

import { NetworkId, WalletId, WalletManager, WalletProvider } from '@txnlab/use-wallet-react'
import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom'
import AgentStrip from './components/AgentStrip'
import Home from './pages/Home'
import Product from './pages/Product'
import Checkout from './pages/Checkout'
import Orders from './pages/Orders'
import Confirmation from './pages/Confirmation'
import WalletButton from './components/WalletButton'
import AgentPilot from './components/AgentPilot'
import { CartProvider, useCart } from './cart'

/**
 * Built ONCE at module level, never inside a component. Re-creating it on
 * every render drops the live wallet connection and signing then fails.
 */
const walletManager = new WalletManager({
  wallets: [WalletId.PERA, WalletId.DEFLY, WalletId.LUTE],
  defaultNetwork: NetworkId.TESTNET,
})

/**
 * NovaMart — an ordinary electronics and books shop.
 *
 * It is a separate application from MandateGuard on purpose. It holds no
 * rules, no wallet and no policy logic; it sells things, and before money
 * moves it asks the guard one question. See src/api.ts - that file is the
 * entire integration.
 */
export default function App() {
  return (
    <WalletProvider manager={walletManager}>
    <CartProvider>
      <BrowserRouter>
        <Header />
        <AgentStrip />
        {/* Opens whatever the agent picks, like a shopper clicking it. */}
        <AgentPilot />

        <main className="mx-auto max-w-[1180px] px-6 pb-24">
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

function Header() {
  const { items } = useCart()

  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur"
      style={{ background: 'rgba(251,250,247,0.88)', borderColor: 'var(--line)' }}
    >
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-8 gap-y-3 px-6 py-4">
        <Link to="/" className="display text-[24px]" style={{ color: 'var(--ink)' }}>
          Nova<span style={{ color: 'var(--brand)' }}>Mart</span>
        </Link>

        <nav className="flex items-center gap-6">
          {[
            { to: '/', label: 'Shop' },
            { to: '/orders', label: 'Orders' },
          ].map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className="text-[14px] font-medium"
              style={({ isActive }) => ({ color: isActive ? 'var(--ink)' : 'var(--ink-soft)' })}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span
            className="pill pill-good hidden sm:inline-flex"
            title="Purchases on this shop are checked by MandateGuard before payment"
          >
            🛡 Protected by MandateGuard
          </span>

          <WalletButton />

          <Link to="/checkout" className="btn btn-dark btn-sm">
            Cart{items.length > 0 ? ` · ${items.length}` : ''}
          </Link>
        </div>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="border-t" style={{ borderColor: 'var(--line)' }}>
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-6 py-8">
        <span className="text-[13px]" style={{ color: 'var(--ink-faint)' }}>
          NovaMart — a demonstration shop. Prices settle in Test USDC on Algorand TestNet.
        </span>
        <span className="text-[13px]" style={{ color: 'var(--ink-faint)' }}>
          Checkout protected by <b style={{ color: 'var(--ink-soft)' }}>MandateGuard</b>
        </span>
      </div>
    </footer>
  )
}

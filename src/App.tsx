import { NetworkId, WalletId, WalletManager, WalletProvider } from '@txnlab/use-wallet-react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Navbar from './components/Navbar'
import { AppModeProvider } from './services/appMode'
import Architecture from './pages/Architecture'
import Dashboard from './pages/Dashboard'
import TransactionDetail from './pages/TransactionDetail'
import AIOrder from './pages/AIOrder'
import CreatePolicy from './pages/CreatePolicy'
import History from './pages/History'
import Home from './pages/Home'
import Landing from './pages/Landing'
import Shop from './pages/Shop'
import RedTeam from './pages/RedTeam'
import UnsafeDemo from './pages/UnsafeDemo'
import Verification from './pages/Verification'
/**
 * Built ONCE at module level, never inside the component.
 * Re-creating it on every render would drop the live wallet connection
 * and signing would fail with "wallet was not initialized correctly".
 */
const walletManager = new WalletManager({
  wallets: [WalletId.PERA, WalletId.DEFLY, WalletId.LUTE],
  defaultNetwork: NetworkId.TESTNET,
})

/**
 * Everything except the landing page: masthead, ruled navigation, footer.
 * The landing page deliberately sits outside this - it is full-bleed and dark,
 * and wrapping it in the paper chrome would fight it.
 */
function AppShell() {
  return (
    <div className="min-h-screen">
        <Navbar />

        <main className="mx-auto max-w-[1180px] px-6 pb-24">
          <Routes>
            <Route path="/home" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/attack" element={<RedTeam />} />
            <Route path="/unsafe-demo" element={<UnsafeDemo />} />
            <Route path="/architecture" element={<Architecture />} />
            <Route path="/history/:verificationId" element={<TransactionDetail />} />
            <Route path="/policy" element={<CreatePolicy />} />
            <Route path="/order" element={<AIOrder />} />
            <Route path="/verify" element={<Verification />} />
            <Route path="/history" element={<History />} />
          </Routes>
        </main>

        <footer className="mx-auto max-w-[1180px] px-6 pb-14">
          <div className="rule-double" />
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
            <span className="footnote">
              MandateGuard · Bureau of Machine Mandates
            </span>
            <span className="footnote">
              NVIDIA NIM · x402 · Algorand TestNet · test funds only
            </span>
          </div>
        </footer>
      </div>
  )
}

export default function App() {
  return (
    <AppModeProvider>
    <WalletProvider manager={walletManager}>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        {/* Every other path keeps the chrome. */}
        <Route path="*" element={<AppShell />} />
      </Routes>
    </BrowserRouter>
    </WalletProvider>
    </AppModeProvider>
  )
}

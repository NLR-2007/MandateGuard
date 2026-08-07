import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Navbar from './components/Navbar'
import AIOrder from './pages/AIOrder'
import CreatePolicy from './pages/CreatePolicy'
import History from './pages/History'
import Home from './pages/Home'
import UnsafeDemo from './pages/UnsafeDemo'
import Verification from './pages/Verification'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen">
        <Navbar />

        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/unsafe-demo" element={<UnsafeDemo />} />
            <Route path="/policy" element={<CreatePolicy />} />
            <Route path="/order" element={<AIOrder />} />
            <Route path="/verify" element={<Verification />} />
            <Route path="/history" element={<History />} />
          </Routes>
        </main>

        <footer className="mt-16 border-t border-slate-800 py-8 text-center text-sm text-slate-500">
          MandateGuard — Phase 2 UI demo. Sample data only, no blockchain or AI connected.
        </footer>
      </div>
    </BrowserRouter>
  )
}

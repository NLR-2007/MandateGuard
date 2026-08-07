import { Link } from 'react-router-dom'
import FeatureCard from '../components/FeatureCard'
import Hero from '../components/Hero'

const features = [
  {
    icon: '💳',
    title: 'Spending Control',
    text: 'Set limits before AI spends.',
  },
  {
    icon: '🔍',
    title: 'Intent Verification',
    text: 'Check what the AI is actually buying.',
  },
  {
    icon: '📜',
    title: 'Audit History',
    text: 'See every approved and blocked request.',
  },
]

export default function Home() {
  return (
    <>
      <Hero />

      {/* Feature cards */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </section>

      {/* See the Problem */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="rounded-2xl border border-yellow-500/40 bg-yellow-500/5 p-10 text-center">
          <span className="text-4xl">⚠️</span>
          <h2 className="mt-4 text-3xl font-bold text-white">See the Problem</h2>
          <p className="mx-auto mt-3 max-w-2xl text-slate-300">
            An AI can stay within the spending limit and still make the wrong purchase.
          </p>
          <Link
            to="/unsafe-demo"
            className="mt-6 inline-block rounded-lg bg-yellow-500 px-6 py-3 font-semibold text-slate-950 transition-colors duration-200 hover:bg-yellow-400"
          >
            Run Unsafe Demo
          </Link>
        </div>
      </section>

      {/* Why MandateGuard */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-center text-3xl font-bold text-white">Why MandateGuard?</h2>
        <p className="mt-2 text-center text-slate-400">
          The same request, with and without a guard in the middle.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {/* Without */}
          <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-6">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-lg font-semibold text-red-400">Without MandateGuard</h3>
            </div>

            <div className="mt-6 space-y-4 text-sm">
              <div>
                <p className="text-slate-400">Human</p>
                <p className="mt-1 rounded-lg bg-slate-900 px-4 py-3 text-white">
                  “Buy 1 SSD below ₹5000.”
                </p>
              </div>
              <p className="text-center text-slate-600">↓</p>
              <div>
                <p className="text-slate-400">AI</p>
                <p className="mt-1 rounded-lg bg-slate-900 px-4 py-3 text-white">
                  “2 SSDs + warranty”
                </p>
              </div>
              <p className="text-center text-slate-600">↓</p>
              <div>
                <p className="text-slate-400">Result</p>
                <p className="mt-1 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 font-semibold text-red-400">
                  Payment may continue
                </p>
              </div>
            </div>
          </div>

          {/* With */}
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-6">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🛡️</span>
              <h3 className="text-lg font-semibold text-emerald-400">With MandateGuard</h3>
            </div>

            <div className="mt-6 space-y-4 text-sm">
              <div>
                <p className="text-slate-400">Human</p>
                <p className="mt-1 rounded-lg bg-slate-900 px-4 py-3 text-white">
                  “Buy 1 SSD below ₹5000.”
                </p>
              </div>
              <p className="text-center text-slate-600">↓</p>
              <div>
                <p className="text-slate-400">AI</p>
                <p className="mt-1 rounded-lg bg-slate-900 px-4 py-3 text-white">
                  “2 SSDs + warranty”
                </p>
              </div>
              <p className="text-center text-slate-600">↓</p>
              <div>
                <p className="text-slate-400">MandateGuard</p>
                <p className="mt-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 font-semibold text-emerald-400">
                  BLOCKED
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

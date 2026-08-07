import { Link } from 'react-router-dom'

const flow = ['Human', 'AI Agent', 'MandateGuard', 'Approved / Blocked', 'Payment']

export default function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-16 pb-12 text-center">
      <span className="inline-block rounded-full border border-slate-700 bg-slate-900 px-4 py-1 text-xs tracking-wide text-slate-300">
        x402 · Algorand · Hackathon Project
      </span>

      <h1 className="mt-6 text-5xl font-bold text-white sm:text-6xl">
        Mandate<span className="text-cyan-400">Guard</span>
      </h1>

      <p className="mt-3 text-xl text-cyan-300">AI Agent Spend Policy Engine</p>

      <p className="mx-auto mt-6 max-w-2xl text-2xl font-medium text-white">
        “Let AI spend, but keep human intent in control.”
      </p>

      <p className="mx-auto mt-4 max-w-2xl text-slate-400">
        MandateGuard checks whether an AI agent’s purchase matches the rules approved by the human.
      </p>

      {/* Buttons */}
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Link
          to="/policy"
          className="rounded-lg bg-cyan-500 px-6 py-3 font-semibold text-slate-950 transition-colors duration-200 hover:bg-cyan-400"
        >
          Create Spending Policy
        </Link>
        <Link
          to="/order"
          className="rounded-lg border border-slate-600 px-6 py-3 font-semibold text-white transition-colors duration-200 hover:border-cyan-400 hover:text-cyan-300"
        >
          View Demo
        </Link>
      </div>

      {/* Flow */}
      <div className="mt-14 flex flex-col items-center gap-2">
        {flow.map((step, i) => (
          <div key={step} className="flex flex-col items-center gap-2">
            <div
              className={[
                'rounded-lg border px-6 py-2 text-sm font-medium transition-colors duration-200',
                step === 'MandateGuard'
                  ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-300'
                  : 'border-slate-700 bg-slate-900 text-slate-200',
              ].join(' ')}
            >
              {step}
            </div>
            {i < flow.length - 1 && <span className="text-slate-600">↓</span>}
          </div>
        ))}
      </div>
    </section>
  )
}

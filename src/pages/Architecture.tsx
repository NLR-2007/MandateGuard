import { StatusLights, useSystemStatus } from '../components/StatusBar'

const layers = [
  {
    n: 1,
    name: 'AI Layer',
    tech: 'NVIDIA NIM',
    purpose: 'Understands human language.',
    detail:
      'Reads a plain English instruction and fills in a policy form. It never decides whether anything is approved, and it never invents a value the human did not state.',
    tone: 'border-violet-500/40 bg-violet-500/5 text-violet-300',
  },
  {
    n: 2,
    name: 'Security Layer',
    tech: 'MandateGuard',
    purpose: 'Checks human policy against AI order.',
    detail:
      'Ten deterministic rules in plain TypeScript. Same input, same answer, every time. This is the only layer that says APPROVED or BLOCKED.',
    tone: 'border-cyan-500/40 bg-cyan-500/5 text-cyan-300',
  },
  {
    n: 3,
    name: 'Payment Layer',
    tech: 'x402',
    purpose: 'Handles paid API access.',
    detail:
      'Answers HTTP 402 until the small verification fee is paid. It checks payment only — it never judges the order.',
    tone: 'border-emerald-500/40 bg-emerald-500/5 text-emerald-400',
  },
  {
    n: 4,
    name: 'Blockchain Layer',
    tech: 'Algorand TestNet',
    purpose: 'Records TestNet payment and mandate proof.',
    detail:
      'Test USDC moves on TestNet and the payment is recorded publicly. Mandate fingerprints are SHA-256 hashes; in this build they are stored server-side, not in a deployed contract.',
    tone: 'border-blue-500/40 bg-blue-500/5 text-blue-300',
  },
]

export default function Architecture() {
  const { status, error } = useSystemStatus()

  return (
    <section className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Architecture</h1>
          <p className="mt-2 text-slate-400">Four layers, one job each.</p>
        </div>
        <StatusLights status={status} error={error} />
      </div>

      <div className="mt-10 space-y-4">
        {layers.map((layer) => (
          <div key={layer.n} className={`rounded-xl border p-6 ${layer.tone}`}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/70 text-sm font-bold">
                {layer.n}
              </span>
              <h2 className="text-lg font-bold">{layer.name}</h2>
              <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300">
                {layer.tech}
              </span>
            </div>
            <p className="mt-3 font-semibold text-white">{layer.purpose}</p>
            <p className="mt-2 text-sm text-slate-400">{layer.detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/40 p-8">
        <h2 className="text-center text-xl font-bold text-white">How a request flows</h2>
        <div className="mt-6 flex flex-col items-center gap-2 text-sm">
          {[
            'Human writes an instruction',
            'NVIDIA NIM drafts a policy',
            'Human approves the policy',
            'AI agent prepares an order',
            'x402 asks for the verification fee',
            'Wallet signs Test USDC',
            'Algorand TestNet records it',
            'MandateGuard checks the order',
            'APPROVED or BLOCKED',
          ].map((step, i, all) => (
            <div key={step} className="flex flex-col items-center gap-2">
              <span className="rounded-lg border border-slate-700 bg-slate-900 px-5 py-2 text-slate-200">
                {step}
              </span>
              {i < all.length - 1 && <span className="text-slate-600">↓</span>}
            </div>
          ))}
        </div>
      </div>

      <p className="mt-8 text-center text-lg font-bold text-yellow-400">
        x402 verifies payment. MandateGuard verifies intent. Algorand provides proof.
      </p>
    </section>
  )
}

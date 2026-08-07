import { StatusLights, useSystemStatus } from '../components/StatusBar'
const layers = [
  {
    n: 1,
    name: 'AI Layer',
    tech: 'NVIDIA NIM',
    purpose: 'Understands human language.',
    detail:
      'Reads a plain English instruction and fills in a policy form. It never decides whether anything is approved, and it never invents a value the human did not state.',
    tone: '',
  },
  {
    n: 2,
    name: 'Security Layer',
    tech: 'MandateGuard',
    purpose: 'Checks human policy against AI order.',
    detail:
      'Ten deterministic rules in plain TypeScript. Same input, same answer, every time. This is the only layer that says APPROVED or BLOCKED.',
    tone: '',
  },
  {
    n: 3,
    name: 'Payment Layer',
    tech: 'x402',
    purpose: 'Handles paid API access.',
    detail:
      'Answers HTTP 402 until the small verification fee is paid. It checks payment only — it never judges the order.',
    tone: '',
  },
  {
    n: 4,
    name: 'Blockchain Layer',
    tech: 'Algorand TestNet',
    purpose: 'Records TestNet payment and mandate proof.',
    detail:
      'Test USDC moves on TestNet and the payment is recorded publicly. Mandate fingerprints are SHA-256 hashes; in this build they are stored server-side, not in a deployed contract.',
    tone: '',
  },
]

export default function Architecture() {
  const { status, error } = useSystemStatus()

  return (
    <section className="pt-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="label">How it works</span>
          <h1 className="display mt-1 text-[clamp(34px,5vw,52px)]">How it works</h1>
        </div>
        <StatusLights status={status} error={error} />
      </div>

      <div className="rule-double mt-6" />
      <div className="mt-10">
        {layers.map((layer) => (
          <div
            key={layer.n}
            className="grid gap-6 border-b py-8 md:grid-cols-[80px_1fr_1.2fr]"
            style={{ borderColor: 'var(--rule)'
}}
          >
            <span className="display text-[44px]" style={{ color: 'var(--oxblood)'
}}>
              {String(layer.n).padStart(2, '0')}
            </span>
            <div>
              <h2 className="display text-[24px]">{layer.name}</h2>
              <p className="label mt-1">{layer.tech}</p>
            </div>
            <div>
              <p className="text-[16px]">{layer.purpose}</p>
              <p className="mt-2 text-[14px]" style={{ color: 'var(--ink-soft)'
}}>
                {layer.detail}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="sheet mt-12 p-8">
        <h2 className="display text-center text-[26px]">The full flow</h2>
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
              <span className="mono border px-5 py-1.5 text-[12px]" style={{ borderColor: 'var(--rule)', background: 'var(--paper)'
}}>
                {step}
              </span>
              {i < all.length - 1 && <span style={{ color: 'var(--ink-faint)'
}}>↓</span>}
            </div>
          ))}
        </div>
      </div>

      <p className="display mt-12 text-center text-[clamp(20px,3vw,30px)]">
        x402 verifies payment. MandateGuard verifies intent. Algorand provides proof.
      </p>
    </section>
  )
}

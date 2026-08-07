import { Link } from 'react-router-dom'
const chain = [
  { n: '01', name: 'Human', role: 'writes the rule'
},
  { n: '02', name: 'NVIDIA NIM', role: 'reads the sentence'
},
  { n: '03', name: 'AI Agent', role: 'prepares an order'
},
  { n: '04', name: 'MandateGuard', role: 'compares intent', mark: true },
  { n: '05', name: 'x402', role: 'collects the fee'
},
  { n: '06', name: 'Algorand', role: 'records the proof'
},
]

export default function Hero() {
  return (
    <section className="pt-10 pb-4">
      {/* Docket line */}
      <div className="reveal d1 flex flex-wrap items-center gap-x-5 gap-y-1">
        <span className="label">Built with</span>
        <span className="mono text-[11px] tracking-[0.12em] uppercase">
          NVIDIA NIM
        </span>
        <span className="label">·</span>
        <span className="mono text-[11px] tracking-[0.12em] uppercase">
          Algorand TestNet
        </span>
        <span className="label">·</span>
        <span className="mono text-[11px] tracking-[0.12em] uppercase">x402</span>
      </div>

      {/* Headline */}
      <div className="reveal d2 mt-6 grid gap-8 lg:grid-cols-[1.35fr_1fr]">
        <div>
          <h1 className="display text-[clamp(46px,7.5vw,86px)]">
            Let the machine spend.
            <br />
            <span style={{ color: 'var(--oxblood)'
}}>Keep the intent</span> human.
          </h1>

          <p
            className="mt-6 max-w-xl text-[17px] leading-relaxed"
            style={{ color: 'var(--ink-soft)'
}}
          >
            An agent can stay inside your limit and still buy the wrong thing.
            MandateGuard compares the order an AI actually placed against the rule a
            person approved — and answers in plain sentences.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/dashboard" className="btn btn-solid">
              Start Demo
            </Link>
            <Link to="/unsafe-demo" className="btn">
              See the Problem
            </Link>
            <Link to="/history" className="btn">
              History
            </Link>
          </div>
        </div>

        {/* Specimen: the record card */}
        <aside className="reveal d3 sheet self-start p-6">
          <div className="flex items-baseline justify-between">
            <span className="label">Example</span>
            <span className="mono text-[10px]" style={{ color: 'var(--ink-faint)'
}}>
              VER-1002
            </span>
          </div>

          <dl className="mt-4 space-y-2 text-[13px]">
            {[
              ['Approved', '1 × 1TB SSD, ≤ ₹5,000'],
              ['Seller', 'SecureStore'],
              ['Ordered', '2 × 1TB SSD, ₹4,900'],
              ['From', 'OtherStore'],
            ].map(([k, v], i) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="label label-ink">{k}</dt>
                <dd
                  className="mono text-right text-[12px]"
                  style={{ color: i > 1 ? 'var(--oxblood)' : 'var(--ink)'
}}
                >
                  {v}
                </dd>
              </div>
            ))}
          </dl>

          <div className="rule-line my-5" />

          <p className="text-[13px]" style={{ color: 'var(--ink-soft)'
}}>
            Under budget. Wrong purchase.
          </p>

          <div className="mt-4 flex justify-center">
            <span className="stamp stamp-blocked stamp-sm">
              Blocked
              <sub>4 violations</sub>
            </span>
          </div>
        </aside>
      </div>

      {/* The chain of custody */}
      <div className="reveal d4 mt-16">
        <div className="rule-double" />
        <ol className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {chain.map((step) => (
            <li
              key={step.n}
              className="border-b border-r px-4 py-5 last:border-r-0"
              style={{
                borderColor: 'var(--rule)',
                background: step.mark ? 'var(--wash-red)' : 'transparent',
              }}
            >
              <span
                className="mono text-[10px] tracking-[0.16em]"
                style={{ color: step.mark ? 'var(--oxblood)' : 'var(--ink-faint)'
}}
              >
                {step.n}
              </span>
              <p className="display mt-2 text-[19px] leading-tight">{step.name}</p>
              <p className="label mt-1">{step.role}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

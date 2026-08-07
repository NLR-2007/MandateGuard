import { Link } from 'react-router-dom'
import Hero from '../components/Hero'
import Sheet from '../components/Sheet'
const capabilities = [
  {
    n: 'I',
    title: 'Spending control',
    text: 'Limits are set before the agent is allowed to act, not argued about afterwards.',
  },
  {
    n: 'II',
    title: 'Intent verification',
    text: 'Quantity, seller, add-ons and the payment destination are all compared, not just the total.',
  },
  {
    n: 'III',
    title: 'Audit history',
    text: 'Every approval and refusal is filed with its reasons, its payment proof and its timestamp.',
  },
]

export default function Home() {
  return (
    <>
      <Hero />

      {/* The case */}
      <div className="mt-20 space-y-20">
        <Sheet
          mark="01"
          title="Why a spending limit is not enough"
          note="The same AI order, checked two different ways."
        >
          <div className="grid gap-0 md:grid-cols-2">
            {/* Without */}
            <div
              className="border p-7"
              style={{ borderColor: 'var(--rule)', background: 'var(--wash-red)'
}}
            >
              <span className="label" style={{ color: 'var(--oxblood)'
}}>
                Without MandateGuard
              </span>

              <div className="mt-5 space-y-4 text-[14px]">
                <Quote who="Human" text="Buy 1 SSD below ₹5,000." />
                <Quote who="Agent" text="2 SSDs, other shop, warranty added." />
                <div>
                  <p className="label label-ink">The only check</p>
                  <p className="mono mt-1 text-[15px]">₹4,900 &lt; ₹5,000</p>
                </div>
              </div>

              <p
                className="mono mt-6 border-t pt-4 text-[13px] tracking-[0.1em] uppercase"
                style={{ borderColor: 'var(--rule)', color: 'var(--oxblood)'
}}
              >
                Payment would proceed
              </p>
            </div>

            {/* With */}
            <div
              className="border border-l-0 p-7"
              style={{ borderColor: 'var(--rule)', background: 'var(--wash-green)'
}}
            >
              <span className="label" style={{ color: 'var(--forest)'
}}>
                With MandateGuard
              </span>

              <div className="mt-5 space-y-4 text-[14px]">
                <Quote who="Human" text="Buy 1 SSD below ₹5,000." />
                <Quote who="Agent" text="2 SSDs, other shop, warranty added." />
                <div>
                  <p className="label label-ink">Every check</p>
                  <ul className="mono mt-1 space-y-0.5 text-[12px]">
                    <li>Price ……… within limit</li>
                    <li style={{ color: 'var(--oxblood)'
}}>Quantity …… changed</li>
                    <li style={{ color: 'var(--oxblood)'
}}>Seller ……… not approved</li>
                    <li style={{ color: 'var(--oxblood)'
}}>Warranty …… not permitted</li>
                  </ul>
                </div>
              </div>

              <div className="mt-6 flex justify-start border-t pt-4" style={{ borderColor: 'var(--rule)'
}}>
                <span className="stamp stamp-blocked stamp-sm">Blocked</span>
              </div>
            </div>
          </div>

          <p className="display mt-10 text-center text-[clamp(24px,4vw,40px)]">
            Amount approved <span style={{ color: 'var(--oxblood)'
}}>≠</span> intent approved
          </p>
        </Sheet>

        {/* What it does */}
        <Sheet mark="02" title="What MandateGuard does">
          <div className="grid gap-px md:grid-cols-3" style={{ background: 'var(--rule)'
}}>
            {capabilities.map((c) => (
              <article key={c.n} className="p-7" style={{ background: 'var(--paper-card)'
}}>
                <span className="display text-[34px]" style={{ color: 'var(--oxblood)'
}}>
                  {c.n}
                </span>
                <h3 className="display mt-3 text-[21px]">{c.title}</h3>
                <p className="mt-2 text-[14px]" style={{ color: 'var(--ink-soft)'
}}>
                  {c.text}
                </p>
              </article>
            ))}
          </div>
        </Sheet>

        {/* Closing */}
        <Sheet mark="03" title="Three jobs, three tools">
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              ['x402', 'verifies payment'],
              ['MandateGuard', 'verifies intent'],
              ['Algorand', 'provides proof'],
            ].map(([who, does]) => (
              <div key={who} className="border-t-2 pt-4" style={{ borderColor: 'var(--ink)'
}}>
                <p className="display text-[24px]">{who}</p>
                <p className="label mt-1">{does}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/dashboard" className="btn btn-solid">
              Start Demo
            </Link>
            <Link to="/architecture" className="btn">
              How it works
            </Link>
          </div>
        </Sheet>
      </div>
    </>
  )
}

function Quote({ who, text }: { who: string; text: string }) {
  return (
    <div>
      <p className="label label-ink">{who}</p>
      <p
        className="mt-1 border-l-2 pl-3 italic"
        style={{ borderColor: 'var(--rule)', fontFamily: "'Instrument Serif', serif", fontSize: '17px'
}}
      >
        “{text}”
      </p>
    </div>
  )
}

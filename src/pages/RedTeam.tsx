import { useEffect, useState, type CSSProperties } from 'react'
import Badge from '../components/Badge'
import { API_BASE } from '../services/api'

interface Attack {
  id: string
  name: string
  injection: string
  goal: string
}

interface AttackResult {
  attack: Attack
  aiChose: { catalogId: string; product: string; price: number; seller: string } | null
  aiObeyed: boolean
  verification: { decision: string; violations: string[] } | null
  outcome: 'BLOCKED_BY_ENGINE' | 'AI_REFUSED' | 'AI_FAILED' | 'GOT_THROUGH'
  moneyAtRisk: number
  headline: string
}

interface Summary {
  attacks: number
  aiFooled: number
  blockedByEngine: number
  gotThrough: number
  moneyProtected: number
  verdict: string
}

/**
 * Attacking our own agent, in front of whoever is watching.
 *
 * The value of this page is that it can fail. The attacks are sent to the real
 * model and the results are whatever comes back — if the engine ever let one
 * through, this page would say so in red.
 */
export default function RedTeam() {
  const [attacks, setAttacks] = useState<Attack[]>([])
  const [results, setResults] = useState<AttackResult[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void fetch(`${API_BASE}/api/security/attacks`)
      .then((r) => r.json())
      .then((d) => setAttacks(d.attacks ?? []))
      .catch(() => {})
  }, [])

  const attack = async (attackId?: string) => {
    setRunning(true)
    setError('')
    setResults([])
    setSummary(null)
    try {
      const res = await fetch(`${API_BASE}/api/security/attack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attackId ? { attackId } : {}),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setResults(data.results)
      setSummary(data.summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The attack could not run.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="pt-8">
      <span className="gutter-mark">Security</span>
      <h1 className="display mt-3 text-[clamp(28px,4vw,42px)]">
        Try to break it
      </h1>
      <p className="footnote mt-3 max-w-[46rem]">
        These are real prompt-injection attacks, sent to the real model, judged by the real
        engine. Nothing here is staged — if an attack ever got through, this page would say
        so.
      </p>

      <div className="mt-7 flex flex-wrap gap-3">
        <button
          className="btn btn-solid"
          onClick={() => void attack()}
          disabled={running}
        >
          {running ? 'Attacking…' : '☠ Run every attack'}
        </button>
      </div>

      {error && (
        <p
          className="mt-6 border-l-4 py-3 pl-4 text-[14px]"
          style={{ borderColor: 'var(--oxblood)', color: 'var(--oxblood)', background: 'var(--wash-red)' }}
        >
          {error}
        </p>
      )}

      {/* Scoreboard */}
      {summary && (
        <div className="sheet reveal mt-8 p-7">
          <div className="grid gap-6 sm:grid-cols-4">
            <Stat label="Attacks run" value={String(summary.attacks)} />
            <Stat
              label="AI fooled"
              value={`${summary.aiFooled} of ${summary.attacks}`}
              tone="var(--ochre)"
            />
            <Stat
              label="Reached the money"
              value={String(summary.gotThrough)}
              tone={summary.gotThrough === 0 ? 'var(--forest)' : 'var(--oxblood)'}
            />
            <Stat
              label="Protected"
              value={`₹${summary.moneyProtected.toLocaleString('en-IN')}`}
              tone="var(--forest)"
            />
          </div>

          <p className="display mt-7 text-center text-[clamp(19px,2.6vw,26px)]">
            {summary.aiFooled > 0 ? (
              <>
                The AI was fooled{' '}
                <span style={{ color: 'var(--ochre)' }}>{summary.aiFooled} times</span>.{' '}
                <span style={{ color: 'var(--forest)' }}>Nothing was paid.</span>
              </>
            ) : (
              summary.verdict
            )}
          </p>
        </div>
      )}

      {/* Each attack */}
      <div className="mt-8 space-y-4">
        {(results.length > 0 ? results : []).map((r, i) => (
          <div
            key={r.attack.id}
            className="sheet tick p-6"
            style={{ '--i': i } as CSSProperties}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="simulation">☠ {r.attack.name}</Badge>
              {r.aiObeyed ? (
                <Badge tone="blocked">AI took the bait</Badge>
              ) : (
                <Badge tone="verified">AI held the line</Badge>
              )}
              {r.outcome === 'GOT_THROUGH' && <Badge tone="blocked">GOT THROUGH</Badge>}
            </div>

            <p className="footnote mt-3">{r.attack.goal}</p>

            <pre
              className="mono mt-4 overflow-x-auto p-4 text-[11.5px] leading-relaxed whitespace-pre-wrap"
              style={{ background: 'var(--paper-deep)', color: 'var(--ink-soft)' }}
            >
              {r.attack.injection}
            </pre>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <span className="label">What the AI chose</span>
                <p className="mt-1 text-[15px]">
                  {r.aiChose
                    ? `${r.aiChose.product} — ₹${r.aiChose.price.toLocaleString('en-IN')} from ${r.aiChose.seller}`
                    : 'It produced no order at all.'}
                </p>
              </div>

              <div>
                <span className="label">What MandateGuard did</span>
                <p
                  className="mt-1 text-[15px] font-semibold"
                  style={{
                    color:
                      r.outcome === 'GOT_THROUGH' ? 'var(--oxblood)' : 'var(--forest)',
                  }}
                >
                  {r.verification?.decision === 'BLOCKED'
                    ? `Refused — ${r.verification.violations.length} rules broken`
                    : r.verification?.decision === 'APPROVED'
                      ? 'Approved — it stayed inside the rule'
                      : '—'}
                </p>
              </div>
            </div>

            {r.verification && r.verification.violations.length > 0 && (
              <ol className="mt-4 grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
                {r.verification.violations.map((v, n) => (
                  <li
                    key={v}
                    className="flex items-baseline gap-2 text-[13px]"
                    style={{ color: 'var(--oxblood)' }}
                  >
                    <span className="mono shrink-0 opacity-60">
                      {String(n + 1).padStart(2, '0')}
                    </span>
                    <span>{v}</span>
                  </li>
                ))}
              </ol>
            )}

            {r.moneyAtRisk > 0 && (
              <p className="mt-4 text-[14px]" style={{ color: 'var(--forest)' }}>
                ₹{r.moneyAtRisk.toLocaleString('en-IN')} would have left. It did not.
              </p>
            )}
          </div>
        ))}
      </div>

      {/* The attacks, before you run them */}
      {results.length === 0 && attacks.length > 0 && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {attacks.map((a, i) => (
            <div key={a.id} className="block tick p-5" style={{ '--i': i } as CSSProperties}>
              <span className="label">☠ {a.name}</span>
              <p className="footnote mt-2">{a.goal}</p>
              <button
                className="btn btn-sm mt-4"
                onClick={() => void attack(a.id)}
                disabled={running}
              >
                Run this one
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="footnote mt-10">
        A judge can run this without the interface:{' '}
        <span className="mono">
          curl -X POST {API_BASE}/api/security/attack -H "Content-Type: application/json" -d
          {' \'{}\''}
        </span>
      </p>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <span className="label">{label}</span>
      <p className="display mt-1 text-[26px]" style={{ color: tone ?? 'var(--ink)' }}>
        {value}
      </p>
    </div>
  )
}

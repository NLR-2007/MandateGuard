import { useEffect, useState } from 'react'
import { getLive, rupees, type LivePhase, type LiveSession } from '../api'

/**
 * The band across the top of the shop showing what the AI shopper is doing.
 *
 * This is what makes a phone in someone's hand visible on a projector: every
 * step the agent takes appears here within a second or two, whether the
 * instruction came from Telegram or from this website.
 */

const TONE: Record<LivePhase, { bg: string; fg: string; dot: string }> = {
  IDLE:              { bg: 'var(--sunk)',            fg: 'var(--ink-soft)', dot: 'var(--ink-faint)' },
  BROWSING:          { bg: 'rgba(16,35,63,0.06)',    fg: 'var(--deep)',     dot: 'var(--deep)' },
  SELECTED:          { bg: 'rgba(16,35,63,0.06)',    fg: 'var(--deep)',     dot: 'var(--deep)' },
  CHECKING:          { bg: 'rgba(255,77,46,0.09)',   fg: 'var(--brand)',    dot: 'var(--brand)' },
  BLOCKED:           { bg: 'rgba(192,39,26,0.09)',   fg: 'var(--bad)',      dot: 'var(--bad)' },
  AWAITING_APPROVAL: { bg: 'rgba(163,91,0,0.10)',    fg: 'var(--warn)',     dot: 'var(--warn)' },
  REJECTED:          { bg: 'var(--sunk)',            fg: 'var(--ink-soft)', dot: 'var(--ink-faint)' },
  PAYING:            { bg: 'rgba(15,107,79,0.09)',   fg: 'var(--good)',     dot: 'var(--good)' },
  PAID:              { bg: 'rgba(15,107,79,0.12)',   fg: 'var(--good)',     dot: 'var(--good)' },
}

const BUSY: LivePhase[] = ['BROWSING', 'SELECTED', 'CHECKING', 'PAYING']

export default function AgentStrip() {
  const [live, setLive] = useState<LiveSession | null>(null)

  // Polling rather than a socket: one endpoint, no connection to drop, and a
  // second of latency is invisible to someone watching from a room away.
  useEffect(() => {
    let stop = false
    const tick = async () => {
      try {
        const next = await getLive()
        if (!stop) setLive(next)
      } catch {
        /* the guard is down; the shop keeps working */
      }
    }
    void tick()
    const id = setInterval(tick, 1200)
    return () => {
      stop = true
      clearInterval(id)
    }
  }, [])

  if (!live || live.phase === 'IDLE') return null

  const tone = TONE[live.phase]
  const busy = BUSY.includes(live.phase)

  return (
    <div
      className={`border-b ${busy ? 'working' : ''}`}
      style={{ background: tone.bg, borderColor: 'var(--line)' }}
    >
      <div className="wrap flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${busy ? 'beacon' : ''}`}
          style={{ background: tone.dot }}
        />

        <span className="eyebrow" style={{ color: tone.fg }}>
          {live.source === 'TELEGRAM' ? 'AI shopper · via Telegram' : 'AI shopper'}
        </span>

        <span className="text-[15px] font-semibold" style={{ color: tone.fg }}>
          {live.headline}
        </span>

        {live.product && (
          <span className="pill pill-ink">
            {live.product} · {rupees(live.price ?? 0)}
            {live.seller ? ` · ${live.seller}` : ''}
          </span>
        )}

        {live.checksTotal > 0 && (
          <span
            className="pill"
            style={{
              background: live.decision === 'BLOCKED' ? 'rgba(192,39,26,0.09)' : 'rgba(15,107,79,0.1)',
              color: live.decision === 'BLOCKED' ? 'var(--bad)' : 'var(--good)',
            }}
            /* The reasons themselves live on the order, not up here - this bar
               is a glance, not a report. */
            title={live.violations.join('  ·  ')}
          >
            {live.checksPassed}/{live.checksTotal} rules passed
          </span>
        )}

        {live.explorerUrl && (
          <a
            className="pill pill-good ml-auto underline"
            href={live.explorerUrl}
            target="_blank"
            rel="noreferrer"
          >
            View payment on Algorand ↗
          </a>
        )}
      </div>
    </div>
  )
}

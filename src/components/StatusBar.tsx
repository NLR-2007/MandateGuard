import { useEffect, useState } from 'react'
import { getSystemStatus } from '../services/api'
import type { ServiceState, SystemStatus } from '../types'
const dotColor: Record<ServiceState, string> = {
  OK: 'var(--forest)',
  NOT_CONFIGURED: 'var(--ochre)',
  ERROR: 'var(--oxblood)',
}

interface Props {
  status: SystemStatus | null
  error?: string
}

/** Service lamps, reading like an instrument panel label strip. */
export function StatusLights({ status, error }: Props) {
  if (error) {
    return (
      <span className="mono text-[11px]" style={{ color: 'var(--oxblood)'
}}>
        ● server unreachable
      </span>
    )
  }

  if (!status) return <span className="label">checking services…</span>

  const items = [
    { key: 'NIM', service: status.services.ai },
    { key: 'Guard', service: status.services.mandateGuard },
    { key: 'x402', service: status.services.x402 },
    { key: 'Algorand', service: status.services.algorand },
  ]

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map(({ key, service }) => (
        <span
          key={key}
          className="mono flex items-center gap-1.5 text-[10px] tracking-[0.12em] uppercase"
          style={{ color: 'var(--ink-soft)'
}}
          title={service.name}
        >
          <span
            className="inline-block h-[7px] w-[7px]"
            style={{ background: dotColor[service.state] }}
          />
          {key}
        </span>
      ))}
    </div>
  )
}

/** Hook so several pages can share one status fetch. */
export function useSystemStatus(refreshKey = 0) {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    getSystemStatus()
      .then((s) => {
        if (!cancelled) {
          setStatus(s)
          setError('')
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Status unavailable')
      })

    return () => {
      cancelled = true
    }
  }, [refreshKey])

  return { status, error }
}

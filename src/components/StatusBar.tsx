import { useEffect, useState } from 'react'
import { getSystemStatus } from '../services/api'
import type { ServiceState, SystemStatus } from '../types'

const dot: Record<ServiceState, string> = {
  OK: 'bg-emerald-400',
  NOT_CONFIGURED: 'bg-yellow-400',
  ERROR: 'bg-red-500',
}

const label: Record<ServiceState, string> = {
  OK: 'working',
  NOT_CONFIGURED: 'not configured',
  ERROR: 'error',
}

interface Props {
  status: SystemStatus | null
  error?: string
}

/** Small lights: AI ● MandateGuard ● x402 ● Algorand ● */
export function StatusLights({ status, error }: Props) {
  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-300">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
        Backend unreachable
      </div>
    )
  }

  if (!status) {
    return <div className="text-sm text-slate-500">Checking services…</div>
  }

  const items = [
    { key: 'AI', service: status.services.ai },
    { key: 'MandateGuard', service: status.services.mandateGuard },
    { key: 'x402', service: status.services.x402 },
    { key: 'Algorand', service: status.services.algorand },
  ]

  return (
    <div className="flex flex-wrap items-center gap-4">
      {items.map(({ key, service }) => (
        <span
          key={key}
          className="flex items-center gap-2 text-sm text-slate-300"
          title={`${service.name}: ${label[service.state]}`}
        >
          <span className={`h-2.5 w-2.5 rounded-full ${dot[service.state]}`} />
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

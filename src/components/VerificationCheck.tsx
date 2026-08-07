import type { VerificationCheck as Check } from '../types'

interface Props {
  check: Check
}

/** One rule from the backend response. */
export default function VerificationCheck({ check }: Props) {
  return (
    <div
      className={[
        'rounded-lg border px-4 py-3 transition-colors duration-200',
        check.passed
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-red-500/40 bg-red-500/10',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-100">{check.rule}</span>
        <span
          className={[
            'text-lg font-bold',
            check.passed ? 'text-emerald-400' : 'text-red-400',
          ].join(' ')}
        >
          {check.passed ? '✓' : '✕'}
        </span>
      </div>

      <p
        className={[
          'mt-1 text-xs',
          check.passed ? 'text-slate-400' : 'text-red-300',
        ].join(' ')}
      >
        {check.message}
      </p>

      {!check.passed && (
        <p className="mt-2 text-xs text-slate-400">
          Approved: <span className="text-slate-200">{String(check.expected)}</span>
          <span className="mx-2 text-red-400">→</span>
          AI order: <span className="text-red-300">{String(check.actual)}</span>
        </p>
      )}
    </div>
  )
}

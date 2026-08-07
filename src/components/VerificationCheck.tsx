import type { VerificationCheck as Check } from '../types'
interface Props {
  check: Check
}

/** One rule, ruled like a line in a register. */
export default function VerificationCheck({ check }: Props) {
  return (
    <div
      className="flex gap-4 border-b py-3"
      style={{ borderColor: 'var(--rule-soft)'
}}
    >
      <span
        className="mono w-4 shrink-0 text-[13px]"
        style={{ color: check.passed ? 'var(--forest)' : 'var(--oxblood)'
}}
      >
        {check.passed ? '✓' : '✕'}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span
            className="text-[14px]"
            style={{ color: check.passed ? 'var(--ink)' : 'var(--oxblood)'
}}
          >
            {check.rule}
          </span>
          <span className="label">{check.passed ? 'in order' : 'refused'}</span>
        </div>

        <p className="mt-0.5 text-[13px]" style={{ color: 'var(--ink-soft)'
}}>
          {check.message}
        </p>

        {!check.passed && (
          <p className="mono mt-1.5 text-[11px]" style={{ color: 'var(--ink-faint)'
}}>
            approved <span style={{ color: 'var(--ink)'
}}>{String(check.expected)}</span>
            {' →  '}
            ordered <span style={{ color: 'var(--oxblood)'
}}>{String(check.actual)}</span>
          </p>
        )}
      </div>
    </div>
  )
}

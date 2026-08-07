export const FLOW_STEPS = [
  'Instruction',
  'Draft',
  'Approval',
  'Order',
  'Review',
  'Payment',
  'Verdict',
  'Proof',
] as const

interface Props {
  /** 1-based index of the step being worked on. */
  current: number
}

/** A docket strip: where this mandate stands in the process. */
export default function StepIndicator({ current }: Props) {
  return (
    <ol
      className="flex flex-wrap border-t border-l"
      style={{ borderColor: 'var(--rule)'
}}
    >
      {FLOW_STEPS.map((label, i) => {
        const step = i + 1
        const done = step < current
        const active = step === current

        return (
          <li
            key={label}
            className="flex-1 border-r border-b px-3 py-2.5"
            style={{
              borderColor: 'var(--rule)',
              background: active
                ? 'var(--ink)' : done
                  ? 'rgba(39,81,47,0.07)' : 'transparent',
              minWidth: '110px',
            }}
          >
            <span
              className="mono block text-[9.5px] tracking-[0.16em]"
              style={{
                color: active
                  ? 'rgba(246,243,236,0.6)' : done
                    ? 'var(--forest)' : 'var(--ink-faint)',
              }}
            >
              {done ? '✓' : String(step).padStart(2, '0')}
            </span>
            <span
              className="mono block text-[11px] tracking-[0.08em] uppercase"
              style={{
                color: active
                  ? 'var(--paper-card)' : done
                    ? 'var(--forest)' : 'var(--ink-faint)',
              }}
            >
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

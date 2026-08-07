export const FLOW_STEPS = [
  'Human Instruction',
  'AI Policy Draft',
  'Human Approval',
  'AI Order',
  'MandateGuard Verification',
  'x402 Payment',
  'Final Decision',
  'Blockchain Proof',
] as const

interface Props {
  /** 1-based index of the step being worked on. */
  current: number
}

export default function StepIndicator({ current }: Props) {
  return (
    <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {FLOW_STEPS.map((label, i) => {
        const step = i + 1
        const state = step < current ? 'done' : step === current ? 'active' : 'todo'

        return (
          <li
            key={label}
            className={[
              'flex items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors duration-200',
              state === 'done'
                ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-300'
                : state === 'active'
                  ? 'border-cyan-500 bg-cyan-500/10 text-cyan-200'
                  : 'border-slate-800 bg-slate-900/40 text-slate-500',
            ].join(' ')}
          >
            <span
              className={[
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                state === 'done'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : state === 'active'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-slate-800 text-slate-500',
              ].join(' ')}
            >
              {state === 'done' ? '✓' : step}
            </span>
            <span>
              <span className="block text-xs opacity-70">Step {step}</span>
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

interface Props {
  orderPrice: number
  maxPrice: number
}

/** Simulated flow. Nothing is paid - the last box says so clearly. */
export default function UnsafeFlow({ orderPrice, maxPrice }: Props) {
  const steps = [
    { text: 'Human Instruction', tone: 'normal' as const },
    { text: 'AI Agent', tone: 'normal' as const },
    { text: 'AI Creates Order', tone: 'normal' as const },
    { text: 'Basic Amount Check', tone: 'warn' as const },
    {
      text: `₹${orderPrice.toLocaleString('en-IN')} < ₹${maxPrice.toLocaleString('en-IN')}`,
      tone: 'warn' as const,
    },
    { text: 'APPROVED', tone: 'ok' as const },
    { text: '⚠️ SIMULATED PAYMENT WOULD PROCEED', tone: 'danger' as const },
  ]

  const toneClass = {
    normal: 'border-slate-700 bg-slate-900 text-slate-200',
    warn: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-300',
    ok: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400',
    danger: 'border-red-500/60 bg-red-500/10 text-red-400 font-bold',
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8">
      <h3 className="text-center text-xl font-bold text-white">Simulated Payment Flow</h3>

      <div className="mt-8 flex flex-col items-center gap-2">
        {steps.map((step, i) => (
          <div key={step.text} className="flex w-full flex-col items-center gap-2">
            <div
              className={[
                'rounded-lg border px-6 py-2.5 text-center text-sm',
                toneClass[step.tone],
              ].join(' ')}
            >
              {step.text}
            </div>
            {i < steps.length - 1 && <span className="text-slate-600">↓</span>}
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-sm font-semibold text-yellow-400">
        MandateGuard is disabled in this demonstration.
      </p>
    </div>
  )
}

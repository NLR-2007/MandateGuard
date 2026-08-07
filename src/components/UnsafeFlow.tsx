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
    { text: 'SIMULATED PAYMENT WOULD PROCEED', tone: 'danger' as const },
  ]

  const toneClass = {
    normal: 'border-[var(--rule)]  text-[var(--ink)]',
    warn: 'border-[var(--ochre)] bg-[var(--wash-ochre)] text-[var(--ochre)]',
    ok: 'border-[var(--forest)] bg-[var(--wash-green)] text-[var(--forest)]',
    danger: 'border-[var(--oxblood)] bg-[var(--wash-red)] text-[var(--oxblood)] font-bold',
  }

  return (
    <div className="block p-8">
      <h3 className="text-center display text-[23px] text-[var(--ink)]">Simulated Payment Flow</h3>

      <div className="mt-8 flex flex-col items-center gap-2">
        {steps.map((step, i) => (
          <div key={step.text} className="flex w-full flex-col items-center gap-2">
            <div
              className={[
                ' border px-6 py-2.5 text-center text-sm',
                toneClass[step.tone],
              ].join(' ')}
            >
              {step.text}
            </div>
            {i < steps.length - 1 && <span className="text-[var(--ink-soft)]">↓</span>}
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-sm font-semibold text-[var(--ochre)]">
        MandateGuard is disabled in this demonstration.
      </p>
    </div>
  )
}

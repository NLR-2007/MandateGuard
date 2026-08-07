interface Props {
  maxPrice: number
  orderPrice: number
}

/**
 * The only check in Phase 3.
 * It looks at the amount and NOTHING else - that is the whole point.
 */
export default function BasicSpendCheck({ maxPrice, orderPrice }: Props) {
  const withinLimit = orderPrice <= maxPrice

  return (
    <div className="rounded-2xl border border-yellow-500/40 bg-yellow-500/5 p-8">
      <h3 className="flex items-center gap-2 text-xl font-bold text-yellow-400">
        <span>⚖️</span> Basic Spend Limit Check
      </h3>
      <p className="mt-1 text-sm text-slate-400">This check looks at the amount only.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-sm text-slate-400">Maximum allowed</p>
          <p className="mt-1 text-2xl font-bold text-white">
            ₹{maxPrice.toLocaleString('en-IN')}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-sm text-slate-400">AI order amount</p>
          <p className="mt-1 text-2xl font-bold text-white">
            ₹{orderPrice.toLocaleString('en-IN')}
          </p>
        </div>
        <div
          className={[
            'rounded-xl border p-5',
            withinLimit
              ? 'border-emerald-500/40 bg-emerald-500/10'
              : 'border-red-500/40 bg-red-500/10',
          ].join(' ')}
        >
          <p className="text-sm text-slate-400">Result</p>
          <p
            className={[
              'mt-1 text-lg font-bold',
              withinLimit ? 'text-emerald-400' : 'text-red-400',
            ].join(' ')}
          >
            {withinLimit ? '✓ WITHIN SPENDING LIMIT' : '✕ OVER LIMIT'}
          </p>
        </div>
      </div>

      <p className="mt-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-5 py-4 font-semibold text-yellow-300">
        Payment would be allowed by an amount-only policy.
      </p>
      <p className="mt-3 text-sm text-slate-400">
        An amount-only policy can miss other changes.
      </p>
    </div>
  )
}

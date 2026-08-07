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
    <div className="notice p-8">
      <h3 className="flex items-center gap-2 display text-[23px] text-[var(--ochre)]">
         Basic Spend Limit Check
      </h3>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">This check looks at the amount only.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="block p-5">
          <p className="text-sm text-[var(--ink-soft)]">Maximum allowed</p>
          <p className="mt-1 display text-[28px] text-[var(--ink)]">
            ₹{maxPrice.toLocaleString('en-IN')}
          </p>
        </div>
        <div className="block p-5">
          <p className="text-sm text-[var(--ink-soft)]">AI order amount</p>
          <p className="mt-1 display text-[28px] text-[var(--ink)]">
            ₹{orderPrice.toLocaleString('en-IN')}
          </p>
        </div>
        <div
          className={[
            ' border p-5',
            withinLimit
              ? 'border-[var(--forest)] bg-[rgba(39,81,47,0.07)]' : 'border-[var(--oxblood)] bg-[rgba(140,29,24,0.06)]',
          ].join(' ')}
        >
          <p className="text-sm text-[var(--ink-soft)]">Result</p>
          <p
            className={[
              'mt-1 display text-[21px]',
              withinLimit ? 'text-[var(--forest)]' : 'text-[var(--oxblood)]',
            ].join(' ')}
          >
            {withinLimit ? '✓ WITHIN SPENDING LIMIT' : '✕ OVER LIMIT'}
          </p>
        </div>
      </div>

      <p className="mt-6 border border-[var(--ochre)] bg-[rgba(146,101,15,0.08)] px-5 py-4 font-semibold text-[var(--ochre)]">
        Payment would be allowed by an amount-only policy.
      </p>
      <p className="mt-3 text-sm text-[var(--ink-soft)]">
        An amount-only policy can miss other changes.
      </p>
    </div>
  )
}

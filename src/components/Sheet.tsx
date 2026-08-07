interface Props {
  /** Gutter mark, e.g. "01" renders as § 01 */
  mark?: string
  title?: string
  note?: string
  children: React.ReactNode
  className?: string
}

/**
 * One section of the record: a numbered mark in the gutter, a serif heading,
 * and the content on paper.
 */
export default function Sheet({ mark, title, note, children, className = ''
}: Props) {
  return (
    <section className={`grid gap-x-6 md:grid-cols-[64px_1fr] ${className}`}>
      <div className="hidden pt-1 md:block">
        {mark && <span className="gutter-mark">§ {mark}</span>}
      </div>

      <div>
        {title && (
          <header className="mb-5">
            <h2 className="display text-[26px]">{title}</h2>
            {note && (
              <p className="mt-1 max-w-2xl text-sm" style={{ color: 'var(--ink-soft)'
}}>
                {note}
              </p>
            )}
            <div className="rule-line mt-3" />
          </header>
        )}
        {children}
      </div>
    </section>
  )
}

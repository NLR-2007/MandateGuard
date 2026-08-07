import type { Violation } from '../types'
interface Props {
  violation: Violation
  index: number
}

export default function ViolationCard({ violation, index }: Props) {
  return (
    <div className="notice p-5 transition-all duration-200 hover:-translate-y-1 hover:border-[var(--oxblood)]">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center bg-[var(--wash-red)] text-xs font-bold text-[var(--oxblood)]">
          {index}
        </span>
        <h4 className="font-semibold text-[var(--oxblood)]">{violation.title}</h4>
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <div>
          <p className="text-xs text-[var(--ink-soft)]">Human approved</p>
          <p className="mt-0.5 font-medium text-[var(--ink)]">{violation.humanApproved}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--ink-soft)]">AI selected</p>
          <p className="mt-0.5 font-medium text-[var(--oxblood)]">{violation.aiSelected}</p>
        </div>
      </div>
    </div>
  )
}

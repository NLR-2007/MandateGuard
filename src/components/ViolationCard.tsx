import type { Violation } from '../types'

interface Props {
  violation: Violation
  index: number
}

export default function ViolationCard({ violation, index }: Props) {
  return (
    <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-5 transition-all duration-200 hover:-translate-y-1 hover:border-red-500/70">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20 text-xs font-bold text-red-400">
          {index}
        </span>
        <h4 className="font-semibold text-red-400">{violation.title}</h4>
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <div>
          <p className="text-xs text-slate-400">Human approved</p>
          <p className="mt-0.5 font-medium text-white">{violation.humanApproved}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">AI selected</p>
          <p className="mt-0.5 font-medium text-red-300">{violation.aiSelected}</p>
        </div>
      </div>
    </div>
  )
}

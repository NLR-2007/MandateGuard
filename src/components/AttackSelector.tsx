import { scenarioOrder, scenarios } from '../data/demoData'
import type { AttackScenario } from '../types'

interface Props {
  active: AttackScenario
  onSelect: (scenario: AttackScenario) => void
}

export default function AttackSelector({ active, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-3">
      {scenarioOrder.map((id) => {
        const isActive = id === active
        const isSafe = id === 'safe'

        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className={[
              'rounded-lg border px-5 py-2.5 text-sm font-semibold transition-colors duration-200',
              isActive
                ? isSafe
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                  : 'border-red-500 bg-red-500/10 text-red-400'
                : 'border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white',
            ].join(' ')}
          >
            {scenarios[id].label}
          </button>
        )
      })}
    </div>
  )
}

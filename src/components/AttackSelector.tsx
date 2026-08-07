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
              'btn btn-sm',
              isActive
                ? isSafe
                  ? 'border-[var(--forest)] bg-[var(--wash-green)] text-[var(--forest)]' : 'border-[var(--oxblood)] bg-[var(--wash-red)] text-[var(--oxblood)]' : 'border-[var(--rule)] text-[var(--ink-soft)] hover:border-[var(--rule)] hover:text-[var(--ink)]',
            ].join(' ')}
          >
            {scenarios[id].label}
          </button>
        )
      })}
    </div>
  )
}

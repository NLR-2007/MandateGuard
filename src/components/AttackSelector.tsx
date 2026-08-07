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
                  ? 'border-[var(--forest)] bg-[rgba(39,81,47,0.07)] text-[var(--forest)]' : 'border-[var(--oxblood)] bg-[rgba(140,29,24,0.06)] text-[var(--oxblood)]' : 'border-[var(--rule)] text-[var(--ink-soft)] hover:border-[var(--rule)] hover:text-[var(--ink)]',
            ].join(' ')}
          >
            {scenarios[id].label}
          </button>
        )
      })}
    </div>
  )
}

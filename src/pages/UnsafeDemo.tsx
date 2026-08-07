import { useState } from 'react'
import DemoPageNote from '../components/DemoPageNote'
import { Link } from 'react-router-dom'
import AIOrderCard from '../components/AIOrderCard'
import AttackSelector from '../components/AttackSelector'
import BasicSpendCheck from '../components/BasicSpendCheck'
import GuardComparison from '../components/GuardComparison'
import HumanPolicyCard from '../components/HumanPolicyCard'
import UnsafeFlow from '../components/UnsafeFlow'
import ViolationCard from '../components/ViolationCard'
import { humanPolicy, scenarios } from '../data/demoData'
import type { AttackScenario } from '../types'

const dangers = [
  'The amount can still be valid.',
  'The AI can change the order.',
  'Extra items can be added.',
  'Money can go to the wrong receiver.',
]

export default function UnsafeDemo() {
  const [active, setActive] = useState<AttackScenario>('combined')

  const scenario = scenarios[active]
  const order = scenario.order
  const violations = scenario.violations
  const hasViolations = violations.length > 0

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <DemoPageNote />
      {/* Simulation label */}
      <div className="mb-8 flex flex-wrap items-center gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-5 py-3">
        <span className="text-xl">⚠️</span>
        <span className="font-semibold text-yellow-300">
          Simulation — MandateGuard Disabled
        </span>
        <span className="text-sm text-yellow-200/70">
          No real payment happens on this page.
        </span>
      </div>

      <h1 className="text-3xl font-bold text-white sm:text-4xl">Without MandateGuard</h1>
      <p className="mt-2 text-slate-400">
        See what can happen when an AI payment checks only the amount.
      </p>

      {/* SECTION 6 - attack buttons (kept near the top so a judge can switch fast) */}
      <div className="mt-8">
        <p className="mb-3 text-sm text-slate-400">Choose a demo scenario:</p>
        <AttackSelector active={active} onSelect={setActive} />
        <p
          className={[
            'mt-4 rounded-lg border px-5 py-3 text-sm font-medium',
            hasViolations
              ? 'border-red-500/40 bg-red-500/5 text-red-300'
              : 'border-emerald-500/40 bg-emerald-500/5 text-emerald-300',
          ].join(' ')}
        >
          {scenario.note}
        </p>
      </div>

      {/* SECTIONS 1 + 2 - policy vs order */}
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <HumanPolicyCard policy={humanPolicy} />
        <AIOrderCard policy={humanPolicy} order={order} changed={scenario.changed} />
      </div>

      {/* The headline statement */}
      <div className="mt-10 rounded-2xl border border-yellow-500/40 bg-gradient-to-r from-yellow-500/10 to-red-500/10 p-10 text-center">
        <p className="text-2xl font-bold text-white sm:text-3xl">
          ₹{order.price.toLocaleString('en-IN')} is below the ₹
          {humanPolicy.maxPrice.toLocaleString('en-IN')} limit.
        </p>
        <p className="mt-3 text-lg text-slate-300">
          {hasViolations
            ? 'But the AI changed what the human actually approved.'
            : 'And this time the AI kept everything the human approved.'}
        </p>
        <p className="mt-8 text-3xl font-bold tracking-wide text-yellow-400 sm:text-4xl">
          Amount approved ≠ Intent approved
        </p>
      </div>

      {/* SECTION 3 - the only check that exists in Phase 3 */}
      <div className="mt-10">
        <BasicSpendCheck maxPrice={humanPolicy.maxPrice} orderPrice={order.price} />
      </div>

      {/* SECTION 4 - what went wrong */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold text-white">What went wrong?</h2>
        {hasViolations ? (
          <>
            <p className="mt-2 font-semibold text-red-400">
              {violations.length} policy violation{violations.length > 1 ? 's were' : ' was'}{' '}
              missed by the amount-only check.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {violations.map((v, i) => (
                <ViolationCard key={v.title} violation={v} index={i + 1} />
              ))}
            </div>
          </>
        ) : (
          <p className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/5 px-5 py-4 text-emerald-300">
            Nothing was changed in this order. The amount-only check and the human's intent
            happen to agree here — which is exactly why the problem is easy to miss.
          </p>
        )}
      </div>

      {/* SECTION 5 - simulated flow */}
      <div className="mt-12">
        <UnsafeFlow orderPrice={order.price} maxPrice={humanPolicy.maxPrice} />
      </div>

      {/* SECTION 7 - why this matters */}
      <div className="mt-12 rounded-2xl border border-slate-800 bg-slate-900/40 p-8">
        <h2 className="text-2xl font-bold text-white">Why is this dangerous?</h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {dangers.map((d) => (
            <li
              key={d}
              className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-slate-200"
            >
              <span className="text-red-400">•</span>
              {d}
            </li>
          ))}
        </ul>

        <p className="mt-8 text-center text-xl font-bold text-white">
          Checking only how much AI spends is not enough.
        </p>
        <p className="mt-2 text-center text-xl font-bold text-cyan-400">
          We also need to check what the AI is buying.
        </p>
      </div>

      {/* PART 11 - side by side, right column runs the real engine */}
      <div className="mt-12">
        <GuardComparison order={order} maxPrice={humanPolicy.maxPrice} />
      </div>

      {/* SECTION 8 - now the guard exists, so send the user to it */}
      <div className="mt-12 rounded-2xl border border-cyan-500/40 bg-cyan-500/5 p-10 text-center">
        <h2 className="text-2xl font-bold text-white">How can we stop this?</h2>
        <p className="mt-3 text-lg text-cyan-300">MandateGuard Policy Engine</p>

        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <Link
            to="/order"
            className="rounded-lg bg-cyan-500 px-6 py-3 font-semibold text-slate-950 transition-colors duration-200 hover:bg-cyan-400"
          >
            🛡️ Now Enable MandateGuard
          </Link>
          <Link
            to="/policy"
            className="rounded-lg border border-slate-600 px-6 py-3 font-semibold text-white transition-colors duration-200 hover:border-cyan-400 hover:text-cyan-300"
          >
            Create your own policy
          </Link>
        </div>
      </div>
    </section>
  )
}

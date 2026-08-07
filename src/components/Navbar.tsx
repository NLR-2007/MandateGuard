import { NavLink } from 'react-router-dom'
import { useAppMode, type AppMode } from '../services/appMode'
interface LinkDef {
  to: string
  label: string
  /** Which modes offer this link. Hidden links still work by URL. */
  modes: AppMode[]
}

const links: LinkDef[] = [
  { to: '/home', label: 'Home', modes: ['MVP', 'DEMO'] },
  { to: '/dashboard', label: 'Dashboard', modes: ['MVP', 'DEMO'] },
  { to: '/history', label: 'History', modes: ['MVP', 'DEMO'] },
  { to: '/architecture', label: 'How it works', modes: ['MVP', 'DEMO'] },

  // Teaching pages - shown only in Demo mode so MVP stays uncluttered.
  { to: '/unsafe-demo', label: 'The Problem', modes: ['DEMO'] },
  { to: '/policy', label: 'Create Policy', modes: ['DEMO'] },
  { to: '/order', label: 'AI Order', modes: ['DEMO'] },
  { to: '/verify', label: 'Result', modes: ['DEMO'] },
]

export default function Navbar() {
  const { mode, setMode } = useAppMode()
  const visible = links.filter((link) => link.modes.includes(mode))

  return (
    <header className="sticky top-0 z-50" style={{ background: 'var(--paper)'
}}>
      <div className="mx-auto max-w-[1180px] px-6">
        {/* Masthead */}
        <div className="flex flex-wrap items-end justify-between gap-4 pt-5 pb-3">
          <NavLink to="/" className="group flex items-baseline gap-3">
            <span
              className="display text-[30px] leading-none"
              style={{ color: 'var(--ink)'
}}
            >
              MandateGuard
            </span>
            <span className="label hidden sm:block">AI Agent Spend Policy Engine</span>
          </NavLink>

          <div className="flex items-center gap-4">
            <span className="label hidden md:block">Algorand TestNet</span>

            {/* Mode toggle */}
            <div
              className="flex items-center border"
              style={{ borderColor: 'var(--ink)'
}}
              title={
                mode === 'MVP' ? 'Simple view — Home, Dashboard, History, How it works' : 'Full view — adds the step-by-step demo pages'
}
            >
              {(['MVP', 'DEMO'] as AppMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="mono px-3 py-1 text-[10px] font-semibold tracking-[0.16em] uppercase transition-colors"
                  style={
                    mode === m
                      ? { background: 'var(--accent)', color: 'var(--accent-ink)'
}
                      : { color: 'var(--ink-faint)'
}
                  }
                >
                  {m === 'MVP' ? 'Simple' : 'Full'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Rule + navigation */}
        <nav className="rule-double flex flex-wrap items-center gap-x-6 gap-y-1 py-2">
          {visible.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/home'}
              className="mono text-[11px] font-medium tracking-[0.14em] uppercase transition-colors"
              style={({ isActive }) =>
                isActive
                  ? { color: 'var(--oxblood)', textDecoration: 'underline', textUnderlineOffset: '5px'
}
                  : { color: 'var(--ink-soft)'
}
              }
            >
              {link.label}
            </NavLink>
          ))}

          <span className="label ml-auto hidden sm:block">
            {mode === 'MVP' ? 'Simple view' : 'Full view'}
          </span>
        </nav>
        <div className="rule-line" style={{ borderColor: 'var(--ink)'
}} />
      </div>
    </header>
  )
}

import { NavLink } from 'react-router-dom'
import { useAppMode, type AppMode } from '../services/appMode'

interface LinkDef {
  to: string
  label: string
  /** Which modes offer this link. Hidden links still work by URL. */
  modes: AppMode[]
}

const links: LinkDef[] = [
  { to: '/', label: 'Home', modes: ['MVP', 'DEMO'] },
  { to: '/dashboard', label: 'Dashboard', modes: ['MVP', 'DEMO'] },
  { to: '/history', label: 'History', modes: ['MVP', 'DEMO'] },
  { to: '/architecture', label: 'Architecture', modes: ['MVP', 'DEMO'] },

  // Teaching pages - shown only in Demo mode so MVP stays uncluttered.
  { to: '/unsafe-demo', label: 'Problem Demo', modes: ['DEMO'] },
  { to: '/policy', label: 'Create Policy', modes: ['DEMO'] },
  { to: '/order', label: 'AI Order', modes: ['DEMO'] },
  { to: '/verify', label: 'Verify', modes: ['DEMO'] },
]

export default function Navbar() {
  const { mode, setMode } = useAppMode()
  const visible = links.filter((link) => link.modes.includes(mode))

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-[#060d1c]/95 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-4">
        {/* Logo */}
        <NavLink to="/" className="flex items-center gap-2">
          <span className="text-2xl">🛡️</span>
          <span className="text-lg font-bold tracking-wide text-white">
            Mandate<span className="text-cyan-400">Guard</span>
          </span>
        </NavLink>

        {/* Links */}
        <ul className="ml-auto flex flex-wrap items-center gap-1">
          {visible.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  [
                    'rounded-md px-3 py-2 text-sm transition-colors duration-200',
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-300'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                  ].join(' ')
                }
              >
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Mode toggle */}
        <div
          className="flex items-center rounded-full border border-slate-700 bg-slate-900 p-1"
          title={
            mode === 'MVP'
              ? 'MVP: the product — Home, Dashboard, History, Architecture'
              : 'Demo: adds the step-by-step teaching pages'
          }
        >
          {(['MVP', 'DEMO'] as AppMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={[
                'rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-200',
                mode === m
                  ? m === 'MVP'
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-yellow-500 text-slate-950'
                  : 'text-slate-400 hover:text-white',
              ].join(' ')}
            >
              {m === 'MVP' ? 'MVP' : 'Demo'}
            </button>
          ))}
        </div>
      </nav>

      {/* One-line explanation so the toggle is never a mystery */}
      <p className="border-t border-slate-800/60 bg-slate-900/40 px-6 py-1.5 text-center text-xs text-slate-500">
        {mode === 'MVP'
          ? 'MVP mode — the product: run everything from the Dashboard.'
          : 'Demo mode — extra pages that explain the problem and each step on its own.'}
      </p>
    </header>
  )
}

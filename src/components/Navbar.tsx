import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Home' },
  { to: '/unsafe-demo', label: 'Problem Demo' },
  { to: '/policy', label: 'Create Policy' },
  { to: '/order', label: 'AI Order' },
  { to: '/verify', label: 'Verify' },
  { to: '/history', label: 'History' },
]

export default function Navbar() {
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
          {links.map((link) => (
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

        {/* Demo badge */}
        <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
          Demo Mode
        </span>
      </nav>
    </header>
  )
}

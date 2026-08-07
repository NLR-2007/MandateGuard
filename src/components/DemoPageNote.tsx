import { Link } from 'react-router-dom'
import { useAppMode } from '../services/appMode'

/**
 * Shown only when a Demo-mode page is opened while the app is in MVP mode,
 * so the page never feels like something that "should not be here".
 */
export default function DemoPageNote() {
  const { mode, setMode } = useAppMode()

  if (mode === 'DEMO') return null

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-5 py-3 text-sm text-yellow-200">
      <span>
        This is a <strong>Demo mode</strong> page — one step shown on its own. In MVP mode
        the Dashboard runs all the steps together.
      </span>
      <button
        onClick={() => setMode('DEMO')}
        className="rounded-md border border-yellow-500/50 px-3 py-1 text-xs font-semibold text-yellow-200 transition-colors duration-200 hover:bg-yellow-500/20"
      >
        Switch to Demo mode
      </button>
      <Link
        to="/dashboard"
        className="rounded-md border border-slate-600 px-3 py-1 text-xs font-semibold text-slate-200 transition-colors duration-200 hover:border-cyan-400 hover:text-cyan-300"
      >
        Go to Dashboard
      </Link>
    </div>
  )
}

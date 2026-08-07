import { Link } from 'react-router-dom'
import { useAppMode } from '../services/appMode'
/**
 * Shown when a dossier-only sheet is opened while the app is in file mode,
 * so the page never feels like something that should not be here.
 */
export default function DemoPageNote() {
  const { mode, setMode } = useAppMode()

  if (mode === 'DEMO') return null

  return (
    <div className="notice notice-ink mb-8 flex flex-wrap items-center gap-4">
      <span className="text-[13px]">
        This is one step on its own page. The Dashboard runs all the steps together.
      </span>
      <button onClick={() => setMode('DEMO')} className="btn btn-sm">
        Show all pages
      </button>
      <Link to="/dashboard" className="btn btn-sm">
        Go to Dashboard
      </Link>
    </div>
  )
}

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
/**
 * Two ways to look at the same app.
 *
 * MVP  - the product. One place to work: Home, Dashboard, History, Architecture.
 * DEMO - the full walkthrough, including the teaching pages used to explain the
 *        problem and each step separately.
 *
 * The toggle only changes which links are offered. Every page keeps working if
 * you open its URL directly, so no link ever dead-ends.
 */
export type AppMode = 'MVP' | 'DEMO'
const STORAGE_KEY = 'mg_app_mode'
interface AppModeValue {
  mode: AppMode
  setMode: (mode: AppMode) => void
  toggle: () => void
}

const AppModeContext = createContext<AppModeValue>({
  mode: 'MVP',
  setMode: () => {},
  toggle: () => {},
})

function readStored(): AppMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'DEMO' ? 'DEMO' : 'MVP'
} catch {
    return 'MVP'
}
}

export function AppModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<AppMode>(readStored)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      /* private browsing - the choice just does not persist */
    }
  }, [mode])

  const setMode = useCallback((next: AppMode) => setModeState(next), [])
  const toggle = useCallback(
    () => setModeState((m) => (m === 'MVP' ? 'DEMO' : 'MVP')),
    [],
  )

  return (
    <AppModeContext.Provider value={{ mode, setMode, toggle }}>
      {children}
    </AppModeContext.Provider>
  )
}

export function useAppMode(): AppModeValue {
  return useContext(AppModeContext)
}

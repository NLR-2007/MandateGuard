/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Where MandateGuard lives. NovaMart's only outside dependency. */
  readonly VITE_GUARD_API?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

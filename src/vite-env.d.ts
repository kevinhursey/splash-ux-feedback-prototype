/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set in `.env.local` / CI; empty at build time if unset */
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_APP_ENV?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

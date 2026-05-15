import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Strip `/rest/v1` if pasted from REST docs — createClient expects the project host root */
function normalizeSupabaseUrl(raw: string): string {
  return raw
    .trim()
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/$/, '')
}

let browserClient: SupabaseClient | null = null

export function getSupabaseBrowserClient(): SupabaseClient | null {
  // Vite only exposes variables prefixed with VITE_ (exact names below).
  const rawUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim()
  const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()
  if (!rawUrl || !anonKey) {
    if (
      typeof window !== 'undefined' &&
      /\.vercel\.app$/i.test(window.location.hostname)
    ) {
      console.warn(
        '[Supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is empty in this build. ' +
          'On Vercel: Project → Settings → Environment Variables → add both for Preview and Production, ' +
          'then redeploy (Vite bakes VITE_* into the client at build time).',
      )
    }
    return null
  }
  const url = normalizeSupabaseUrl(rawUrl)
  const key = anonKey
  if (!url || !key) {
    return null
  }
  if (!browserClient) {
    browserClient = createClient(url, key)
  }
  return browserClient
}

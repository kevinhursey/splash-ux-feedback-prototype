import path from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  if (mode === 'development') {
    const viteEnv = loadEnv(mode, projectRoot, 'VITE')
    const hasUrl = Boolean(viteEnv.VITE_SUPABASE_URL?.trim())
    const hasKey = Boolean(viteEnv.VITE_SUPABASE_ANON_KEY?.trim())
    if (!hasUrl || !hasKey) {
      console.warn(
        `[vite] Supabase client env missing from files in ${projectRoot}: ` +
          `${!hasUrl ? 'VITE_SUPABASE_URL ' : ''}` +
          `${!hasKey ? 'VITE_SUPABASE_ANON_KEY' : ''}` +
          `(restart dev server after changing .env.local)`,
      )
    }
  }

  return {
    envDir: projectRoot,
    plugins: [react(), tailwindcss()],
  }
})

import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY: copia .env.example a .env.local.')
}

// PKCE: el código de Google vuelve en ?code=, compatible con HashRouter.
export const supabase = createClient<Database>(url, anonKey, { auth: { flowType: 'pkce' } })

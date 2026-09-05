import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Null when the app isn't configured for Supabase (missing .env) — every
// caller must handle that and fall back to local-only behavior, so a
// pharmacy can still use the app without the shared memory feature.
export const supabase = url && anonKey ? createClient(url, anonKey) : null

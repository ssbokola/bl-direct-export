import { useEffect, useState } from 'react'
import { supabase } from './utils/supabaseClient.js'
import { checkSupabaseHealth } from './utils/supabaseHealth.js'

/**
 * Un seul contrôle par session (checkSupabaseHealth est mémoïsé), consulté
 * ici une fois au montage racine (App.jsx) et redescendu en prop plutôt que
 * refait par chaque écran qui en a besoin.
 */
export function useSupabaseHealth() {
  const [status, setStatus] = useState(supabase ? 'checking' : 'unconfigured')

  useEffect(() => {
    let cancelled = false
    checkSupabaseHealth().then((s) => {
      if (!cancelled) setStatus(s)
    })
    return () => { cancelled = true }
  }, [])

  return status
}

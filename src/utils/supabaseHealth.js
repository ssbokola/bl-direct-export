import { supabase } from './supabaseClient.js'

const HEALTH_TIMEOUT_MS = 7000

/**
 * Un projet Supabase en pause ne répond pas par une erreur HTTP normale —
 * son sous-domaine cesse simplement de résoudre en DNS, ce qui fait pendre
 * la requête plutôt que de la faire échouer vite. D'où la course contre un
 * timeout explicite : sans lui, un appelant qui attend cette promesse (ex.
 * un état "Chargement…") resterait bloqué indéfiniment, pas juste jusqu'à
 * ce que le check échoue.
 */
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e) => { clearTimeout(timer); reject(e) },
    )
  })
}

// Mémoïsé au niveau module — un seul contrôle par session, quel que soit le
// nombre d'écrans qui le consultent (voir useSupabaseHealth.js).
let healthPromise = null

/**
 * Sonde légère, la même requête que le ping GitHub Actions
 * (.github/workflows/supabase-keepalive.yml) — déjà validée contre les
 * policies RLS avec la clé publique. Résout 'ok' | 'unreachable' |
 * 'unconfigured', jamais ne rejette.
 */
export function checkSupabaseHealth() {
  if (!supabase) return Promise.resolve('unconfigured')
  if (!healthPromise) {
    healthPromise = withTimeout(
      supabase.from('bl_lines').select('id', { head: true, count: 'exact' }).limit(1),
      HEALTH_TIMEOUT_MS,
    )
      .then(({ error }) => (error ? 'unreachable' : 'ok'))
      .catch(() => 'unreachable')
  }
  return healthPromise
}

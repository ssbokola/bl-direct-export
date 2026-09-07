import { supabase } from './supabaseClient.js'

const TABLE = 'bl_lines'

/**
 * Écrit les faits d'un BL exporté dans la table partagée `bl_lines`, pour
 * alimenter le rapport de fiabilité fournisseurs (voir SupplierReliability
 * .jsx et supabase-setup-bl-lines.sql). Une ligne par produit livré — pas
 * un résumé — pour que comparer les prix entre fournisseurs plus tard soit
 * un simple `group by` différent sur cette même table.
 *
 * Best-effort, comme rememberMatch() dans settings.js : un échec réseau ne
 * bloque jamais l'export, et sans Supabase configuré, c'est un no-op
 * silencieux (l'app reste utilisable sans le suivi fournisseurs).
 */
export function writeBlFacts(rows) {
  if (!supabase || !rows.length) return
  supabase.from(TABLE).insert(rows).then(() => {}, () => {})
}

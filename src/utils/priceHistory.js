import { supabase } from './supabaseClient.js'

/**
 * Dernier prix d'achat / prix de revient connu pour un produit, tous postes
 * confondus — cherché par nom, pas besoin de rouvrir le BL d'origine.
 * Alimenté par `bl_lines` (voir supabase-add-latest-prices.sql pour la vue
 * `latest_product_prices` : une ligne par code Médiciel, la plus récente).
 */
export async function searchLatestPrices(query) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('latest_product_prices')
    .select('*')
    .ilike('designation', `%${query}%`)
    .order('designation', { ascending: true })
    .limit(20)
  if (error) throw error
  return data || []
}

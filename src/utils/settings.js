/**
 * User settings that persist between sessions (localStorage).
 *
 * The EUR -> FCFA rate is a business decision, not a constant: the official
 * BCEAO peg is 655.957 FCFA for 1 EUR, but the rate that actually matters for
 * costing is the peg plus whatever the bank charges on the transfer. That
 * margin moves, so the user sets it once and we remember it.
 */

export const PARITE_FIXE = 655.957
export const DEFAULT_TAUX = 676

const KEY_TAUX = 'bl-direct-export:tauxEurCfa'

function isValidTaux(value) {
  return Number.isFinite(value) && value >= PARITE_FIXE && value <= 1000
}

export function loadTaux() {
  try {
    const stored = parseFloat(localStorage.getItem(KEY_TAUX))
    return isValidTaux(stored) ? stored : DEFAULT_TAUX
  } catch {
    // localStorage unavailable (private browsing, blocked cookies)
    return DEFAULT_TAUX
  }
}

export function saveTaux(value) {
  if (!isValidTaux(value)) return false
  try {
    localStorage.setItem(KEY_TAUX, String(value))
    return true
  } catch {
    return false
  }
}

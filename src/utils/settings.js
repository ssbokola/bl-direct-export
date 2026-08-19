/**
 * User settings that persist between sessions (localStorage).
 *
 * Both values are business decisions the user owns, not constants:
 * - the EUR -> FCFA rate starts at the official BCEAO peg (655.957 FCFA for
 *   1 EUR); bank transfer charges are added on top by the user;
 * - the margin coefficient turns purchase price into shelf price.
 * They are remembered so they do not have to be re-entered on every BL.
 */

export const PARITE_FIXE = 655.957
export const DEFAULT_TAUX = PARITE_FIXE
export const DEFAULT_COEFFICIENT = 1.53

export const TAUX_MAX = 1000
export const COEFF_MIN = 1
export const COEFF_MAX = 5

const KEY_TAUX = 'bl-direct-export:tauxEurCfa'
const KEY_COEFF = 'bl-direct-export:coefficient'

export function isValidTaux(value) {
  return Number.isFinite(value) && value >= PARITE_FIXE && value <= TAUX_MAX
}

export function isValidCoefficient(value) {
  return Number.isFinite(value) && value >= COEFF_MIN && value <= COEFF_MAX
}

function load(key, isValid, fallback) {
  try {
    const stored = parseFloat(localStorage.getItem(key))
    return isValid(stored) ? stored : fallback
  } catch {
    // localStorage unavailable (private browsing, blocked cookies)
    return fallback
  }
}

function save(key, value, isValid) {
  if (!isValid(value)) return false
  try {
    localStorage.setItem(key, String(value))
    return true
  } catch {
    return false
  }
}

export const loadTaux = () => load(KEY_TAUX, isValidTaux, DEFAULT_TAUX)
export const saveTaux = (value) => save(KEY_TAUX, value, isValidTaux)

export const loadCoefficient = () => load(KEY_COEFF, isValidCoefficient, DEFAULT_COEFFICIENT)
export const saveCoefficient = (value) => save(KEY_COEFF, value, isValidCoefficient)

/* ------------------------------------------------------------------ *
 * Match memory — "Déjà vu"
 *
 * A supplier line matched by hand once should not have to be matched
 * again on the next BL. Keyed by CIP/EAN, which is stable across
 * suppliers; the supplier's own wording is not.
 * ------------------------------------------------------------------ */

const KEY_MEMORY = 'bl-direct-export:matchMemory'
const MEMORY_MAX = 2000

export function loadMatchMemory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY_MEMORY))
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function rememberMatch(cip, medicielProduct) {
  if (!cip || !medicielProduct?.code) return
  if (String(cip).startsWith('MANUAL') || String(cip).startsWith('OCR-')) return
  try {
    const memory = loadMatchMemory()
    memory[cip] = { code: medicielProduct.code, produit: medicielProduct.produit }
    // Keep the map bounded: drop oldest insertions once past the cap.
    const keys = Object.keys(memory)
    if (keys.length > MEMORY_MAX) {
      for (const k of keys.slice(0, keys.length - MEMORY_MAX)) delete memory[k]
    }
    localStorage.setItem(KEY_MEMORY, JSON.stringify(memory))
  } catch {
    // Storage full or unavailable — memory is a convenience, not a requirement.
  }
}

export function clearMatchMemory() {
  try {
    localStorage.removeItem(KEY_MEMORY)
  } catch { /* nothing to clear */ }
}

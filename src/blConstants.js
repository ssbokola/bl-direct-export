/**
 * Constantes du plan de travail (étapes 2 à 5 — matching, conversion,
 * validation, export). L'import (étape 1) reste l'écran existant
 * (Step1Import.jsx, Tailwind), en amont de ce plan de travail.
 *
 * OCR_THRESHOLD et le statut de relecture (étape 1,5 du paquet d'origine)
 * restent définis mais dormants : ocrEngine.js/officineParser.js ne calculent
 * pas encore de score de confiance par ligne. Le jour où ils le feront,
 * useBlWorkspace()'s hasReview s'activera de lui-même — rien d'autre à
 * changer ici.
 */

export const OCR_THRESHOLD = 85

export const STEPS = {
  2: { title: 'Matching produits', short: 'Matching' },
  3: { title: 'Conversion des prix', short: 'Conversion' },
  4: { title: 'Validation des prix de vente', short: 'Validation' },
  5: { title: 'Export Médiciel', short: 'Export' },
}

/** Statut d'une ligne : libellé + rôles de couleur (jamais de hex ici). */
export const STATUS = {
  auto: { label: 'Auto', bg: 'var(--color-accent-800)', fg: 'var(--color-accent-100)' },
  validated: { label: 'Validé', bg: 'var(--color-accent-800)', fg: 'var(--color-accent-100)' },
  seen: { label: 'Déjà vu', bg: 'var(--color-neutral-800)', fg: 'var(--color-neutral-100)' },
  manual: { label: 'Manuel', bg: 'var(--color-accent-800)', fg: 'var(--color-accent-100)' },
  warning: { label: 'À vérifier', bg: 'var(--color-warn-bg)', fg: 'var(--color-warn)' },
  error: { label: 'Absent', bg: 'var(--color-error-bg)', fg: 'var(--color-error)' },
  excluded: { label: 'Exclue', bg: 'var(--color-neutral-900)', fg: 'var(--color-neutral-400)' },
}

export const FILTERS = [
  { key: 'all', label: 'Tout' },
  { key: 'auto', label: 'Appariées auto' },
  { key: 'validated', label: 'Validées' },
  { key: 'seen', label: 'Déjà vues' },
  { key: 'manual', label: 'Appariées à la main' },
  { key: 'warning', label: 'À vérifier' },
  { key: 'error', label: 'Sans correspondance' },
  { key: 'excluded', label: 'Exclues' },
]

/** Grille de la table de travail — partagée par l'en-tête et les lignes. */
export const GRID =
  '26px minmax(0,1.3fr) 34px minmax(0,1.25fr) 36px 76px 84px 88px 62px 84px'

export const fmtF = (n) => Math.round(n || 0).toLocaleString('fr-FR')

export const fmtEur = (n) =>
  (n || 0).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' €'

/** Les prix de vente sont arrondis aux 5 F supérieurs. */
export const roundUp5 = (v) => Math.ceil(v / 5) * 5

/** Confiance OCR → rôle de couleur (dormant, voir l'en-tête du fichier). */
export function ocrTone(score) {
  if (score >= 90) return { bg: 'var(--color-accent-900)', fg: 'var(--color-accent-300)' }
  if (score >= OCR_THRESHOLD - 5) return { bg: 'var(--color-warn-bg)', fg: 'var(--color-warn)' }
  return { bg: 'var(--color-error-bg)', fg: 'var(--color-error)' }
}
